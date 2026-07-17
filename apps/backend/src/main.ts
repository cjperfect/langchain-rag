import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

// Prisma Pg adapter 返回原生 bigint，JSON.stringify 默认不支持序列化。
// 添加全局 toJSON 将 BigInt 转为 Number（PRISMA 的 id 在安全范围内）。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 全局响应拦截器 — 统一返回 { code, message, data }
  app.useGlobalInterceptors(new TransformInterceptor());

  // 全局异常过滤器 — 统一返回 { code, message, data: null }
  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
    credentials: true,
  });

  console.log("Server is running on port:", process.env.PORT ?? 3001);
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
