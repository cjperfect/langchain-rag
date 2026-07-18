import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";

import { model as defaultModel } from "./model";
import { systemPrompt } from "../prompts";
import { activitySqlTool } from "../tools/activity-sql";
import type { ContextMessage, ChatOptions } from "@langchain-rag/shared/interfaces";

/** 将通用消息格式转为 LangChain BaseMessage */
function toLangChainMessages(messages: ContextMessage[]): BaseMessage[] {
  return messages.map((m) => {
    switch (m.role) {
      case "user":
        return new HumanMessage(m.content);
      case "assistant":
        return new AIMessage(m.content);
      case "system":
        return new SystemMessage(m.content);
    }
  });
}

/** 按模型名创建 ChatOpenAI 实例 */
function createModel(modelName?: string): ChatOpenAI {
  if (!modelName || modelName === defaultModel.model) return defaultModel;
  return new ChatOpenAI({
    model: modelName,
    apiKey: process.env.DEEPSEEK_API_KEY,
    temperature: 0.7,
    maxTokens: 1024,
    timeout: 60000,
    configuration: { baseURL: "https://api.deepseek.com" },
  });
}

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
   * LangChain Stream
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
   * Stream Events
   */
  async *streamEvents(
    input: string,
    options: ChatOptions = {},
  ): AsyncGenerator<
    | { type: "token"; content: string }
    | { type: "reasoning"; content: string }
    | { type: "tool_start"; name?: string }
    | { type: "tool_end"; name?: string; result?: unknown }
  > {
    const messages = [...toLangChainMessages(options.history ?? []), new HumanMessage(input)];

    const stream = await this.getAgent(options.model).streamEvents({ messages }, { version: "v2" });

    for await (const event of stream) {
      switch (event.event) {
        case "on_chat_model_stream": {
          const chunk = event.data.chunk as Record<string, unknown>;
          // DeepSeek reasoning content
          const reasoning = (chunk.additional_kwargs as Record<string, unknown> | undefined)?.reasoning_content;
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
            result: (event.data as { output?: unknown }).output,
          };
          break;
      }
    }
  }
}
