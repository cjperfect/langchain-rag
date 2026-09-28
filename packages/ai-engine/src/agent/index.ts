import { HumanMessage } from "@langchain/core/messages";
import { createAgent } from "langchain";
import { createModel, defaultModel } from "./model";
import { systemPrompt } from "../prompts";
import { knowledgeSearchTool, type RetrievalScope } from "../tools/knowledge-search";
import type { ChatOptions } from "@langchain-rag/shared/interfaces";
import { emit, newTaskId, TaskEvent, TaskType } from "../events";
import { toLangChainMessages } from "../libs/messages";
import { StreamEvent } from "../interfaces/message";

/**
 * 从 on_tool_start 的事件数据里取模型填写的检索词。
 *
 * 实测形状：`event.data = { input: { input: '{"query":"..."}' } }`
 * ——外层是 langchain 的事件包装，内层是**序列化后的工具入参字符串**，要多解析一层。
 * （早先按 `data.input.query` 读，一直读到空串；结构已用独立探针确认。）
 */
function readQuery(data: unknown): string {
  if (typeof data !== "object" || data === null || !("input" in data)) return "";
  const wrapper = data.input;
  if (typeof wrapper !== "object" || wrapper === null || !("input" in wrapper)) return "";
  const serialized = wrapper.input;
  if (typeof serialized !== "string") return "";
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (typeof parsed === "object" && parsed !== null && "query" in parsed && typeof parsed.query === "string") {
      return parsed.query;
    }
  } catch {
    // 入参不是合法 JSON 时只是拿不到展示用的检索词，不影响检索本身
  }
  return "";
}

/**
 * 取工具的输出文本。
 *
 * on_tool_end 的 `data.output` 实测是 **ToolMessage 实例**（正文在 .content 上），
 * 不是字符串——原代码用 `as string` 把类型错误掩盖了，运行时取不到文本。
 * 兼容直接返回字符串的旧形态。
 */
function readToolOutput(output: unknown): string | undefined {
  if (typeof output === "string") return output;
  if (typeof output === "object" && output !== null && "content" in output && typeof output.content === "string") {
    return output.content;
  }
  return undefined;
}

export class AiEngine {
  /**
   * Agent 全局单例
   */
  private static readonly agent = createAgent({
    model: defaultModel,
    tools: [knowledgeSearchTool],
    systemPrompt,
  });

  /** 获取 agent（需要切换模型时创建新实例） */
  private getAgent(modelName?: string) {
    // 没有传模型名称或者本身就是默认模型，就直接返回，不需要重新创建。
    // ChatOpenAI / ChatOllama 都带 model 字段，基类类型没有，这里做局部断言。
    const currentModel = (defaultModel as { model?: string }).model;
    if (!modelName || modelName === currentModel) return AiEngine.agent;
    return createAgent({
      model: createModel(modelName),
      tools: [knowledgeSearchTool],
      systemPrompt,
    });
  }

  /**
   * 普通对话
   */
  async chat(input: string, options: ChatOptions = {}): Promise<string> {
    const messages = [...toLangChainMessages(options.history ?? []), new HumanMessage(input)];

    const res = await this.getAgent(options.model).invoke(
      { messages },
      { configurable: { kbIds: options.kbIds } },
    );

    const last = res.messages.at(-1);

    return typeof last?.content === "string" ? last.content : JSON.stringify(last?.content);
  }

  /**
   * 流式对话
   */
  async *stream(input: string, options: ChatOptions = {}): AsyncGenerator<string> {
    const messages = [...toLangChainMessages(options.history ?? []), new HumanMessage(input)];

    const stream = await this.getAgent(options.model).stream(
      { messages },
      { streamMode: "messages", configurable: { kbIds: options.kbIds } },
    );

    for await (const [chunk] of stream) {
      if (typeof chunk.content === "string") {
        yield chunk.content;
      }
    }
  }

  /**
   * 流式对话 + 观察整个执行过程（token + tool + chain）
   *
   * 流式是 AsyncGenerator，包不进 withTaskEvents，手动发三段生命周期事件：
   * started → （逐 token 流式）→ completed / failed。
   * 工具调用的明细不再单独 emit——前端经 SSE 的 tool_start/tool_end 已能看到。
   *
   * 检索完全交给 agent：这里不做预检索，由模型自行决定是否调用检索工具。
   * 检索作用域（kbIds）与结果归属都经 `configurable` 下传给工具，
   * 结果写在每次调用新建的 `retrieval` 对象上——不用模块级变量，并发会话不会互相污染。
   */
  async *streamEvents(input: string, options: ChatOptions = {}): AsyncGenerator<StreamEvent> {
    const taskId = newTaskId(TaskType.CHAT);
    const startedAt = Date.now();
    emit(TaskEvent.STARTED, { taskId, taskType: TaskType.CHAT, message: `对话：${input.slice(0, 50)}` });

    // 本次调用独有的检索作用域：工具写入、事件处理器读取，生命周期只覆盖这一个流
    const retrieval: RetrievalScope = { results: [] };

    try {
      const messages = [...toLangChainMessages(options.history ?? []), new HumanMessage(input)];

      const stream = await this.getAgent(options.model).streamEvents(
        { messages },
        { version: "v2", configurable: { kbIds: options.kbIds, retrieval } },
      );

      for await (const event of stream) {
        switch (event.event) {
          case "on_chat_model_stream": {
            const chunk = event.data.chunk;
            // 思考过程
            const reasoning = chunk.additional_kwargs?.reasoning || chunk.additional_kwargs?.reasoning_content;
            if (typeof reasoning === "string" && reasoning) {
              yield { type: "reasoning", content: reasoning };
            }
            if (typeof chunk.content === "string" && chunk.content) {
              yield { type: "token", content: chunk.content };
            }
            break;
          }
          // 知识库检索工具 → 专用事件，前端可展示检索状态 + 知识库名称
          case "on_tool_start":
            if (event.name === "search_knowledge_base") {
              // kbIds 取自本次请求的作用域，不是模型填的（模型无权改变检索范围）
              yield { type: "knowledge_search", query: readQuery(event.data), kbIds: options.kbIds };
            } else {
              yield { type: "tool_start", name: event.name };
            }
            break;
          case "on_tool_end":
            if (event.name === "search_knowledge_base") {
              // docs 是本次流**累计**的检索结果（模型可能并行/重试多次），
              // 不是本次调用独有的——已实测模型会并行发起两次检索，
              // 若按调用覆盖收集，先发起那次的结果会丢，最终来源不全。
              const docs = retrieval.results;
              const kbNames = [...new Set(docs.map((r) => r.kbName).filter((name): name is string => typeof name === "string"))];
              yield {
                type: "knowledge_search",
                query: "",
                kbIds: options.kbIds,
                kbNames,
                results: readToolOutput(event.data.output),
                docs,
              };
            } else {
              yield {
                type: "tool_end",
                name: event.name,
                result: readToolOutput(event.data.output),
              };
            }
            break;
        }
      }

      emit(TaskEvent.COMPLETED, { taskId, taskType: TaskType.CHAT, durationMs: Date.now() - startedAt });
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      emit(TaskEvent.FAILED, { taskId, taskType: TaskType.CHAT, durationMs: Date.now() - startedAt, error: e.message, stack: e.stack });
      throw err;
    }
  }
}
