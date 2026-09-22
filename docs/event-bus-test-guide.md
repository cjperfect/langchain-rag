# 跨包事件总线 · 体验测试指南

> 目标：亲手跑一遍 `ai-engine emit → shared holder → NestJS @OnEvent` 的完整链路，
> 确认 AI 引擎层发出的任务状态事件能被后端监听器收到。

## 0. 链路一图流

```
packages/ai-engine                packages/shared                 apps/backend
┌───────────────┐   import    ┌──────────────────┐          ┌─────────────────────┐
│ RagService    │──(emit)────▶│ emit() ──▶holder │          │ main.ts bootstrap:  │
│ AiEngine      │             │  (EventBusLike)  │◀─注入────│ setEventBus(        │
└───────────────┘             └──────────────────┘          │   app.get(EventEmitter2))
                                                            └─────────┬───────────┘
                                                                      │ 同一实例
                                                       ┌──────────────┴───────────────┐
                                            ┌──────────▼─────────┐      ┌─────────────▼────────────┐
                                            │ TaskListener       │      │ EventsGateway            │
                                            │ @OnEvent(task.*)   │      │ @OnEvent(task.*)         │
                                            │ → 结构化日志        │      │ → RxJS Subject（多播）    │
                                            └────────────────────┘      └─────────────┬────────────┘
                                                                                      │
                                                                      ┌───────────────▼──────────┐
                                                                      │ EventsController @Sse    │
                                                                      │ GET /api/events/stream   │
                                                                      └───────────────┬──────────┘
                                                                                      │ EventSource
                                                                      ┌───────────────▼──────────┐
                                                                      │ 前端上传弹窗 · 实时进度    │
                                                                      └──────────────────────────┘
```

> 「一份 emit，两个订阅者」——TaskListener 打日志、EventsGateway 推流，两者互不感知，
> 这正是发布-订阅的价值。可以只留一个，也可以再加第三个（比如写任务表）。

事件清单（payload 定义见 `packages/shared/src/events/task-event.ts`，四事件共用一份扁平 `TaskEventPayload`）：

| 事件名 | 触发时机 | 触发方 |
|---|---|---|
| `task.started` | 索引/检索/对话开始 | RagService / AiEngine |
| `task.progress` | 索引过程的切片/向量化中间步骤 | RagService |
| `task.completed` | 正常结束（带 durationMs + result） | 同上 |
| `task.failed` | 抛异常（带 error + stack） | 同上 |

> 对话流（AiEngine.streamEvents）只发 started / completed / failed 三段；工具调用明细经 SSE 的 tool_start / tool_end 已传给前端，无需再用进度事件重复。

---

## 1. 前置准备

```bash
# ① 依赖完整（若 node_modules 有断链先跑这个）
COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm install

# ② 构建顺序必须是 shared → ai-engine（backend 的 start:dev 不自动构建它们）
pnpm build:shared
pnpm build:ai-engine

# ③ 数据库就绪（镜像必须是 pgvector/pgvector:pg17，官方 postgres:17 不含 vector 扩展）
docker compose -f docker/docker-compose.yml up -d
pnpm db:migrate
```

`apps/backend/.env` 至少要有：`DATABASE_URL`、`LLM_BASE_URL`、`OPENAI_API_KEY`（对话测试需要）。

> **pgvector 是硬要求（本机已修好，此处留作背景）**。`PGVectorStore` 初始化时会执行
> `CREATE EXTENSION vector`；若用官方 `postgres:17` 镜像，扩展文件根本不在镜像里，报错
> `Could not open extension control file ".../extension/vector.control"`。
> 它会让**上传与删除双双失效**：上传时文档记录写入成功但索引失败被吞掉（`chunkCount: 0`，
> 列表里看得见、内容搜不到），删除时同样要走向量库清理而 500。
>
> 2026-09-14 已把 `docker/docker-compose.yml` 的镜像换成 `pgvector/pgvector:pg17`
> 并用 `docker compose up -d` 重建容器（命名卷 `pgdata` 保留，数据未丢），
> 三个知识库历史文档的向量也已补齐。换镜像的命令：
>
> ```bash
> docker compose -f docker/docker-compose.yml down
> docker compose -f docker/docker-compose.yml up -d
> ```
>
> ⚠️ 本机 `docker compose` 子命令可能不在 PATH 里（只有 `/opt/homebrew/bin/docker`，
> 而 compose 插件装在 `/opt/homebrew/lib/docker/cli-plugins/`）。此时直接用插件二进制：
>
> ```bash
> /opt/homebrew/lib/docker/cli-plugins/docker-compose -f docker/docker-compose.yml up -d
> ```

