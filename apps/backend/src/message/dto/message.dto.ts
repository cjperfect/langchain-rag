export class SendMessageDto {
  content!: string;
  /** text / image / file */
  messageType?: string;
  /** 在哪个分支根节点下发送 */
  rootId?: number;
}

export class EditMessageDto {
  content!: string;
}

export class SwitchBranchDto {
  messageId!: number;
}
