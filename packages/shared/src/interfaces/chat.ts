/** 后端传入的上下文消息格式（与 LangChain 解耦） */
export interface ContextMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatOptions {
  history?: ContextMessage[];
  model?: string;
}
