import { createParamDecorator, ExecutionContext } from "@nestjs/common";

/** 从 JWT 中提取当前登录用户 */
export const CurrentUser = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  // TODO: 临时跳过登录校验，
  return request.user ?? { id: 1 };
});
