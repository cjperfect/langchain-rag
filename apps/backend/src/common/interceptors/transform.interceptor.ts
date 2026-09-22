import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

/**
 * @Sse 装饰器写入的元数据键，与 @nestjs/common 的 constants.SSE_METADATA 保持一致。
 * 这里用字面量而非 import 内部子路径，避免 NestJS 收紧 package exports 后失效。
 */
const SSE_METADATA = "__sse__";

/**
 * 判断当前请求是否为 SSE 端点。
 *
 * 双条件：以 @Sse 写入的元数据为主；再用 Accept 头兜底
 * （浏览器 EventSource 固定发送 Accept: text/event-stream）。
 */
function isSseRequest(context: ExecutionContext): boolean {
  if (Reflect.getMetadata(SSE_METADATA, context.getHandler()) === true) return true;

  const request = context.switchToHttp().getRequest<{ headers?: { accept?: string } }>();
  return request.headers?.accept?.includes("text/event-stream") ?? false;
}

/** 统一响应格式 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

/**
 * 响应拦截器 — 将所有成功返回包装为 { code, message, data }
 *
 * 如果 controller 返回的已经是 ApiResponse 格式（含 code 字段），则直接透传。
 *
 * SSE 端点跳过包装：它的每一个 emission 本身就是一条完整的响应消息，
 * 若被包成 { code, message, data }，前端拿到的将是嵌套结构而无法解析。
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    if (isSseRequest(context)) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        // 已经是标准格式则透传（某些场景下手动构造了响应体）
        if (data && typeof data === "object" && "code" in data && "message" in data) {
          return data as ApiResponse<T>;
        }

        return {
          code: 200,
          message: "success",
          data: data ?? null,
        };
      }),
    );
  }
}