## 2. 启动后端

```bash
pnpm dev:backend
```

启动成功标志（控制台）：

```
Server is running on port: 3001
```

> 监听器日志级别说明：TaskListener 用的是 `logger.log / logger.error`（Nest 默认级别），
> 不需要开 debug 就能看到。端口默认 3001，下文 curl 以此为准。

## 3. 测试 A：文档索引全流程（RagService 事件）

> 鉴权当前临时跳过（`@CurrentUser` 默认 `{ id: 1 }`），curl 无需 token。

**① 创建知识库**

```bash
curl -s -X POST http://localhost:3001/api/knowledge \
  -H "Content-Type: application/json" \
  -d '{"name": "事件总线测试库", "description": "用于验证 task.* 事件"}'
```

返回里有 `"id": <kbId>`，记下来（假设为 `1`）。

**② 创建文档（触发索引 + 向量化）**

```bash
curl -s -X POST http://localhost:3001/api/knowledge/1/documents \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "事件总线测试.txt",
    "content": "事件总线（Event Bus）是一种发布-订阅模式的进程内通信机制。\n生产者通过 emit 发送事件，消费者通过 on 订阅事件，二者互不感知。\n本项目将 EventEmitter2 实例托管在 shared 包，由后端在 bootstrap 时注入，实现跨包单实例共享。"
  }'
```

**③ 观察后端控制台，应依次出现：**

```
[TaskListener] 任务开始 taskId=document_index-xxxx type=document_index 索引文档 #1
[TaskListener] 任务进度 taskId=document_index-xxxx type=document_index step=1 切片完成（N 片），开始向量化
[TaskListener] 任务进度 taskId=document_index-xxxx type=document_index step=2 向量化完成
[TaskListener] 任务完成 taskId=document_index-xxxx type=document_index duration=xxxms result=…
```

> `taskId` 格式：`document_index-<uuid>`（`<uuid>` 是运行时生成的随机串）。同一个 `taskId` 贯穿始终——这就是跨包事件追踪的关键，拿到它可以在日志里 grep 全生命周期。
> `result` 字段在监听器里会做 200 字符截断展示，避免大对象刷屏。

**④ 重建索引（reindex 路径，多一个"删除旧向量"进度）**

```bash
curl -s -X PATCH http://localhost:3001/api/knowledge/1/documents/1 \
  -H "Content-Type: application/json" \
  -d '{"content": "更新后的内容：事件总线是发布订阅模式。重新向量化会先删旧向量再重建。"}'
```

预期日志多了 `step=1 已删除旧向量`，然后 `step=2 切片完成…`、`step=3 向量化完成`。

## 4. 测试 B：对话流（AiEngine 事件 + RAG 检索事件）

**① 创建会话**

```bash
curl -s -X POST http://localhost:3001/api/conversations \
  -H "Content-Type: application/json" -d '{}'
```

记下返回的 `"id"`（假设为 `1`）。

**② 发起带知识库的对话（SSE 流）**

```bash
curl -N -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "什么是事件总线？",
    "chat_session_id": 1,
    "knowledge_ids": [1]
  }'
```

**③ 预期日志（两串 taskId：一串 rag_search，一串 chat）：**

```
[TaskListener] 任务开始 taskId=rag_search-xxxx type=rag_search 检索：什么是事件总线？
[TaskListener] 任务完成 taskId=rag_search-xxxx type=rag_search duration=xxms result=…

[TaskListener] 任务开始 taskId=chat-xxxx type=chat 对话：什么是事件总线？
[TaskListener] 任务完成 taskId=chat-xxxx type=chat duration=xxxxms
```

> 对话失败（如 API Key 无效）时改走 `task.failed`，会打印 error + stack——可故意改错
> `OPENAI_API_KEY` 体验一次失败路径（测完改回来）。

## 5. 测试 C：前端上传弹窗（SSE 实时推送）

体验 `task.* 事件 → EventsGateway → SSE → 浏览器 EventSource → 上传弹窗` 这条完整链路。

**前置**：后端**已重启**（必须，见本节末尾注意点）、前端已启动（`pnpm dev:frontend`，默认 3000）。

**① 浏览器操作**

打开 `http://localhost:3000/knowledge` → 选一个知识库 → 点「上传」→ 拖入或选择文件 → 点「上传」。

弹窗从「选择文件」切换到处理视图，依次出现：

