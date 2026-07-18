import { HumanMessage } from "@langchain/core/messages";
import { createAgent } from "langchain";
import { createModel, defaultModel } from "./model";
import { systemPrompt } from "../prompts";
import { activitySqlTool } from "../tools/activity-sql";
import type { ChatOptions } from "@langchain-rag/shared/interfaces";
import { toLangChainMessages } from "../libs/messages";
import { StreamEvent } from "../interfaces/message";

export class AiEngine {
  /**
   * Agent 全局单例
   */
  private static readonly agent = createAgent({
    model: defaultModel,
    tools: [activitySqlTool],
    systemPrompt,
  });

  /** 获取 agent（需要切换模型时创建新实例） */
  private getAgent(modelName?: string) {
    // 没有传模型名称或者本身就是默认模型，就直接返回，不需要重新创建
    if (!modelName || modelName === defaultModel.model) return AiEngine.agent;
    return createAgent({
      model: createModel(modelName),
      tools: [activitySqlTool],
      systemPrompt,
    });
  }

  /**
   * 普通对话
   */
  async chat(input: string, options: ChatOptions = {}): Promise<string> {
    const messages = [...toLangChainMessages(options.history ?? []), new HumanMessage(input)];

    const res = await this.getAgent(options.model).invoke({ messages });

    const last = res.messages.at(-1);

    return typeof last?.content === "string" ? last.content : JSON.stringify(last?.content);
  }

  /**
   * 流式对话
   */
  async *stream(input: string, options: ChatOptions = {}): AsyncGenerator<string> {
    const messages = [...toLangChainMessages(options.history ?? []), new HumanMessage(input)];

    const stream = await this.getAgent(options.model).stream({ messages }, { streamMode: "messages" });

    for await (const [chunk] of stream) {
      if (typeof chunk.content === "string") {
        yield chunk.content;
      }
    }
  }

  /**
   * 流式对话 + 观察整个执行过程（token + tool + chain）
   */
  async *streamEvents(input: string, options: ChatOptions = {}): AsyncGenerator<StreamEvent> {
    const messages = [...toLangChainMessages(options.history ?? []), new HumanMessage(input)];

    const stream = await this.getAgent(options.model).streamEvents({ messages }, { version: "v2" });

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
        case "on_tool_start":
          yield { type: "tool_start", name: event.name };
          break;
        case "on_tool_end":
          yield {
            type: "tool_end",
            name: event.name,
            result: event.data.output,
          };
          break;
      }
    }
  }
}
