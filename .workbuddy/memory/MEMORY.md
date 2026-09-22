# 项目长期笔记（langchain-rag）

## 架构决策

### 跨包事件总线（2026-09-14）
- **方案**：shared 导出函数式 holder（`setEventBus` + `emit`），backend bootstrap 时注入 NestJS 的 EventEmitter2 实例。**不**在 shared 持有自己的 EventEmitter2 实例（否则 emit 与 @OnEvent 不同实例，事件收不到）。
- **约束**：shared 用结构化类型 `EventBusLike`（只声明 `emit` 方法），零运行时依赖。
- **简化版（同日二稿）**：payload 合并为单一扁平接口 `TaskEventPayload`（四事件共用）；`withTaskEvents(taskType, context, run)` 帮手包揽 started/completed/failed，业务只需在 run 回调里按需 emit PROGRESS；AsyncGenerator（`AiEngine.streamEvents`）包不进，手动 emit 三段。`emitAsync` / `resetEventBus` / `TaskEventMap` / 四个分接口已删；`TaskModule` 删掉，`TaskListener` 直接挂 `AppModule` providers；`EventEmitterModule.forRoot({ global: true })` 不再开 wildcard（需要通配再手动加）。
- **emitDecoratorMetadata 陷阱**：backend 装饰方法参数类型必须用 `import type`（`TaskEventPayload`），运行时常量（`TaskEvent`）保留普通 import。

### SSE 实时推送（2026-09-14 追加）
- 补上「后端 → 浏览器」段：`EventsGateway`（RxJS Subject 多播，4 个 `@OnEvent` 精确订阅）+ `EventsController`（`@Sse` → `GET /api/events/stream?types=`）。与 `TaskListener` 并列，是同一 EventEmitter2 上的两个独立订阅者。
- **全局拦截器必须跳过 SSE**：`TransformInterceptor` 会把每条消息包成 `{code,message,data}`，前端拿到嵌套结构而全部丢弃。识别：`Reflect.getMetadata("__sse__", context.getHandler())`（`@Sse` 写入的元数据）为主，`Accept: text/event-stream` 兜底。
- 报文格式：`data: {"name":"task.started","payload":{...}}`；心跳 15s 一次（`name: "ping"`，前端忽略）。
- 前端**直连** 3001（`NEXT_PUBLIC_API_ORIGIN` 可覆盖），不走 Next rewrite —— SSE 过代理有 buffer 风险，进度会一次性到达而非实时。
- `@OnEvent` 的**数组形式拿不到事件名**，需要转发多事件时必须拆成多个方法。
- 上传弹窗在**打开时**就建 SSE 连接（上传接口同步等索引完成，晚连会丢开头事件），用首个 `task.started` 的 taskId 锚定本次任务。

### 环境约束：数据库必须带 pgvector（2026-09-14）
- `docker/docker-compose.yml` 必须用 `pgvector/pgvector:pg17`；官方 `postgres:17` **不含** vector 扩展。
- 缺失时的表现：上传文档 与 **删除文档** 均失败（`extension "vector" is not available`）——删除也会走 `RagService.deleteByDocumentId` 初始化向量库。
- **已修复（2026-09-14）**：容器已用 `pgvector/pgvector:pg17` 重建，命名卷 `docker_pgdata` 保留、数据无损；三份种子文档缺失的向量也已补齐（见下）。
- **本机 docker 的调用方式**：`docker` 不在 PATH（仅 `/opt/homebrew/bin/docker`），且该 CLI **没有 `compose` 子命令**；compose 插件在 `/opt/homebrew/lib/docker/cli-plugins/docker-compose`，直接用该二进制路径调用。
- 查数据库直连：`postgresql://root:chenjiang@localhost:5432/langchain_rag`（node `pg`，在 `apps/backend` 下跑才能解析到模块）。

### 索引失败不能静默（2026-09-14 定稿）
- `createDocument` 早期用 `indexDocument(...).catch(() => [])` 吞异常 → 文档记录照写、返回 201「成功」、`chunkCount: 0`，形成**列表里看得见但永远搜不到**的幽灵文档；删除时再撞同一个向量错误 → 500。
- 现约定：索引失败必须**回滚文档记录**（`discardUnindexedDocument`：尽力清向量 + 删切片 + 删文档行）并抛 `InternalServerErrorException("文档索引失败：<原因>")`，让 HTTP 层说真话。
- `updateDocument` 必须把 `reindexDocument` 放在 `deleteMany` 切片**之前**：否则索引失败会留下「内容还在、切片被清空」的静默数据丢失。
- 向量清理一律 best-effort（try/catch + warn）：失败点很可能就在「向量库还没写进去」，清理本身也会失败，不能盖住原始错误。
- 历史数据修复手段：对文档 `PATCH /api/knowledge/:kbId/documents/:docId` 带上原 content 即触发 `reindexDocument` 重建向量（无独立 reindex 端点）。

### SSE 跨主机与 CORS（2026-09-14 追加）
- 前端**按 `window.location.hostname` 推导后端地址**（`http://<hostname>:3001`），**不能写死 `localhost`**：从 `127.0.0.1` 或局域网地址打开页面时会去连「客户端自己的 localhost」，连不上且被 CORS 拦掉，表现就是**「点了上传没有任何消息推送」**。`NEXT_PUBLIC_API_ORIGIN` 可覆盖。
- `main.ts` 的 CORS：`CORS_ORIGIN` 支持逗号分隔多源（默认 `localhost:3000,127.0.0.1:3000`）；非 production 额外放行本机与 RFC1918 私网（`10.x` / `172.16-31.x` / `192.168.x`），生产不放开。
- `useTaskEventStream` 返回 `{ connected, error }`：`readyState === CLOSED` 是致命错误（CORS/连不上，浏览器不重试），`CONNECTING` 是自动重连中。UI 必须把连接状态显式画出来，否则用户无从判断。
- 弹窗 `catch` 里若已收到 SSE 的 `task.failed`，**不要覆盖**它的 error —— HTTP 层被全局过滤器抹成笼统的「服务器内部错误」。

