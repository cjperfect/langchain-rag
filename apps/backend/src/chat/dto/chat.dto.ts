export class ChatDto {
  // 用户提示词
  prompt!: string;
  // 会话id
  chat_session_id?: number;
  // 是否开启思考模式
  thinking_enabled?: boolean;
  // 父级消息id
  parent_message_id?: number;
}

/**
 * SSE 流式事件（判别联合）
 *
 * event 对应 SSE 协议的 `event:` 行，data 对应 `data:` 行的 JSON 内容：
 *   event: session
 *   data: {"session_id":42}
 */
export type ChatStreamEvent =
  | { event: "session"; data: { session_id: number } } // 首条事件：会话 ID
  | { event: "message"; data: { content: string } } // 增量内容
  | { event: "done"; data: { request_message_id: number; response_message_id: number } } // 结束事件：本轮问答的消息 ID
  | { event: "error"; data: { error: string } }; // 出错事件
