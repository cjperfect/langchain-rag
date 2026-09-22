import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { TaskEvent } from "@langchain-rag/shared/events";
import type { TaskEventPayload } from "@langchain-rag/shared/events";

/** result 序列化截断，避免大对象刷屏 */
function brief(value: unknown): string {
  const text = JSON.stringify(value) ?? String(value);
  return text.length > 200 ? `${text.slice(0, 200)}…` : text;
}

/**
 * 任务事件监听器
 *
 * 监听 AI 引擎层 emit 的 task.* 事件（四种事件共用一份扁平 payload）。
 * 当前职责：结构化日志。后续可扩展为更新任务表、推送通知等。
 */
@Injectable()
export class TaskListener {
  private readonly logger = new Logger("TaskListener");

  @OnEvent(TaskEvent.STARTED)
  onStarted(p: TaskEventPayload) {
    this.logger.log(`任务开始 taskId=${p.taskId} type=${p.taskType}${p.message ? ` ${p.message}` : ""}`);
  }

  @OnEvent(TaskEvent.PROGRESS)
  onProgress(p: TaskEventPayload) {
    this.logger.log(`任务进度 taskId=${p.taskId} type=${p.taskType} step=${p.step ?? "?"}${p.message ? ` ${p.message}` : ""}`);
  }

  @OnEvent(TaskEvent.COMPLETED)
  onCompleted(p: TaskEventPayload) {
    this.logger.log(`任务完成 taskId=${p.taskId} type=${p.taskType} duration=${p.durationMs}ms${p.result != null ? ` result=${brief(p.result)}` : ""}`);
  }

  @OnEvent(TaskEvent.FAILED)
  onFailed(p: TaskEventPayload) {
    this.logger.error(`任务失败 taskId=${p.taskId} type=${p.taskType} duration=${p.durationMs}ms error=${p.error}`, p.stack);
  }
}
