"use client";

/**
 * 任务事件流（SSE）订阅封装
 *
 * 与后端 `/api/events/stream` 对接，每条消息形如
 * `data: {"name":"task.started","payload":{...}}`。
 *
 * 说明：这里直连后端而非走 Next.js 的 `/api` rewrite —— SSE 经过中间代理
 * 可能被 buffer，导致进度一次性到达而非实时。部署到其他环境时用
 * NEXT_PUBLIC_API_ORIGIN 覆盖即可。
 */

import { useEffect, useRef, useState } from "react";

/** 任务事件载荷 —— 与 backend `@langchain-rag/shared/events` 的 TaskEventPayload 对齐 */
export interface TaskStreamPayload {
  taskId: string;
  taskType: string;
  message?: string;
  kbId?: number;
  documentId?: number;
  kbIds?: number[];
  step?: number;
  total?: number;
  durationMs?: number;
  result?: unknown;
  error?: string;
  stack?: string;
}

/** 任务事件名 —— 与 backend TaskEvent 常量对齐 */
export const TaskEventName = {
  STARTED: "task.started",
  PROGRESS: "task.progress",
  COMPLETED: "task.completed",
  FAILED: "task.failed",
} as const;

/** 心跳事件名，前端忽略 */
const PING = "ping";

export interface TaskStreamMessage {
  name: string;
  payload: TaskStreamPayload | null;
}

export interface UseTaskEventStreamOptions {
  /** 只订阅这些任务类型（如 ["document_index"]）；省略表示订阅全部 */
  types?: string[];
  /** 是否建立连接（false 时断开），通常跟随弹窗 open 状态 */
  enabled: boolean;
  /** 收到事件时回调（心跳已过滤） */
  onMessage: (message: TaskStreamMessage) => void;
}

export interface UseTaskEventStreamResult {
  /** 连接是否已建立 */
  connected: boolean;
  /** 连接异常提示（已连接时为 null），供界面直接展示 */
  error: string | null;
}

/** 后端端口，与 apps/backend 默认 PORT 对齐 */
const BACKEND_PORT = 3001;

/**
 * 后端事件流地址
 *
 * 用当前页面的 hostname 推导，而不是写死 localhost —— 从 127.0.0.1 或
 * Next 启动时打印的局域网地址打开页面时，写死 localhost 会让 EventSource
 * 连到「客户端自己的 localhost:3001」，连接失败且被 CORS 拦掉，
 * 表现为「点了上传没有任何消息推送」。
 */
function buildUrl(typesKey: string): string {
  const base = process.env.NEXT_PUBLIC_API_ORIGIN ?? `http://${window.location.hostname}:${BACKEND_PORT}`;
  const suffix = typesKey ? `/api/events/stream?types=${encodeURIComponent(typesKey)}` : "/api/events/stream";
  return `${base}${suffix}`;
}

/** 运行时校验，避免把非预期结构当作任务事件消费 */
function isStreamMessage(value: unknown): value is TaskStreamMessage {
  if (typeof value !== "object" || value === null) return false;
  return "name" in value && typeof value.name === "string";
}

/**
 * 订阅后端任务事件流
 *
 * 回调用 ref 持有，因此 onMessage 每次渲染变化不会重建连接；
 * 只有 enabled / types 变化才会重连。
 */
export function useTaskEventStream({ types, enabled, onMessage }: UseTaskEventStreamOptions): UseTaskEventStreamResult {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  const typesKey = types?.join(",") ?? "";

  useEffect(() => {
    if (!enabled) return;

    const url = buildUrl(typesKey);
    const source = new EventSource(url);

    source.onopen = () => {
      setConnected(true);
      setError(null);
    };

    source.onerror = () => {
      setConnected(false);
      // readyState === CLOSED 说明是致命错误（连不上 / 被 CORS 拦），浏览器不会重试；
      // CONNECTING 则是连接中断后的自动重连，属于可恢复状态。
      setError(
        source.readyState === EventSource.CLOSED
          ? `无法连接事件流 ${url}，进度将不会实时更新`
          : "事件流连接中断，正在重连…",
      );
    };

    source.onmessage = (event) => {
      const raw: unknown = event.data;
      if (typeof raw !== "string") return;

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return; // 非 JSON 帧，忽略
      }

      if (!isStreamMessage(parsed)) return;
      if (parsed.name === PING) return;

      handlerRef.current(parsed);
    };

    return () => {
      source.close();
      setConnected(false);
      setError(null);
    };
  }, [enabled, typesKey]);

  return { connected, error };
}
