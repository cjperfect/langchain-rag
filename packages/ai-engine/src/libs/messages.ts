import { ContextMessage } from "@langchain-rag/shared/interfaces";
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";

/** 将通用消息格式转为 LangChain BaseMessage */
export function toLangChainMessages(messages: ContextMessage[]): BaseMessage[] {
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
