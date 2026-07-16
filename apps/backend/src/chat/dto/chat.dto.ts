export class ChatDto {
  // 用户提示词
  prompt: string;
  // 聊天会话 id
  chat_session_id: string;
  // 是否开启思考模式
  thinking_enabled: boolean;

  constructor(prompt: string, chat_session_id: string, thinking_enabled: boolean) {
    this.prompt = prompt;
    this.chat_session_id = chat_session_id;
    this.thinking_enabled = thinking_enabled;
  }
}
