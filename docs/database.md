# AI Chat 数据库设计方案

## 1. 设计目标

本数据库设计用于支持：

- DeepSeek / OpenAI 类聊天系统
- 多轮上下文对话
- 会话列表管理
- 消息编辑
- 消息重新发送
- AI重新生成回答
- 分支对话（Fork）
- 长上下文摘要
- Token统计
- 流式输出
- 文件上传
- Tool Calling
- Agent执行记录
- RAG知识库引用

---

# 一、整体架构

```
chat_conversation
        |
        |
        ↓
chat_message （消息树核心）
        |
        |
 ┌───────────────┬───────────────┬───────────────┐
 ↓               ↓               ↓
附件            流式输出          Tool调用

chat_attachment  chat_message_chunk  chat_tool_call


chat_summary
        |
        |
上下文压缩


chat_context
        |
        |
模型请求快照


chat_agent_run
        |
        |
Agent执行记录


chat_rag_reference
        |
        |
知识库引用
```

---

# 二、核心表设计

## 1. chat_conversation 会话表

### 作用

负责：

- 左侧会话列表
- 会话基本信息
- 当前聊天节点
- 会话状态

```sql
CREATE TABLE chat_conversation (

    -- 主键
    id            BIGSERIAL PRIMARY KEY,

    -- 用户ID，关联用户表
    user_id       BIGINT NOT NULL,

    -- 会话标题，由AI根据首条消息自动生成
    title         VARCHAR(255),

    -- 默认模型，例如 deepseek-chat。会话内消息可覆盖此设置
    model         VARCHAR(100),

    -- 系统Prompt，为空时使用应用默认值
    system_prompt TEXT,

    -- 当前所在消息节点ID，关联 chat_message.id。用于分支切换后恢复用户所在位置
    current_message_id BIGINT,

    -- 消息数量（当前活跃分支），应用层维护的反范式字段
    message_count INTEGER DEFAULT 0,

    -- 累计消耗Token（当前活跃分支），应用层维护的反范式字段。分支切换时重新计算
    total_tokens  INTEGER DEFAULT 0,

    -- 当前分支数量。每次分叉 +1
    branch_count  INTEGER DEFAULT 1,

    -- 状态：1=正常 2=归档 3=删除
    status        SMALLINT DEFAULT 1,

    -- 最后消息时间，用于会话列表排序
    last_message_at TIMESTAMP,

    -- 创建时间
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- 更新时间，行级自动更新。PostgreSQL 通过触发器实现（见下方触发器脚本）
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

-- ========== 索引 ==========

-- 会话列表：按用户查会话，按最后消息时间倒序
CREATE INDEX idx_conv_user_time ON chat_conversation (user_id, last_message_at DESC);

-- 按状态过滤已归档/已删除会话
CREATE INDEX idx_conv_status ON chat_conversation (status);

-- ========== 自动更新 updated_at 的触发器 ==========

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_chat_conversation_updated_at
    BEFORE UPDATE ON chat_conversation
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

---

## 2. chat_message 消息表

### 作用

整个系统核心。

采用树结构。

支持：

- 编辑消息
- 重新生成
- 多版本回答
- 分支聊天

结构：

```
          user
           |
     assistant A
           |
        user
        /   \
 assistantA assistantB