## 包构建与运行
- shared / ai-engine 用 tsup 双格式（CJS + ESM）输出；backend 是 CJS（nodenext + resolvePackageJsonExports），ai-engine 是 ESM。

- 构建顺序：shared → ai-engine → backend。改 shared 后必须先 `pnpm build:shared` 再 build ai-engine。
- pnpm 命令需 `COREPACK_ENABLE_DOWNLOAD_PROMPT=0` 跳过 corepack 下载确认。
- backend 单独 typecheck：`cd apps/backend && pnpm exec tsc --noEmit -p tsconfig.json`。
- 全 workspace typecheck（`pnpm typecheck`）会因 frontend 预存的 getMarkdown 报错失败，与后端无关。
- **`nest start --watch` 对新增文件/模块改动的重载不可靠**：实测改了 `app.module.ts`、新增 controller 后旧进程仍在跑（端点 404 / 行为不变），而 `dist` 其实已更新。改完 backend 结构后请手动重启。
- 需要独立验证后端改动时，可另起临时实例避免打断开发中的进程：`cd apps/backend && PORT=3002 node dist/main.js`（先 `pnpm exec nest build`）。
- **上传的两条路径不同，别混淆**：HTTP 请求走 Next rewrite 代理（`api/knowledge-api.ts` 用相对路径 `fetch("/api/knowledge/...")` → `next.config.ts` 代理到 3001）；SSE 直连 3001。所以两个地方都要顾到：代理侧 `experimental.proxyClientMaxBodySize`，后端侧 `FileInterceptor({ limits: { fileSize } })`。
- **Next 请求体上限的选项名有坑**：警告文案链接的是 `middlewareClientMaxBodySize`，但该名在 Next 16 已废弃且**不在公开 `NextConfig` 类型里**（写顶层报 TS2353）。现行名是 `experimental.proxyClientMaxBodySize`，默认只透传 10MB，超出会被丢弃/连接重置 —— 表现为「点了上传，后端一条事件都没发」。

## 类型风格（项目内）
- 第三方库类型限制导致的单层 `as` 允许（如 langchain PGVectorStore 的 filter、Document.metadata），保留原作者写法。

## RAG 与 Agent 架构（2026-09-21 改造为纯 agentic）
- **已移除预检索，检索完全交给 agent**（应用户要求「改成 agentic RAG」）。`buildRagContext` / `<documents>` 注入 / `enhancedPrompt` 已全部删除。
  - 唯一检索入口：`packages/ai-engine/src/tools/knowledge-search.ts` 的 `search_knowledge_base`，agent 自行决定调不调、改写 query 重试（prompt 允许最多 2 次）。
  - `apps/backend/src/chat/chat.service.ts` 只负责传出 kbIds、转发事件、汇总来源落库。
  - system prompt 的「知识来源（唯一来源是检索工具，必须主动调用）」是新契约，改检索逻辑必须同步改它。
  - 实测模型会**并行发起 2 次检索**（同一轮两个 on_tool_start 都早于 on_tool_end），这是 agentic 的正常行为。
- **per-request 上下文通道（取代模块级共享变量）**：`ChatOptions` 加 `kbIds`；`streamEvents(prompt, { ...opts, configurable: { kbIds, retrieval } })`；工具收第二参 `config` 读 `config.configurable`。
  - `retrieval: { results: [] }` 是**每次调用新建**的收集器，工具**累计并入**（按切片去重），`on_tool_end` 从它读 → 解决了并发串台 + 并行调用丢结果两个问题。
  - ⚠️ 必须累计而非覆盖：模型并行/重试多次检索，覆盖会丢掉先发起那次的结果。
  - **fail-closed**：kbIds 为空时工具直接返回「未指定知识库」并拒绝检索，绝不降级为检索全库（已实测：模型会如实告知用户先去选知识库，并拒绝凭记忆作答）。
- **langchain 1.x 事件结构（实测确认，别再猜）**：
  - `on_tool_start` 的 `event.data = { input: { input: '{"query":"..."}' } }` —— **两层 input，内层是序列化 JSON 字符串**，要 `JSON.parse` 才拿到入参。
  - `on_tool_end` 的 `event.data.output` 是 **ToolMessage 实例**（正文在 `.content`），不是字符串。原代码写 `event.data.output as string` 把这个类型错误掩盖了，运行时取不到文本。
  - `config.configurable` **确实能下传到工具函数**（已验证 `kbIds`/`retrieval` 原样到达）；但 `config.runId` 是 `undefined`，不可用于区分调用。
  - `configurable` 同时含 LangGraph 内部键（`__pregel_*`、`ls_agent_type`），自建键需注意别撞名。
- LLM 走 OpenAI 兼容接口但实际是 **DeepSeek**：`LLM_BASE_URL` + `OPENAI_API_KEY`，支持的模型名只有 `deepseek-flash` / `deepseek-v4-pro`（传 `gpt-3.5-turbo` 会 400）。
- 仍未做**意图路由**：闲聊/通用常识虽允许正常回应，但模型仍可能先去检索一次（现在至少不再是无条件预检索）。
