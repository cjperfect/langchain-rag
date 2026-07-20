// ============================================================================
// 聊天 / 会话相关类型
// ============================================================================

/** assistant-ui RemoteThreadListAdapter 元数据 */
export interface RemoteThreadMetadata {
  /** 会话状态：regular=正常 archived=归档 */
  readonly status: "regular" | "archived";
  /** 后端会话 ID（转为字符串） */
  readonly remoteId: string;
  /** 外部 ID（可选） */
  readonly externalId?: string | undefined;
  /** 会话标题 */
  readonly title?: string | undefined;
  /** 最后一条消息时间 */
  readonly lastMessageAt?: Date | undefined;
  /** 自定义扩展字段 */
  readonly custom?: Record<string, unknown> | undefined;
}

/** 远程会话列表响应 */
export interface RemoteThreadListResponse {
  /** 会话元数据数组 */
  threads: RemoteThreadMetadata[];
  /** 分页游标（可选，用于加载更多） */
  nextCursor?: string | undefined;
}

// ============================================================================
// 后端 DTO
// ============================================================================

/** 后端返回的会话/对话记录 */
export interface ConversationItem {
  /** 会话 ID */
  id: number;
  /** 会话标题（可为空） */
  title: string | null;
  /** 会话状态：1=正常 2=归档 */
  status: number;
  /** 消息总数 */
  messageCount: number;
  /** Token 消耗总量 */
  totalTokens: number;
  /** 分支数量 */
  branchCount: number;
  /** 最后一条消息时间 */
  lastMessageAt: string | null;
  /** 创建时间 */
  createdAt: string;
  /** 关联知识库 ID（null = 普通会话） */
  knowledgeId?: number | null;
  /** 知识库名称（后端 join 返回） */
  knowledge?: { name: string } | null;
}

/** 后端返回的消息记录 */
export interface BackendMessage {
  /** 消息 ID */
  id: number;
  /** 角色：user=用户 assistant=助手 system=系统 */
  role: "user" | "assistant" | "system";
  /** 消息正文（可为空） */
  content: string | null;
  /** 父消息 ID（用于构建对话树） */
  parentId: number | null;
  /** 根消息 ID */
  rootId: number | null;
  /** 消息类型标识 */
  messageType: string;
  /** 消息状态 */
  status: number;
  /** 创建时间 */
  createdAt: string;
  /** 推理过程内容（深度思考模型专用） */
  reasoningContent?: string | null;
  /** Token 消耗数 */
  tokenCount?: number;
}
