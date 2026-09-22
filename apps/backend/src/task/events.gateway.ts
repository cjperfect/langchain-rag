import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { Subject, type Observable } from "rxjs";
import { TaskEvent } from "@langchain-rag/shared/events";
import type { TaskEventPayload } from "@langchain-rag/shared/events";

/** 推送给前端的消息体：事件名 + 原始 payload */
export interface TaskStreamMessage {
  name: string;
  payload: TaskEventPayload;
}

/** 心跳消息名（前端忽略） */
export const PING_EVENT = "ping";

/**
 * 任务事件推流网关
 *
 * 与 TaskListener 是同一个 EventEmitter2 实例上的**两个独立订阅者**：
 * TaskListener 负责控制台日志，本网关负责把事件多播给所有 SSE 连接。
 * 这正是事件总线（发布-订阅）的价值 —— 一份 emit，多个互不感知的订阅者。
 *
 * Subject 是热的多播流：每个 SSE 连接订阅的是同一个 Subject，
 * 客户端断开只会 unsubscribe 它自己，不影响其他连接与网关本身。
 */
@Injectable()
export class EventsGateway {
  private readonly subject = new Subject<TaskStreamMessage>();

  /** 供 SSE 控制器订阅的只读流 */
  get events$(): Observable<TaskStreamMessage> {
    return this.subject.asObservable();
  }

  // 四个精确订阅 —— 拆开写是因为 @OnEvent 的数组形式拿不到触发的事件名
  @OnEvent(TaskEvent.STARTED)
  onStarted(p: TaskEventPayload) {
    this.subject.next({ name: TaskEvent.STARTED, payload: p });
  }

  @OnEvent(TaskEvent.PROGRESS)
  onProgress(p: TaskEventPayload) {
    this.subject.next({ name: TaskEvent.PROGRESS, payload: p });
  }

  @OnEvent(TaskEvent.COMPLETED)
  onCompleted(p: TaskEventPayload) {
    this.subject.next({ name: TaskEvent.COMPLETED, payload: p });
  }

  @OnEvent(TaskEvent.FAILED)
  onFailed(p: TaskEventPayload) {
    this.subject.next({ name: TaskEvent.FAILED, payload: p });
  }
}