```
⟳ 正在上传文件…                      ← 尚未收到任务事件时的占位
▶ 任务开始 · 索引文档 #N
⟳ 切片完成（N 片），开始向量化   步骤 1
⟳ 向量化完成                      步骤 2
✓ 索引完成 · N 个切片 · 耗时 x.xs
```

连接正常时事件列表上方会显示绿点 +「事件流已连接，进度实时推送」；
连不上时改为黄色告警条，直接写出失败地址——**别对着空列表干等**，看到告警条就先查下一节。

处理过程中弹窗不可关闭（避免误关）；失败时显示红色错误条 + `task.failed` 的 error 文本。

**② 不开浏览器也能验证：curl 直接观察 SSE 流**

```bash
# 终端 A：挂着 SSE 连接（-N 关闭缓冲）
curl -N "http://localhost:3001/api/events/stream?types=document_index"

# 终端 B：触发一次索引
curl -s -X POST http://localhost:3001/api/knowledge/1/documents \
  -H "Content-Type: application/json" \
  -d '{"fileName": "SSE 测试.txt", "content": "事件总线通过 SSE 把任务进度推送到前端。"}'
```

终端 A 应实时打印（`id:` 是 NestJS 自动加的序号，前端会忽略）：

```
id: 1
data: {"name":"task.started","payload":{"taskId":"document_index-…","taskType":"document_index",…}}

id: 2
data: {"name":"task.progress","payload":{…,"step":1,"message":"切片完成（1 片），开始向量化"}}
```

**③ `types` 过滤参数**

`GET /api/events/stream?types=document_index,chat` 只推指定类型；省略 `types` 则推全部。
前端封装 `useTaskEventStream({ types: ["document_index"] })` 即基于此。

> **四个踩坑点**
> 1. **改完后端代码必须手动重启**。`nest start --watch` 在本项目里对新增文件的重载并不可靠——
>    实测改动 `app.module.ts`、新增 controller 后旧进程仍在跑（SSE 端点返回 404 或行为不变）。
> 2. **SSE 不走 Next 代理**。走 Next rewrite 有被 buffer 的风险，进度会一次性到达而非实时，
>    所以前端直连后端，端口默认 3001。
> 3. **后端地址按页面 hostname 推导**，不再写死 `localhost`。从 `127.0.0.1` 或
>    Next 启动时打印的局域网地址（如 `http://192.168.0.100:3000`）打开页面时，
>    写死 `localhost:3001` 会让 EventSource 去连「客户端自己的 localhost」，
>    既连不上又被 CORS 拦掉，**表现为「点了上传没有任何消息推送」**。
>    可用 `NEXT_PUBLIC_API_ORIGIN` 覆盖；后端 CORS 在非 production 下放行本机与
>    RFC1918 私网来源（`10.x` / `172.16-31.x` / `192.168.x`）。
> 4. **响应拦截器已跳过 SSE**。`TransformInterceptor` 靠 `@Sse` 元数据 + `Accept` 头识别；
>    否则每条消息会被包成 `{code,message,data}`，前端解析出的将是嵌套结构而全部丢弃。

---

## 6. 测试 D（可选）：30 秒纯链路冒烟，不依赖数据库

不启动 Nest、不连 DB，直接验证 holder → EventEmitter2 的转发；也顺带验证 `withTaskEvents` 帮手：

```bash
cd apps/backend && node --input-type=module -e '
import { EventEmitter2 } from "@nestjs/event-emitter";
import { setEventBus, emit, withTaskEvents, TaskEvent, TaskType } from "@langchain-rag/shared/events";

const bus = new EventEmitter2();
for (const name of [TaskEvent.STARTED, TaskEvent.COMPLETED, TaskEvent.FAILED]) {
  bus.on(name, (p) => console.log(`[${name}]`, JSON.stringify(p)));
}

console.log("注入前 emit 返回:", emit(TaskEvent.COMPLETED, { x: 1 }));   // false（静默）
setEventBus(bus);

await withTaskEvents(TaskType.RAG_SEARCH, { message: "冒烟" }, async (taskId) => {
  return { hitCount: 3 };
});
await withTaskEvents(TaskType.DOCUMENT_INDEX, {}, async () => {
  throw new Error("故意失败");
}).catch(() => {});
'
```

预期输出（成功 + 失败两条任务链）：

```
注入前 emit 返回: false
[task.started] {"taskId":"rag_search-…","taskType":"rag_search","message":"冒烟"}
[task.completed] {"taskId":"rag_search-…","taskType":"rag_search","durationMs":0,"result":{"hitCount":3}}
[task.started] {"taskId":"document_index-…","taskType":"document_index"}
[task.failed] {"taskId":"document_index-…","taskType":"document_index","durationMs":0,"error":"故意失败","stack":"…"}
```

