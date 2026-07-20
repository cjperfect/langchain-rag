export interface SendMessageDto {
  /** 消息内容 */
  content: string;
  /** text / image / file */
  messageType?: string;
  /** 在哪个分支根节点下发送 */
  rootId?: number;
}

export interface EditMessageDto {
  /** 新内容 */
  content: string;
}

export interface SwitchBranchDto {
  /** 目标消息 ID */
  messageId: number;
}
