/**
 * 事件总线 holder
 *
 * shared 包**不持有** EventEmitter2 实例——@OnEvent 监听器绑定在 NestJS 创建的实例上，
 * 若 shared 另起实例，emit 与监听就不在同一注册表，事件收不到。
 * 因此后端 bootstrap 时把 NestJS 的实例注入进来，ai-engine 的 emit 转发到它。
 *
 * shared 零运行时依赖：只用结构化类型 EventBusLike，不 import eventemitter2。
 */

/** EventEmitter2 的结构化子集（duck typing，注入无需断言） */
export interface EventBusLike {
  /** 同步触发事件，返回是否有监听器收到 */
  emit(event: string, ...values: unknown[]): boolean;
}

/** 当前注入的事件总线实例（由后端 bootstrap 注入） */
let instance: EventBusLike | null = null;

/** 注入实例：main.ts 里 setEventBus(app.get(EventEmitter2)) */
export function setEventBus(emitter: EventBusLike): void {
  instance = emitter;
}

/** 触发事件（未注入实例时静默返回 false，ai-engine 可独立运行/单测） */
export function emit(event: string, ...args: unknown[]): boolean {
  return instance?.emit(event, ...args) ?? false;
}