## 7. 验收清单

- [ ] 索引文档：4 条日志（started → progress×2 → completed），taskId 一致
- [ ] 重建索引：进度含"已删除旧向量"，step 从 1 开始（1=删旧向量、2=切片、3=向量化）
- [ ] 对话 + 检索：rag_search 与 chat 两串独立 taskId，各自闭环（chat 只有 started + completed）
- [ ] 失败路径：故意制造错误能看到 `task.failed` + stack
- [ ] 未注入时静默：测试 D 第一行输出 `false`，进程不崩
- [ ] SSE 原始报文：`data: {"name":"task.started","payload":{…}}`，**没有** `{"data":"…"}` 这层嵌套
- [ ] 前端弹窗：上传后进度逐条出现（started → progress → completed），失败时显示错误文本
- [ ] 弹窗连接状态：处理中显示绿点「事件流已连接」；连不上时出现黄色告警条并写明失败地址
- [ ] 上传成功即可检索：`chunkCount > 0`，随后在知识库对话里能问到该文档内容

## 8. 排查 FAQ

| 症状 | 原因 | 解决 |
|---|---|---|
| 完全没有 TaskListener 日志 | 后端没重启 / dist 旧 | 重启 `pnpm dev:backend`；确认改过 shared 后重新 `build:shared` + `build:ai-engine` |
| 有 started 没 completed | 业务抛错走了 failed，或进程中断 | 看有没有 `task.failed` 日志；error 字段即原因 |
| 建文档/上传报 500，或弹窗显示"处理失败" | DB 未迁移，或数据库缺 **pgvector** 扩展 | `pnpm db:migrate`；镜像必须用 `pgvector/pgvector:pg17`——官方 `postgres:17` **不含**该扩展 |
| 上传返回 201 成功，但文档 `chunkCount: 0`、检索搜不到 | 索引失败被 `.catch(() => [])` 吞掉（历史行为，已修）；根因多为缺 pgvector | 现已改为回滚文档记录 + 返回 `文档索引失败：<原因>`；确认 pgvector 已装 |
| 删除文档报 500 | 删除要走向量库清理，同样受 pgvector 影响 | 同上，装好 pgvector 后即恢复 |
| 对话只有 chat 事件没有 rag_search | 请求体没带 `knowledge_ids` / 知识库为空 | 带上 `knowledge_ids: [<kbId>]` 且确认测试 A 已成功写入向量 |
| 事件收不到但代码像是对的 | setEventBus 未执行或执行在 emit 之后 | 确认 `main.ts` 里 `setEventBus(app.get(EventEmitter2))` 在 listen 之前 |
| `/api/events/stream` 返回 404 | 后端没重启，新增的 controller 未被加载 | 手动重启后端（watch 对新增文件的重载不可靠） |
| **点了上传，弹窗里没有任何消息** | EventSource 连不上：写死主机名时代从其他地址访问、或后端 CORS 不放行该来源 | 弹窗会显示黄色告警条并写明失败地址；对照浏览器控制台的 CORS 报错，检查后端是否重启到含新 CORS 规则的版本 |
| 有向量表但检索恒为 0 条 | 该表是在 pgvector 缺失期间建的，向量从未写入 | 重新保存一次文档（PATCH 会走 `reindexDocument` 重建向量） |
| SSE 连上了但前端事件全被忽略 | 消息被拦截器多包一层，或走代理被 buffer | 确认报文形如 `data: {"name":…}`；前端直连 3001 而非 Next 代理 |

## 9. 想加自己的监听器？

```ts
// apps/backend/src/task/task.listener.ts 里追加，或新建任意 provider
import { OnEvent } from "@nestjs/event-emitter";
import { TaskEvent } from "@langchain-rag/shared/events";
import type { TaskEventPayload } from "@langchain-rag/shared/events"; // 注意 import type！

@OnEvent(TaskEvent.COMPLETED)
onCompleted(p: TaskEventPayload) { /* 更新任务表 / 推 WebSocket / ... */ }
```

两个约束：
1. **参数类型必须 `import type`**——backend 开了 `emitDecoratorMetadata`，否则 TS1272。
2. **通配监听**（`@OnEvent("task.*")`）未默认启用：需要时在 `AppModule` 的 `EventEmitterModule.forRoot` 里加 `{ wildcard: true, delimiter: '.' }`（eventemitter2 的能力，与 Nest 无关）。