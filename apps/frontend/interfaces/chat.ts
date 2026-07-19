// ============================================================================
// 聊天 / 会话相关类型
// ============================================================================

/** assistant-ui RemoteThreadListAdapter 元数据类型 */
export interface RemoteThreadMetadata {
  readonly status: "regular" | "archived";
  readonly remoteId: string;
  readonly externalId?: string | undefined;
  readonly title?: string | undefined;
  readonly lastMessageAt?: Date | undefined;
  readonly custom?: Record<string, unknown> | undefined;
}

export interface RemoteThreadListResponse {
  threads: RemoteThreadMetadata[];
  nextCursor?: string | undefined;
}

// ============================================================================
// 后端 DTO
// ============================================================================

export interface ConversationItem {
  id: number;
  title: string | null;
  status: number; // 1=正常 2=归档
  messageCount: number;
  totalTokens: number;
  branchCount: number;
  lastMessageAt: string | null;
  createdAt: string;
}

export interface BackendMessage {
  id: number;
  role: "user" | "assistant" | "system";
  content: string | null;
  parentId: number | null;
  rootId: number | null;
  messageType: string;
  status: number;
  createdAt: string;
  reasoningContent?: string | null;
  tokenCount?: number;
}
