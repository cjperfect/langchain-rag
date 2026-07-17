import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { createAgent } from "langchain";

import { model } from "./model";
import { systemPrompt } from "../prompts";
import { activitySqlTool } from "../tools/activity-sql";

/** 后端传入的上下文消息格式（与 LangChain 解耦） */
export interface ContextMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatOptions {
  history?: ContextMessage[];
}

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

export class AiEngine {
  /**
   * Agent 全局单例
   */
  private static readonly agent = createAgent({
    model,
    tools: [activitySqlTool],
    systemPrompt,
  });

  /**
   * 普通对话
   */
  async chat(input: string, options: ChatOptions = {}): Promise<string> {
    const messages = [...toLangChainMessages(options.history ?? []), new HumanMessage(input)];

    const res = await AiEngine.agent.invoke({
      messages,
    });

    const last = res.messages.at(-1);

    return typeof last?.content === "string" ? last.content : JSON.stringify(last?.content);
  }

  /**
   * LangChain Stream
   */
  async *stream(input: string, options: ChatOptions = {}): AsyncGenerator<string> {
    const messages = [...toLangChainMessages(options.history ?? []), new HumanMessage(input)];

    const stream = await AiEngine.agent.stream(
      { messages },
      {
        streamMode: "messages",
      },
    );

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
    | {
        type: "token";
        content: string;
      }
    | {
        type: "tool_start";
        name?: string;
      }
    | {
        type: "tool_end";
        name?: string;
      }
  > {
    const messages = [...toLangChainMessages(options.history ?? []), new HumanMessage(input)];

    const stream = await AiEngine.agent.streamEvents(
      { messages },
      {
        version: "v2",
      },
    );

    for await (const event of stream) {
      switch (event.event) {
        case "on_chat_model_stream": {
          const content = event.data.chunk.content;

          if (typeof content === "string") {
            yield {
              type: "token",
              content,
            };
          }

          break;
        }

        case "on_tool_start":
          yield {
            type: "tool_start",
            name: event.name,
          };
          break;

        case "on_tool_end":
          yield {
            type: "tool_end",
            name: event.name,
          };
          break;
      }
    }
  }
}
