export interface CreateConversationDto {
  /** 会话标题 */
  title?: string;
  /** 系统提示词 */
  systemPrompt?: string;
  /** 关联的知识库 ID */
  knowledgeId?: number;
}

export interface UpdateConversationDto {
  /** 会话标题 */
  title?: string;
  /** 系统提示词 */
  systemPrompt?: string;
  /** 1=正常 2=归档 3=删除 */
  status?: number;
}

export interface GenerateTitleDto {
  /** 会话中的消息（用于 AI 生成标题） */
  messages: { role: "user" | "assistant" | "system"; content: string }[];
}
