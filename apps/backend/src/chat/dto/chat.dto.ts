export class ChatDto {
  // 用户提示词
  prompt!: string;
  // 会话id（前端 initialize 已创建，必传）
  chat_session_id!: number;
  // 是否开启思考模式
  thinking_enabled?: boolean;
  // 父级消息id
  parent_message_id?: number;
}

/**
 * SSE 流式事件
 */
export type ChatStreamEvent =
  | { event: "message"; data: { content: string } }
  | { event: "done"; data: { request_message_id: number; response_message_id: number } }
  | { event: "error"; data: { error: string } };
