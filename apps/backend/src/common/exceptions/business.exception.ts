import { HttpException, HttpStatus } from "@nestjs/common";
import { ErrorCode } from "@langchain-rag/shared";

/**
 * 根据 ErrorCode 推导 HTTP 状态码
 *
 *   0        → 200
 *   4xx/5xx  → 直接用值
 *   10xxx    → 401/409
 *   20xxx    → 404/403
 *   30xxx    → 400/404
 *   其他     → 400
 */
function deriveHttpStatus(code: ErrorCode): number {
  if (code === ErrorCode.SUCCESS) return HttpStatus.OK;
  if (code >= 400 && code < 600) return code; // HTTP 状态码直接复用
  if (code >= 10001 && code <= 10099) return HttpStatus.UNAUTHORIZED;
  if (code >= 20001 && code <= 20099) return HttpStatus.NOT_FOUND;
  if (code >= 30001 && code <= 30099) return HttpStatus.BAD_REQUEST;
  if (code >= 50001 && code <= 50099) return HttpStatus.INTERNAL_SERVER_ERROR;
  return HttpStatus.BAD_REQUEST;
}

/**
 * 业务异常
 *
 * 用法：
 *   throw Exceptions.notFound(ErrorCode.CONVERSATION_NOT_FOUND, "会话不存在");
 *   throw Exceptions.unauthorized(ErrorCode.TOKEN_EXPIRED, "Token 已过期");
 *   throw new BusinessException(ErrorCode.WEAK_PASSWORD, "密码至少 8 位");
 */
export class BusinessException extends HttpException {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string, httpStatus?: number) {
    super(message, httpStatus ?? deriveHttpStatus(code));
    this.code = code;
  }
}

/** 按 HTTP 语义分组的快捷工厂 */
export const Exceptions = {
  /** 400 参数错误 */
  badRequest: (code: ErrorCode, message: string) =>
    new BusinessException(code, message, HttpStatus.BAD_REQUEST),

  /** 401 未认证 */
  unauthorized: (code: ErrorCode, message = "请先登录") =>
    new BusinessException(code, message, HttpStatus.UNAUTHORIZED),

  /** 403 无权限 */
  forbidden: (code: ErrorCode, message = "无权操作") =>
    new BusinessException(code, message, HttpStatus.FORBIDDEN),

  /** 404 资源不存在 */
  notFound: (code: ErrorCode, message = "资源不存在") =>
    new BusinessException(code, message, HttpStatus.NOT_FOUND),

  /** 409 冲突 */
  conflict: (code: ErrorCode, message: string) =>
    new BusinessException(code, message, HttpStatus.CONFLICT),

  /** 500 服务端错误 */
  internal: (code: ErrorCode, message = "服务器内部错误") =>
    new BusinessException(code, message, HttpStatus.INTERNAL_SERVER_ERROR),
};
