export class CreateConversationDto {
  title?: string;
  systemPrompt?: string;
}

export class UpdateConversationDto {
  title?: string;
  systemPrompt?: string;
  /** 1=正常 2=归档 3=删除 */
  status?: number;
}

export class GenerateTitleDto {
  /** 会话中的消息（用于 AI 生成标题） */
  messages!: { role: "user" | "assistant" | "system"; content: string }[];
}
