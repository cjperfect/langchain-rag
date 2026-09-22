/**
 * 任务状态事件 —— 统一 task.* 命名空间
 *
 * 设计原则：一份扁平 payload 携带各阶段字段（可选），监听器无需按事件名窄化类型；
 * withTaskEvents 帮手包揽 started / completed / failed 三段生命周期，
 * 业务代码只写 run 回调，需要中间进度时手动 emit PROGRESS 即可。
 */
import { emit } from "./event-bus";

/**
 * 任务类型枚举
 *
 * - DOCUMENT_INDEX：文档切片 + 向量化（RagService）
 * - RAG_SEARCH：向量检索（RagService.search）
 * - CHAT：Agent 流式对话（AiEngine.streamEvents）
 */
export enum TaskType {
  /** 文档索引 */
  DOCUMENT_INDEX = "document_index",
  /** RAG 检索 */
  RAG_SEARCH = "rag_search",
  /** 对话流式 */
  CHAT = "chat",
}

/** 任务事件名常量（as const 保留字面量类型，供 @OnEvent 精确匹配） */
export const TaskEvent = {
  /** 任务开始 */
  STARTED: "task.started",
  /** 任务进度更新 */
  PROGRESS: "task.progress",
  /** 任务成功完成 */
  COMPLETED: "task.completed",
  /** 任务失败 */
  FAILED: "task.failed",
} as const;

/** 任务事件载荷（各阶段字段可选，四种事件共用） */
export interface TaskEventPayload {
  /** 任务唯一 ID */
  taskId: string;
  /** 任务类型 */
  taskType: TaskType;
  /** 人类可读描述（便于日志展示） */
  message?: string;
  /** 关联知识库 ID（索引/检索任务） */
  kbId?: number;
  /** 关联文档 ID（索引任务） */
  documentId?: number;
  /** 关联知识库 ID 列表（检索任务） */
  kbIds?: number[];
  /** 当前步骤序号（progress 事件，从 1 开始） */
  step?: number;
  /** 总步骤数（progress 事件，可省略） */
  total?: number;
  /** 任务耗时毫秒（completed/failed 事件） */
  durationMs?: number;
  /** 任务产出（completed 事件；监听方注意截断展示，避免大对象刷屏） */
  result?: unknown;
  /** 错误信息（failed 事件） */
  error?: string;
  /** 错误堆栈（failed 事件） */
  stack?: string;
}

/** 生成任务唯一 ID（格式：taskType-uuid） */
export function newTaskId(taskType: TaskType): string {
  return `${taskType}-${globalThis.crypto.randomUUID()}`;
}

/**
 * 包揽任务生命周期事件：started → run() → completed / failed
 *
 * Promise 型任务直接包；AsyncGenerator（如流式对话）包不了，请手动 emit 三段。
 *
 * @param taskType 任务类型
 * @param context started 事件的附加上下文（kbId / documentId / message 等）
 * @param run 业务逻辑，入参 taskId 可用于 emit PROGRESS
 */
export async function withTaskEvents<T>(
  taskType: TaskType,
  context: { kbId?: number; documentId?: number; kbIds?: number[]; message?: string },
  run: (taskId: string) => Promise<T>,
): Promise<T> {
  const taskId = newTaskId(taskType);
  const startedAt = Date.now();

  emit(TaskEvent.STARTED, { taskId, taskType, ...context });

  try {
    const result = await run(taskId);
    emit(TaskEvent.COMPLETED, { taskId, taskType, durationMs: Date.now() - startedAt, result });
    return result;
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    emit(TaskEvent.FAILED, { taskId, taskType, durationMs: Date.now() - startedAt, error: e.message, stack: e.stack });
    throw err;
  }
}
