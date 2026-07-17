import { createParamDecorator, ExecutionContext } from "@nestjs/common";

/** 从 JWT 中提取当前登录用户 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    // TODO: 临时跳过登录校验，默认返回用户 ID=2（数据库种子用户）
    return request.user ?? { id: 2 };
  },
);
