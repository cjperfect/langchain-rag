import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { AppModule } from "./app.module";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { setEventBus } from "@langchain-rag/shared/events";

// Prisma Pg adapter 返回原生 bigint，JSON.stringify 默认不支持序列化。
// 添加全局 toJSON 将 BigInt 转为 Number（PRISMA 的 id 在安全范围内）。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

/** 允许的前端源（逗号分隔），默认覆盖 localhost 与 127.0.0.1 两种写法 */
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN ?? "http://localhost:3000,http://127.0.0.1:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

/**
 * 是否为本机/局域网源
 *
 * 开发期前端可能从 127.0.0.1 或 Next 打印的局域网地址（如 192.168.x.x:3000）访问，
 * 硬编码单个 origin 会让这些访问被 CORS 拦掉 —— 表现为 SSE 连不上、进度不推送。
 * 生产环境（NODE_ENV=production）不放开这条宽松规则。
 */
function isPrivateNetworkOrigin(origin: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(origin).hostname;
  } catch {
    return false;
  }

  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return true;

  // RFC1918 私有网段：10.0.0.0/8、172.16.0.0/12、192.168.0.0/16
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 全局响应拦截器 — 统一返回 { code, message, data }
  app.useGlobalInterceptors(new TransformInterceptor());

  // 全局异常过滤器 — 统一返回 { code, message, data: null }
  app.useGlobalFilters(new HttpExceptionFilter());

  const isProd = process.env.NODE_ENV === "production";

  app.enableCors({
    origin: (origin, callback) => {
      // 无 Origin 头的请求（curl、同源、SSE 直连）一律放行
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      if (!isProd && isPrivateNetworkOrigin(origin)) return callback(null, true);
      callback(null, false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
    credentials: true,
  });

  // 把 NestJS EventEmitterModule 创建的 EventEmitter2 实例注入 shared holder。
  // 之后 ai-engine 调用 emit(...) 会转发到该实例，与本处 @OnEvent 监听器同源同实例。
  setEventBus(app.get(EventEmitter2));

  console.log("Server is running on port:", process.env.PORT ?? 3001);
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