```

```sql
CREATE TABLE chat_message (

    -- 主键
    id                BIGSERIAL PRIMARY KEY,

    -- 所属会话ID，关联 chat_conversation.id
    conversation_id   BIGINT NOT NULL,

    -- 父消息ID，关联 chat_message.id，形成消息树。NULL 表示根消息
    parent_id         BIGINT DEFAULT NULL,

    -- 分支根节点ID，关联 chat_message.id。NULL 表示自身为根。
    -- 同一条分支上的消息共享相同的 root_id（继承自该分支的根消息 id）。
    -- 查整条分支：WHERE conversation_id = ? AND (root_id = ? OR id = ?) ORDER BY created_at
    root_id           BIGINT DEFAULT NULL,

    -- 角色：system / user / assistant / tool。对应 OpenAI Messages API 的 role 字段
    role              VARCHAR(20) NOT NULL,

    -- 消息正文。assistant 消息为模型输出，user 消息为用户输入
    content           TEXT,

    -- 模型推理内容。DeepSeek-R1 / OpenAI o1 等推理模型在给出最终回答前的思维链文本。普通模型此字段为 NULL
    reasoning_content TEXT,

    -- 消息主要内容形态：text=纯文本 / image=图片 / file=文件 / tool=工具调用。
    -- 决定前端渲染方式和附表查询路径。见设计约定 §1
    message_type      VARCHAR(50) DEFAULT 'text',

    -- 本消息的 Token 数量（含 reasoning_content）。由 API 返回的 usage 数据填充
    token_count       INTEGER DEFAULT 0,

    -- 消息状态。对 assistant/tool 角色有意义：0=生成中 1=完成 2=失败。user/system 消息默认 1
    status            SMALLINT DEFAULT 1,

    -- 创建时间
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

-- ========== 索引 ==========

-- 按会话+父节点查子节点：查某条消息的所有回复
CREATE INDEX idx_msg_conv_parent ON chat_message (conversation_id, parent_id);

-- 一键拉取整条分支（核心优化）：WHERE conversation_id=? AND root_id=? 即可获取完整消息链
CREATE INDEX idx_msg_conv_root  ON chat_message (conversation_id, root_id);

-- 按会话+时间排序：加载会话默认视图
CREATE INDEX idx_msg_conv_time  ON chat_message (conversation_id, created_at);
```

### 树查询说明

```sql
-- 拉取某个分支的完整消息链（高频操作，用 root_id 一次搞定）
SELECT * FROM chat_message
WHERE conversation_id = ?
  AND (root_id = ? OR id = ?)
ORDER BY created_at;

-- 如果不用 root_id，需要用递归 CTE（低效，仅作参考）
-- WITH RECURSIVE tree AS (
--   SELECT * FROM chat_message WHERE conversation_id = ? AND parent_id IS NULL
--   UNION ALL
--   SELECT m.* FROM chat_message m JOIN tree t ON m.parent_id = t.id
-- )
-- SELECT * FROM tree ORDER BY created_at;
```

### root_id 维护规则

| 场景 | root_id 取值 |
|------|-------------|
| 会话首条消息 | NULL（自身为根） |
| 正常回复（沿当前分支继续） | 继承父消息的 root_id |
| 编辑消息 / 重新生成（分叉） | 新消息自身为根，root_id = NULL |
| 用户主动 Fork | 新消息自身为根，root_id = NULL |

> 简记：分叉即新根。`root_id` 相同的消息属于同一条分支。

---

## 3. chat_summary 会话摘要表

### 作用

解决长上下文问题。

当：

```
消息数量过多
或者
Token超过限制
```

生成摘要。

例如：

原始：

```
100条聊天记录
```

压缩：

```
用户正在开发AI Agent平台。

已经完成：
1. LangChain
2. Tool调用
3. SSE流式输出

当前问题：
上下文管理
```

```sql
CREATE TABLE chat_summary (

    -- 主键
    id                BIGSERIAL PRIMARY KEY,

    -- 会话ID，关联 chat_conversation.id
    conversation_id   BIGINT NOT NULL,

    -- 摘要所覆盖分支的最后一条消息节点ID，关联 chat_message.id。用于定位摘要覆盖了哪条分支
    branch_message_id BIGINT NOT NULL,

    -- 摘要内容。由模型对历史消息进行压缩后生成的文本
    summary           TEXT NOT NULL,

    -- 摘要覆盖的起始消息ID，关联 chat_message.id
    start_message_id  BIGINT NOT NULL,

    -- 摘要覆盖的结束消息ID，关联 chat_message.id。与 start_message_id 构成闭区间 [start, end]
    end_message_id    BIGINT NOT NULL,

    -- 摘要内容本身的 Token 数量
    token_count       INTEGER,

    -- 创建时间
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

-- ========== 索引 ==========

-- 查某会话某条分支的最新摘要：发送消息前判断是否有可用摘要
CREATE INDEX idx_summary_conv_branch ON chat_summary (conversation_id, branch_message_id);
```

---

## 4. chat_context 模型请求上下文表

### 作用

记录：

> 某一次调用模型时，实际发送给AI的上下文。

不是聊天记录。

而是：

```
System Prompt

+

历史摘要

+

历史消息

+

RAG结果

+

Tool结果

+

用户输入
```

例如：

实际发送：

```json
[
  {
    "role": "system",
    "content": "你是AI助手"
  },

  {
    "role": "assistant",
    "content": "历史摘要"
  },

  {
    "role": "user",
    "content": "最新问题"
  }
]
```

保存：

```sql
CREATE TABLE chat_context (

    -- 主键
    id                  BIGSERIAL PRIMARY KEY,

    -- 会话ID，关联 chat_conversation.id
    conversation_id     BIGINT NOT NULL,

    -- 触发本次模型请求的消息ID（对应一条 assistant 消息），关联 chat_message.id
    message_id          BIGINT NOT NULL,

    -- 使用的摘要版本ID，关联 chat_summary.id。NULL 表示本次请求未使用摘要
    summary_id          BIGINT,

    -- 参与推理的消息ID列表，按发送顺序排列。JSON 数组，仅用于调试展示，不做 JOIN 查询
    context_message_ids JSONB,

    -- 实际发送给模型的完整 messages 数组（含 system/历史/工具结果等）。
    -- 用于问题排查和请求回放。JSON 数组，仅用于调试
    raw_messages        JSONB,

    -- 模型名称，例如 deepseek-chat
    model               VARCHAR(100) NOT NULL,

    -- 实际使用的 System Prompt（当时刻的快照，方便回溯）
    system_prompt       TEXT,

    -- 本次请求的输入 Token 数，由 API 返回
    input_tokens        INTEGER DEFAULT 0,

    -- 本次请求的输出 Token 数，由 API 返回
    output_tokens       INTEGER DEFAULT 0,

    -- 接口耗时（毫秒）
    latency             INTEGER,

    -- 创建时间
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

-- ========== 索引 ==========

-- 查某条消息的上下文快照：调试/排查
CREATE INDEX idx_context_conv_msg ON chat_context (conversation_id, message_id);

-- 按时间范围统计 Token 消耗和成本
CREATE INDEX idx_context_created ON chat_context (created_at);
```

### JSONB 列的使用边界

- `context_message_ids` — 仅用于**调试展示**，不做 JOIN 查询
- `raw_messages` — 仅用于**问题排查和请求回放**

> 如果未来需要按 message_id 做统计（如"哪些消息参与了推理"），拆为关联表 `chat_context_message (context_id, message_id, sequence_order)` 替代 JSONB。

---

## 5. chat_attachment 附件表

支持：

- 图片
- PDF
- Excel
- Word

```sql
CREATE TABLE chat_attachment (

    -- 主键
    id          BIGSERIAL PRIMARY KEY,

    -- 所属消息ID，关联 chat_message.id
    message_id  BIGINT NOT NULL,

    -- 文件名称
    file_name   VARCHAR(255) NOT NULL,

    -- 文件类型：image / pdf / excel / word
    file_type   VARCHAR(50),

    -- 文件地址（OSS URL 或本地路径）
    file_url    VARCHAR(500) NOT NULL,

    -- 文件大小（Byte）
    file_size   BIGINT,

    -- MIME 类型，如 image/png、application/pdf
    mime_type   VARCHAR(100),

    -- 创建时间
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

-- ========== 索引 ==========

-- 查某条消息的所有附件
CREATE INDEX idx_attachment_msg ON chat_attachment (message_id);
```

---

## 6. chat_message_chunk 流式输出表

作用：

- SSE 断点恢复
- 流式回放
- 流式进度判断

```sql
CREATE TABLE chat_message_chunk (

    -- 主键
    id           BIGSERIAL PRIMARY KEY,

    -- 所属消息ID，关联 chat_message.id
    message_id   BIGINT NOT NULL,

    -- Chunk 序号，从 1 开始递增
    chunk_index  INTEGER NOT NULL,

    -- 总 Chunk 数。NULL 表示流式仍在进行中，非 NULL 表示流式已完成且总数为该值。
    -- 写入最后一个 chunk 时填入此值
    total_chunks INTEGER,

    -- 增量文本内容
    content      TEXT NOT NULL,

    -- 创建时间
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

-- ========== 索引 ==========

-- 按消息+序号唯一：防重写入，按序拉取回放
CREATE UNIQUE INDEX idx_chunk_msg_seq ON chat_message_chunk (message_id, chunk_index);
```

### 流式完成判断

```sql
-- 判断某条消息的流式状态
SELECT
    m.id,
    m.status,
    CASE
        WHEN m.status = 0 AND c.total_chunks IS NULL THEN 'streaming'
        WHEN m.status = 1 AND c.total_chunks IS NOT NULL THEN 'completed'
        WHEN m.status = 2 THEN 'failed'
    END AS stream_state
FROM chat_message m
LEFT JOIN (
    SELECT message_id, MAX(total_chunks) AS total_chunks
    FROM chat_message_chunk
    GROUP BY message_id
) c ON m.id = c.message_id
WHERE m.id = ?;
```

---

## 7. chat_tool_call 工具调用表

支持：

- MCP
- Function Calling
- LangChain Tool

```sql
CREATE TABLE chat_tool_call (

    -- 主键，内部ID
    id           BIGSERIAL PRIMARY KEY,

    -- 触发 tool_call 的 assistant 消息ID，关联 chat_message.id
    message_id   BIGINT NOT NULL,

    -- API 返回的 tool_call_id，用于 tool 角色消息关联回此调用。
    -- 对应 OpenAI / DeepSeek API 中 tool_calls[].id
    tool_call_id VARCHAR(100) NOT NULL,

    -- 工具名称，如 search_web、read_file
    tool_name    VARCHAR(100) NOT NULL,

    -- 输入参数，JSON 对象
    arguments    JSONB,

    -- 返回结果，JSON。成功时存返回值，失败时存错误信息
    result       JSONB,

    -- 状态：0=执行中 1=成功 2=失败 3=超时
    status       SMALLINT DEFAULT 0,

    -- 执行耗时（毫秒）
    duration     INTEGER,

    -- 创建时间
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

-- ========== 索引 ==========

-- 查某条消息的所有 tool 调用
CREATE INDEX idx_tool_msg ON chat_tool_call (message_id);

-- 通过 API 返回的 tool_call_id 反查调用记录
CREATE INDEX idx_tool_call_id ON chat_tool_call (tool_call_id);
```

### tool_call_id 的作用

tool_call_id 是模型 API 返回的标识符，用于将 tool 角色的消息与对应的 tool_call 关联：

```
assistant 消息（含 tool_calls）
  └─ tool_call_id: "call_abc123"
       └─ tool 角色消息（tool_call_id: "call_abc123"）
            └─ 结果存入 chat_tool_call.result
```

---

## 8. chat_agent_run Agent执行记录

适用于多Agent系统。

```sql
CREATE TABLE chat_agent_run (

    -- 主键
    id                  BIGSERIAL PRIMARY KEY,

    -- 会话ID，关联 chat_conversation.id
    conversation_id     BIGINT NOT NULL,

    -- 触发消息ID，关联 chat_message.id
    message_id          BIGINT,

    -- 上级 Agent 执行ID，关联 chat_agent_run.id。NULL 表示最外层 Agent。
    -- 用于追踪多 Agent 嵌套调用链
    parent_agent_run_id BIGINT,

    -- Agent 名称，如 ManagerAgent、CodeAgent
    agent_name          VARCHAR(100) NOT NULL,

    -- 执行任务描述，便于人工查看
    task                VARCHAR(500),

    -- 输入数据，JSON 对象
    input               JSONB,

    -- 输出结果，JSON 对象
    output              JSONB,

    -- 状态：0=执行中 1=成功 2=失败
    status              SMALLINT DEFAULT 0,

    -- 耗时（毫秒）
    duration            INTEGER,

    -- 创建时间
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

-- ========== 索引 ==========

-- 查某个会话的所有 Agent 执行记录
CREATE INDEX idx_agent_conv ON chat_agent_run (conversation_id);

-- 追踪多 Agent 调用链：从父 Agent 查子 Agent
CREATE INDEX idx_agent_parent ON chat_agent_run (parent_agent_run_id);

-- 查某条消息触发了哪些 Agent
CREATE INDEX idx_agent_msg ON chat_agent_run (message_id);
```

### 多Agent调用链追踪

```
用户消息
  ↓
Manager Agent    ← chat_agent_run (parent_agent_run_id = NULL)
  ↓
Product Agent    ← chat_agent_run (parent_agent_run_id = Manager Agent 的 id)
  ↓
Developer Agent  ← chat_agent_run (parent_agent_run_id = Product Agent 的 id)
```

通过 `parent_agent_run_id` 可以用递归 CTE 重建完整调用链。

---

## 9. chat_rag_reference 知识库引用

记录：

AI回答引用了哪些文档。

```sql
CREATE TABLE chat_rag_reference (

    -- 主键
    id          BIGSERIAL PRIMARY KEY,

    -- 回答消息ID（assistant 消息），关联 chat_message.id
    message_id  BIGINT NOT NULL,

    -- 文档ID，关联知识库文档表
    document_id BIGINT NOT NULL,

    -- 文本块ID，关联知识库 chunk 表。定位到文档的具体片段
    chunk_id    BIGINT,

    -- 引用的内容片段原文
    content     TEXT,

    -- 相似度分数，范围 0.0000 ~ 1.0000。记录检索时的相关性得分
    score       DECIMAL(5,4),

    -- 创建时间
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

-- ========== 索引 ==========

-- 查某条回答引用了哪些文档/片段
CREATE INDEX idx_rag_msg ON chat_rag_reference (message_id);

-- 查某篇文档被哪些回答引用过
CREATE INDEX idx_rag_doc ON chat_rag_reference (document_id);
```

---

# 三、表关系总览

```
┌─────────────────────────────────────────────────────────────┐
│                      chat_conversation                       │
│  id ←──────────────────────────────────────────────────┐    │
│  user_id (→ 用户表)                                     │    │
│  current_message_id (→ chat_message.id)                 │    │
└────────────────────────┬────────────────────────────────┘    │
                         │ conversation_id                     │
                         ▼                                     │
┌─────────────────────────────────────────────────────────┐    │
│                      chat_message                        │    │
│  id ←──────────────────────────────────────────────┐    │    │
│  conversation_id (→ chat_conversation.id)           │    │    │
│  parent_id (→ chat_message.id) 自引用树             │    │    │
│  root_id (→ chat_message.id)   分支根               │    │    │
└──┬──────────┬──────────┬──────────┬─────────────────┘    │    │
   │          │          │          │                       │    │
   │ message_id         │          │                       │    │
   ▼                    ▼          ▼                       │    │
┌──────────────┐ ┌────────────┐ ┌──────────────────┐       │    │
│chat_attachment│ │chat_message│ │chat_tool_call    │       │    │
│              │ │_chunk      │ │                  │       │    │
│ message_id ──┘ │            │ │ message_id ──────┘       │    │
│              │ │ message_id ─┘ │ tool_call_id            │    │
└──────────────┘ └────────────┘ └──────────────────┘       │    │
                                                            │    │
┌──────────────────────────────────────────────────┐        │    │
│                chat_summary                       │        │    │
│ conversation_id (→ chat_conversation.id)          │        │    │
│ branch_message_id (→ chat_message.id)             │        │    │
│ start_message_id  (→ chat_message.id)             │        │    │
│ end_message_id    (→ chat_message.id)             │        │    │
└──────────────────────────────────────────────────┘        │    │
                                                            │    │
┌──────────────────────────────────────────────────┐        │    │
│                chat_context                       │        │    │
│ conversation_id (→ chat_conversation.id)          │        │    │
│ message_id (→ chat_message.id)                    │        │    │
│ summary_id (→ chat_summary.id)                    │────────┘    │
└──────────────────────────────────────────────────┘        │    │
                                                            │    │
┌──────────────────────────────────────────────────┐        │    │
│                chat_agent_run                     │        │    │
│ conversation_id (→ chat_conversation.id)          │        │    │
│ message_id (→ chat_message.id)                    │────────┘    │
│ parent_agent_run_id (→ chat_agent_run.id) 自引用  │             │
└──────────────────────────────────────────────────┘             │
                                                                 │
┌──────────────────────────────────────────────────┐             │
│              chat_rag_reference                   │             │
│ message_id (→ chat_message.id)                    │─────────────┘
│ document_id (→ 知识库文档表)                       │
│ chunk_id (→ 知识库 chunk 表)                       │
└──────────────────────────────────────────────────┘
```

### 外键关系速查

| 子表 | 外键列 | 引用表 | 引用列 |
|---|---|---|---|
| chat_message | `conversation_id` | chat_conversation | `id` |
| chat_message | `parent_id` | chat_message | `id` |
| chat_message | `root_id` | chat_message | `id` |
| chat_summary | `conversation_id` | chat_conversation | `id` |
| chat_summary | `branch_message_id` | chat_message | `id` |
| chat_summary | `start_message_id` | chat_message | `id` |
| chat_summary | `end_message_id` | chat_message | `id` |
| chat_context | `conversation_id` | chat_conversation | `id` |
| chat_context | `message_id` | chat_message | `id` |
| chat_context | `summary_id` | chat_summary | `id` |
| chat_attachment | `message_id` | chat_message | `id` |
| chat_message_chunk | `message_id` | chat_message | `id` |
| chat_tool_call | `message_id` | chat_message | `id` |
| chat_agent_run | `conversation_id` | chat_conversation | `id` |
| chat_agent_run | `message_id` | chat_message | `id` |
| chat_agent_run | `parent_agent_run_id` | chat_agent_run | `id` |
| chat_rag_reference | `message_id` | chat_message | `id` |

---

# 四、设计约定

## 1. message_type 与附表的关系

`chat_message.message_type` 决定了去哪个附表查找详情：

| message_type | 附表 | 说明 |
|---|---|---|
| `text` | — | 纯文本，content 即为完整内容 |
| `image` | chat_attachment | 图片消息，附件表存图片URL |
| `file` | chat_attachment | 文件消息，附件表存文件URL和元信息 |
| `tool` | chat_tool_call | 工具调用，查 tool_call 表获取调用详情 |

> 一条消息可以同时有附件和 tool_call（如 assistant 消息先调用 tool 再返回文本）。message_type 标记**主要内容形态**，不代表排他。

## 2. status 字段使用约定

### chat_message.status

| 值 | 含义 | 适用角色 |
|----|------|---------|
| `0` | 生成中 | 仅 `assistant` |
| `1` | 完成 | 所有角色（`user`/`system` 消息默认 1）|
| `2` | 失败 | `assistant` / `tool` |

### chat_tool_call.status

| 值 | 含义 |
|----|------|
| `0` | 执行中 |
| `1` | 成功 |
| `2` | 失败 |
| `3` | 超时 |

### chat_agent_run.status

| 值 | 含义 |
|----|------|
| `0` | 执行中 |
| `1` | 成功 |
| `2` | 失败 |

## 3. Token 计数策略

- `chat_message.token_count` — 单条消息的 Token 数（含 reasoning_content）
- `chat_conversation.total_tokens` — **当前活跃分支**的累计 Token（反范式，应用层维护）
- `chat_context.input_tokens / output_tokens` — API 实际返回的本次请求 Token 数

> 分支切换时：应用层重新计算 `total_tokens`，遍历当前分支消息的 `token_count` 求和。

## 4. 消息不可修改

编辑消息：

```
新增节点
```

而不是：

```
UPDATE 原消息
```

- 编辑 → 新增一条 `parent_id` 指向被编辑消息的新节点
- 重新生成 → 新增一条 `parent_id` 指向同一条 user 消息的新 assistant 节点
- 分叉 → `root_id = NULL`，标记为新分支起点

## 5. Context 记录模型视角

| 概念 | 视角 |
|------|------|
| chat_message | 用户看到什么 |
| chat_context | AI 看到什么 |

两者分离是调试和审计的核心基础。

## 6. Summary 解决长上下文

发送给模型的上下文拼装逻辑：

```
summary（最新一份）

+

summary 之后 ~ 当前输入之间的消息

+

当前用户输入
```

当消息数或 Token 超过阈值时，生成新的 summary 覆盖历史部分。

## 7. 会话删除与消息的关系

删除仅发生在**会话级别**：

- `chat_conversation.status = 3`（删除）— 前端不再展示该会话
- `chat_message` **不设删除标记**，不级联修改。消息遵循"只增不改"原则，保留完整历史

会话恢复时（`status: 3 → 1`），所有消息和分支结构原样可用。真正物理删除由运维侧按数据保留策略执行。

---

# 五、索引策略汇总

| 表 | 索引 | 覆盖查询 |
|---|---|---|
| chat_conversation | `(user_id, last_message_at DESC)` | 会话列表 |
| chat_conversation | `(status)` | 按状态过滤 |
| chat_message | `(conversation_id, parent_id)` | 按会话+父节点查子节点 |
| chat_message | `(conversation_id, root_id)` | **一键拉取整条分支**（核心优化） |
| chat_message | `(conversation_id, created_at)` | 按时间排序 |
| chat_summary | `(conversation_id, branch_message_id)` | 查某分支的最新摘要 |
| chat_context | `(conversation_id, message_id)` | 查某条消息的上下文快照 |
| chat_context | `(created_at)` | 按时间范围统计成本 |
| chat_attachment | `(message_id)` | 查消息的附件 |
| chat_message_chunk | `UNIQUE (message_id, chunk_index)` | 按序拉取/回放，防重 |
| chat_tool_call | `(message_id)` | 查消息的 tool 调用 |
| chat_tool_call | `(tool_call_id)` | tool 角色消息关联 |
| chat_agent_run | `(conversation_id)` | 查会话的 Agent 记录 |
| chat_agent_run | `(parent_agent_run_id)` | 追踪多Agent调用链 |
| chat_agent_run | `(message_id)` | 查消息触发的Agent |
| chat_rag_reference | `(message_id)` | 查回答引用了哪些文档 |
| chat_rag_reference | `(document_id)` | 查文档被哪些回答引用 |

---

# 六、MySQL → PostgreSQL 迁移对照

| MySQL | PostgreSQL | 说明 |
|---|---|---|
| `BIGINT AUTO_INCREMENT` | `BIGSERIAL` | 自增主键 |
| `TINYINT` | `SMALLINT` | PG 无 TINYINT，用 SMALLINT（2字节） |
| `INT` | `INTEGER` | 等价，仅命名差异 |
| `LONGTEXT` | `TEXT` | PG 的 TEXT 即可存大文本，无需区分 |
| `DATETIME` | `TIMESTAMP` | 时间类型 |
| `JSON` | `JSONB` | PG 推荐 JSONB，支持索引且查询更快 |
| `ON UPDATE CURRENT_TIMESTAMP` | 触发器 | PG 无此语法糖，需手动创建 `BEFORE UPDATE` 触发器 |
| `COMMENT '...'` | `--` 行注释 | PG 不支持行内 COMMENT 语法，需用 `COMMENT ON COLUMN ... IS '...'` 或 SQL 注释 |
| `ENGINE=InnoDB` | — | PG 无存储引擎概念 |

---

# 最终表清单

| 表 | 作用 |
|---|---|
| chat_conversation | 会话列表 |
| chat_message | 消息树（核心） |
| chat_summary | 长上下文摘要 |
| chat_context | 模型请求快照 |
| chat_attachment | 文件附件 |
| chat_message_chunk | 流式输出 |
| chat_tool_call | 工具调用 |
| chat_agent_run | Agent执行 |
| chat_rag_reference | RAG引用 |

---

该设计可以支撑：

- DeepSeek Chat
- ChatGPT类产品
- LangChain Agent
- MCP工具调用
- RAG知识库
- 多Agent协同系统
