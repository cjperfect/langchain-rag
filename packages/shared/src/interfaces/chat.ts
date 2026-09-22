/** 后端传入的上下文消息格式（与 LangChain 解耦） */
export interface ContextMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatOptions {
  history?: ContextMessage[];
  model?: string;
  /**
   * 本次请求允许检索的知识库范围。
   *
   * 由调用方（后端）从会话配置得出，经 `configurable` 下传给 agent 的检索工具，
   * **不从模型输入取**——作用域是 harness 的职责，模型无权扩大检索范围。
   * 为空 / 未传表示「未指定知识库」，检索工具会 fail-closed 拒绝检索。
   */
  kbIds?: number[];
}
