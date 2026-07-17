import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

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
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
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
