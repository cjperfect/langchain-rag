# @mention 知识库检索 — RAG 端到端实现

## Context

用户在前端输入 `@` 选择知识库后，前端已经解析出 `knowledge_ids` 并发送到 `POST /api/chat`，但后端的 DTO、ChatService、AiEngine 整条链路都没有消费这个字段。当前 agent 只有一个 SQL 生成工具，没有任何文档检索能力。

## 设计思路

采用**后端 ChatService 层做检索，将结果注入 prompt** 的方式，而非给 agent 添加 tool：

- `ChatService` 在调用 `AiEngine` 之前，先根据 `knowledge_ids` 去 `KnowledgeChunk` 表做关键词检索
- 将检索到的相关片段格式化为 `<documents>` XML 标签，拼接到用户 prompt 前面
- 系统提示词已经指示模型"基于 `<documents>` 标签中的内容回答"，无需修改
- `AiEngine` 完全不需要改动——它只看到增强后的 prompt

**为什么不用 vector embedding？** 当前没有 pgvector 扩展、没有 embedding 列、没有 embedding 生成代码。先做关键词检索让功能跑通，后续可以升级为语义检索。

## 改动清单

### 1. `packages/shared/src/interfaces/chat.ts` — ChatOptions 增加 knowledgeIds

```ts
export interface ChatOptions {
  history?: ContextMessage[];
  model?: string;
  knowledgeIds?: number[];  // 新增
}
```

### 2. `apps/backend/src/chat/dto/chat.dto.ts` — ChatDto 增加 knowledge_ids

同时兼容两种前端场景：
- 首页 `@mention`：发送 `knowledge_ids: number[]`（多选）
- 知识库内聊天：发送 `knowledge_id: number`（单个）

```ts
export class ChatDto {
  prompt!: string;
  chat_session_id!: number;
  model?: string;
  thinking_enabled?: boolean;
  parent_message_id?: number;
  knowledge_ids?: number[];  // @mention 选中的知识库 ID 列表
  knowledge_id?: number;     // 知识库内聊天时自动带入
}
```

在 ChatService 中统一合并为数组处理。

### 3. `apps/backend/src/knowledge/knowledge.service.ts` — 新增 searchChunks 方法

```ts
/** 关键词检索：在指定知识库的切片中搜索与 query 相关的内容 */
async searchChunks(
  kbIds: number[],
  query: string,
  topK: number = 5,
): Promise<{ content: string; documentName: string; score: number }[]> {
  // 对 query 分词，用 ILIKE 做 OR 匹配
  // 按匹配度排序，返回 topK 条
}
```

检索策略：
- 将 query 按空格/标点拆成关键词
- 每个关键词用 `ILIKE '%keyword%'` 匹配
- 多个关键词 OR 叠加，用 `CASE WHEN` 计数匹配次数作为简单评分
- 限制 `kbId IN (...)` 和 `status` 过滤
- JOIN `KnowledgeDocument` 获取文档名

### 4. `apps/backend/src/chat/chat.module.ts` — 导入 KnowledgeModule

```ts
imports: [ConversationModule, MessageModule, KnowledgeModule],
```

### 5. `apps/backend/src/chat/chat.service.ts` — 注入 KnowledgeService，检索后增强 prompt

```ts
constructor(
  private readonly conversationService: ConversationService,
  private readonly messageService: MessageService,
  private readonly knowledgeService: KnowledgeService,  // 新增
) {}
```

在 `streamChat()` 中，调用 AI 引擎之前：

```ts
// 如果有 knowledge_ids，检索相关切片并拼入 prompt
let augmentedPrompt = chatDto.prompt;
if (chatDto.knowledge_ids?.length) {
  const chunks = await this.knowledgeService.searchChunks(chatDto.knowledge_ids, chatDto.prompt);
  if (chunks.length > 0) {
    const docsXml = chunks.map(c =>
      `<document source="${c.documentName}" score="${c.score}">\n${c.content}\n</document>`
    ).join("\n");
    augmentedPrompt = `<documents>\n${docsXml}\n</documents>\n\n用户问题：${chatDto.prompt}`;
  }
}

const stream = this.aiEngine.streamEvents(augmentedPrompt, {
  history: ctx.messages,
  model: chatDto.model,
  knowledgeIds: chatDto.knowledge_ids,
});
```

### 6. `apps/backend/src/knowledge/knowledge.module.ts` — 导出 KnowledgeService

确认 `KnowledgeModule` 的 `exports` 中包含 `KnowledgeService`（目前已有）。

### 7. AI Engine — 无需改动

`AiEngine` 接收到的 prompt 已经是增强后的文本，系统提示词已经包含 `<documents>` 处理说明。

## 不改动的部分

- **前端**：已经正确发送 `knowledge_ids`，无需修改
- **Prisma schema**：无需变更
- **数据库 migration**：无需新迁移
- **Embedding / pgvector**：本期不做

## 验证步骤

1. `pnpm dev` 启动后端和前端
2. 在首页聊天框输入 `@LangChain技术文档 怎么使用LCEL`（@选择一个已有知识库）
3. 检查：
   - 后端日志中 `knowledge_ids` 正确解析
   - `KnowledgeService.searchChunks` 返回了相关切片
   - AI 回复中引用了知识库文档内容
4. 在知识库内部聊天框发消息，检查 `knowledge_id`（单数）也正常工作
