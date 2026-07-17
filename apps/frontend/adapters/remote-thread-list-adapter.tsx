/**
 * RemoteThreadListAdapter — 将后端 /api/conversations 适配为 assistant-ui
 * useRemoteThreadListRuntime 所需的 RemoteThreadListAdapter 接口。
 *
 * - remoteId: 后端会话 ID 转为字符串
 * - status:   后端 1→"regular", 2→"archived"
 */
"use client";

import type { RemoteThreadListAdapter, ThreadHistoryAdapter } from "@assistant-ui/react";
import { RuntimeAdapterProvider, useThreadListItemRuntime } from "@assistant-ui/react";
import { createAssistantStream } from "assistant-stream";
import type { ExportedMessageRepository } from "@assistant-ui/react";
import { get, post, patch, del } from "@/lib/api";
import { useMemo, type FC, type PropsWithChildren } from "react";

// ---------------------------------------------------------------------------
// assistant-ui 用到的类型（未从 @assistant-ui/react 单独导出，本地声明）
// ---------------------------------------------------------------------------
interface RemoteThreadMetadata {
  readonly status: "regular" | "archived";
  readonly remoteId: string;
  readonly externalId?: string | undefined;
  readonly title?: string | undefined;
  readonly lastMessageAt?: Date | undefined;
  readonly custom?: Record<string, unknown> | undefined;
}

interface RemoteThreadListResponse {
  threads: RemoteThreadMetadata[];
  nextCursor?: string | undefined;
}

// ---------------------------------------------------------------------------
// 后端返回的原始类型
// ---------------------------------------------------------------------------
interface ConversationItem {
  id: number;
  title: string | null;
  model: string;
  status: number; // 1=正常 2=归档
  messageCount: number;
  totalTokens: number;
  branchCount: number;
  lastMessageAt: string | null;
  createdAt: string;
}

/** 后端消息原始类型 */
interface BackendMessage {
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

// ---------------------------------------------------------------------------
// HistoryProvider — 点击会话时从后端加载历史消息
// ---------------------------------------------------------------------------
const HistoryProvider: FC<PropsWithChildren> = ({ children }) => {
  const runtime = useThreadListItemRuntime();
  const remoteId = runtime.getState().remoteId ?? "";

  const history = useMemo<ThreadHistoryAdapter>(
    () => ({
      async load(): Promise<ExportedMessageRepository> {
        const convId = getConversationId(remoteId);
        if (!convId) return { messages: [] };

        try {
          const msgs = await get<BackendMessage[]>(`/conversations/${convId}/messages`);
          if (!msgs.length) return { messages: [] };

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const items = msgs.map((m) => ({
            parentId: m.parentId ? String(m.parentId) : null,
            message: {
              id: String(m.id),
              role: m.role,
              content: [{ type: "text" as const, text: m.content ?? "" }],
              metadata: { custom: {} },
              status: { type: "complete" as const },
            } as any,
          }));

          return {
            headId: String(msgs[msgs.length - 1].id),
            messages: items as any,
          };
        } catch {
          return { messages: [] };
        }
      },

      async append() {
        // 消息由 chat-adapter 的 SSE 流处理
      },
    }),
    [remoteId],
  );

  return <RuntimeAdapterProvider adapters={{ history }}>{children}</RuntimeAdapterProvider>;
};

// ---------------------------------------------------------------------------
// threadId → conversationId 映射
// initialize 是唯一创建入口，remoteId 始终是后端数字 ID
//
// 注意：initialize 后 React 尚未 re-render，useLocalRuntime 里的
// useAuiState(remoteId) 可能仍是旧值。用 lastCreatedId 兜底。
// ---------------------------------------------------------------------------
let lastCreatedId: number | null = null;

/** 根据 remoteId 解析会话 ID */
export function getConversationId(remoteId: string | undefined): number | null {
  if (remoteId) {
    const parsed = parseInt(remoteId, 10);
    if (!isNaN(parsed)) return parsed;
  }
  // fallback：initialize 刚创建但 React 还没 re-render
  return lastCreatedId;
}

// ---------------------------------------------------------------------------
// 格式转换
// ---------------------------------------------------------------------------
const toMetadata = (c: ConversationItem): RemoteThreadMetadata => ({
  remoteId: String(c.id),
  title: c.title ?? "新会话",
  status: c.status === 2 ? "archived" : "regular",
  lastMessageAt: c.lastMessageAt ? new Date(c.lastMessageAt) : undefined,
  custom: {
    model: c.model,
    messageCount: c.messageCount,
    totalTokens: c.totalTokens,
    branchCount: c.branchCount,
  },
});

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------
export const remoteThreadListAdapter: RemoteThreadListAdapter = {
  /** 为每个活跃线程注入历史消息加载能力 */
  unstable_Provider: HistoryProvider,

  /** 获取会话列表 */
  async list(): Promise<RemoteThreadListResponse> {
    const data = await get<ConversationItem[]>("/conversations");
    return { threads: data.map(toMetadata) };
  },

  /** 新建会话 → POST /api/conversations */
  async initialize(
    _threadId: string,
  ): Promise<{ remoteId: string; externalId: string | undefined }> {
    const conv = await post<ConversationItem>("/conversations", { title: "新会话" });
    lastCreatedId = conv.id;
    return { remoteId: String(conv.id), externalId: undefined };
  },

  /** 获取单个会话元数据 */
  async fetch(threadId: string): Promise<RemoteThreadMetadata> {
    const id = parseInt(threadId, 10);
    const conv = await get<ConversationItem>(`/conversations/${id}`);
    return toMetadata(conv);
  },

  /** 重命名 */
  async rename(remoteId: string, newTitle: string): Promise<void> {
    await patch(`/conversations/${remoteId}`, { title: newTitle });
  },

  /** 删除 */
  async delete(remoteId: string): Promise<void> {
    await del(`/conversations/${remoteId}`);
  },

  async generateTitle(
    remoteId: string,
    _unstable_messages,
  ): Promise<import("assistant-stream").AssistantStream> {
    const messagesForBackend = _unstable_messages.map((m) => ({
      role: m.role,
      content: m.content
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join(" "),
    }));

    try {
      const { title } = await post<{ title: string }>(`/conversations/${remoteId}/generate-title`, {
        messages: messagesForBackend,
      });
      if (title) {
        return createAssistantStream((controller) => {
          controller.appendText(title);
        });
      }
    } catch {
      /* 后端已处理所有 fallback，这里忽略 */
    }

    return createAssistantStream((_controller) => {});
  },

  /** 归档 — 暂不启用 */
  async archive(_remoteId: string): Promise<void> {
    // no-op
  },

  /** 取消归档 */
  async unarchive(_remoteId: string): Promise<void> {
    // no-op
  },
};
