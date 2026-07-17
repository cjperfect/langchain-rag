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
// 共享的 threadId → conversationId 映射表
// 供 chat-adapter 在发送消息时查找当前线程对应的后端会话 ID
// ---------------------------------------------------------------------------
const threadToConversation = new Map<string, number>();

/** 注册线程 ID 与会话 ID 的映射（新线程 initialize 时调用） */
export function registerThreadConversation(threadId: string, conversationId: number): void {
  threadToConversation.set(threadId, conversationId);
}

/** 根据线程 ID 查找对应的会话 ID，找不到返回 null */
export function getConversationId(threadId: string): number | null {
  // 1) 直接命中
  if (threadToConversation.has(threadId)) return threadToConversation.get(threadId)!;

  // 2) threadId 本身可能就是一个数字字符串（remoteId = conversationId）
  const parsed = parseInt(threadId, 10);
  if (!isNaN(parsed)) {
    threadToConversation.set(threadId, parsed);
    return parsed;
  }

  return null;
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
    const threads = data.map(toMetadata);
    // 为已有会话注册映射（remoteId 就是 conversation ID）
    for (const c of data) {
      threadToConversation.set(String(c.id), c.id);
    }
    return { threads };
    // TODO: 后端支持游标分页后可返回 nextCursor
  },

  /** 新建会话 — 不调后端，会话由 /api/chat 在首条消息时自动创建 */
  async initialize(
    threadId: string,
  ): Promise<{ remoteId: string; externalId: string | undefined }> {
    // 先用 threadId 占位，chat-adapter 收到 SSE session 事件后注册真实映射
    return { remoteId: threadId, externalId: undefined };
  },

  /** 获取单个会话元数据 */
  async fetch(threadId: string): Promise<RemoteThreadMetadata> {
    const id = parseInt(threadId, 10);
    const conv = await get<ConversationItem>(`/conversations/${id}`);
    threadToConversation.set(threadId, conv.id);
    return toMetadata(conv);
  },

  /** 重命名 */
  async rename(remoteId: string, newTitle: string): Promise<void> {
    await patch(`/conversations/${remoteId}`, { title: newTitle });
  },

  /** 删除 */
  async delete(remoteId: string): Promise<void> {
    await del(`/conversations/${remoteId}`);
    // 清理本地映射
    threadToConversation.delete(remoteId);
  },

  async generateTitle(
    remoteId: string,
    _unstable_messages,
  ): Promise<import("assistant-stream").AssistantStream> {
    // 提取消息文本（转为后端需要的 { role, content } 格式）
    const messagesForBackend = _unstable_messages.map((m) => {
      const text = m.content
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join(" ");
      return { role: m.role, content: text };
    });

    // 新线程的 remoteId 是 localUUID，需要先查真实会话 ID
    const realId = getConversationId(remoteId) ?? remoteId;

    // 有真实会话 ID 时调后端 AI 生成标题
    if (typeof realId === "number" || realId !== remoteId) {
      try {
        const { title } = await post<{ title: string }>(`/conversations/${realId}/generate-title`, {
          messages: messagesForBackend,
        });
        if (title) {
          return createAssistantStream((controller) => {
            controller.appendText(title);
          });
        }
      } catch {
        /* 调后端失败则走 fallback */
      }
    }

    // fallback：从最后一条用户消息提取前 50 字
    try {
      const userMessages = _unstable_messages.filter((m) => m.role === "user");
      if (userMessages.length > 0) {
        const lastUser = userMessages[userMessages.length - 1];
        const text = lastUser.content
          .filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text)
          .join(" ")
          .slice(0, 50);
        if (text) {
          return createAssistantStream((controller) => {
            controller.appendText(text);
          });
        }
      }
    } catch {
      /* 忽略 */
    }

    // 最终 fallback
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
