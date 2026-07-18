/**
 * 知识库 API 封装（当前使用 mock 数据，后续替换为真实 API 请求）
 */

// import { get, post, patch, del } from "./api";

// ============================================================================
// 类型定义
// ============================================================================

export interface KnowledgeBase {
  id: number;
  name: string;
  description?: string;
  documentCount: number;
  status: number; // 1=正常 2=归档 3=删除
  createdAt: string;
  updatedAt: string;
}

export interface CreateKnowledgeBaseInput {
  name: string;
  description?: string;
}

export interface UpdateKnowledgeBaseInput {
  name?: string;
  description?: string;
}

export interface KnowledgeBaseDocument {
  id: number;
  knowledgeBaseId: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  chunkCount: number;
  status: number;
  createdAt: string;
}

export interface DocumentChunk {
  id: number;
  documentId: number;
  index: number;
  content: string;
  tokenCount: number;
}

// ============================================================================
// Mock 数据
// ============================================================================

const now = new Date();

const MOCK_KNOWLEDGE_BASES: KnowledgeBase[] = [
  {
    id: 1,
    name: "产品需求文档",
    description: "包含产品 PRD、功能规格说明和用户故事，用于 AI 辅助需求分析",
    documentCount: 24,
    status: 1,
    createdAt: new Date(now.getTime() - 7 * 86400000).toISOString(),
    updatedAt: new Date(now.getTime() - 2 * 3600000).toISOString(),
  },
  {
    id: 2,
    name: "技术文档库",
    description: "后端 API 文档、数据库设计、架构决策记录 (ADR)",
    documentCount: 18,
    status: 1,
    createdAt: new Date(now.getTime() - 14 * 86400000).toISOString(),
    updatedAt: new Date(now.getTime() - 86400000).toISOString(),
  },
  {
    id: 3,
    name: "运维手册",
    description: "部署流程、监控告警配置、故障排查指南",
    documentCount: 12,
    status: 1,
    createdAt: new Date(now.getTime() - 30 * 86400000).toISOString(),
    updatedAt: new Date(now.getTime() - 5 * 86400000).toISOString(),
  },
  {
    id: 4,
    name: "客户 FAQ",
    description: "常见问题解答、产品使用指南和最佳实践汇总",
    documentCount: 36,
    status: 1,
    createdAt: new Date(now.getTime() - 60 * 86400000).toISOString(),
    updatedAt: new Date(now.getTime() - 3 * 86400000).toISOString(),
  },
];

let nextId = 5;
const bases = [...MOCK_KNOWLEDGE_BASES];

// ============================================================================
// Mock 文档数据
// ============================================================================

function generateMockDocuments(kbId: number): KnowledgeBaseDocument[] {
  const fileTypes: Record<string, string[]> = {
    1: ["PRD", "用户故事", "功能规格", "竞品分析", "需求评审"],
    2: ["API", "数据库", "架构", "部署", "开发规范"],
    3: ["部署", "监控", "故障排查", "安全", "备份"],
    4: ["FAQ", "使用指南", "最佳实践", "版本发布", "培训"],
  };

  const extMap: Record<string, string> = {
    部署: "md",
    监控: "md",
    故障排查: "md",
    安全: "md",
    备份: "md",
    PRD: "pdf",
    用户故事: "md",
    功能规格: "pdf",
    竞品分析: "pdf",
    需求评审: "docx",
    API: "md",
    数据库: "sql",
    架构: "pdf",
    开发规范: "md",
    FAQ: "md",
    使用指南: "pdf",
    最佳实践: "md",
    版本发布: "md",
    培训: "pptx",
  };

  const names = fileTypes[kbId] ?? ["文档"];

  return names.map((name, i) => ({
    id: kbId * 100 + i + 1,
    knowledgeBaseId: kbId,
    fileName: `${name}.${extMap[name] ?? "md"}`,
    fileType: extMap[name] ?? "md",
    fileSize: Math.floor(Math.random() * 5000000) + 50000,
    chunkCount: Math.floor(Math.random() * 30) + 5,
    status: 1,
    createdAt: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
  }));
}

const MOCK_DOCUMENTS: Record<number, KnowledgeBaseDocument[]> = {
  1: generateMockDocuments(1),
  2: generateMockDocuments(2),
  3: generateMockDocuments(3),
  4: generateMockDocuments(4),
};

// ============================================================================
// Mock 切片数据（按文档ID）
// ============================================================================

function generateMockChunks(docId: number): DocumentChunk[] {
  const contents: Record<string, string[]> = {
    PRD: [
      "## 1. 产品概述\n\n本产品定位为企业级 RAG 智能助手，旨在通过检索增强生成技术提升企业知识管理效率。目标用户包括：\n- 企业知识管理员\n- 业务分析人员\n- 技术开发团队\n\n核心价值主张：让企业知识触手可及。",
      "## 2. 功能需求\n\n### 2.1 知识库管理\n- 支持创建多个知识库\n- 支持文档上传（PDF、Markdown、Word、TXT）\n- 自动文档切片与向量化\n- 知识库权限管理\n\n### 2.2 智能检索\n- 混合检索（关键词 + 语义向量）\n- 检索结果重排序\n- 引用溯源",
      "## 3. 技术架构\n\n### 前端\n- Next.js 16 + React 19\n- shadcn/ui 组件库\n- Tailwind CSS v4\n- assistant-ui 聊天框架\n\n### 后端\n- NestJS 11\n- Prisma ORM + PostgreSQL\n- pgvector 向量存储\n- LangChain.js AI 引擎",
      "## 4. 非功能需求\n\n| 指标 | 目标值 |\n|------|--------|\n| 检索延迟 | < 500ms |\n| 文档解析速度 | > 10页/秒 |\n| 系统可用性 | 99.9% |\n| 并发用户数 | 1000+ |\n\n安全要求：数据传输加密、API 鉴权、操作审计日志。",
    ],
    API: [
      '# 会话接口\n\n## GET /api/conversations\n\n获取当前用户的会话列表。\n\n### 请求参数\n| 参数 | 类型 | 必填 | 说明 |\n|------|------|------|------|\n| page | number | 否 | 页码，默认1 |\n| pageSize | number | 否 | 每页数量，默认20 |\n\n### 响应示例\n```json\n{\n  "code": 200,\n  "data": [\n    {\n      "id": 1,\n      "title": "产品需求讨论",\n      "lastMessageAt": "2025-07-15T10:30:00Z",\n      "messageCount": 42\n    }\n  ]\n}\n```',
      '## POST /api/chat\n\n发送消息并获取 AI 流式回复。\n\n### 请求体\n```json\n{\n  "prompt": "介绍一下 RAG 的原理",\n  "conversation_id": 1,\n  "parent_message_id": 10,\n  "model": "deepseek-v4-pro"\n}\n```\n\n### 响应\n使用 SSE (Server-Sent Events) 流式返回。事件类型包括：\n- `message` — 文本内容\n- `reasoning` — 推理过程\n- `tool_start` / `tool_end` — 工具调用\n- `done` — 完成信号',
      '## 知识库接口\n\n### GET /api/knowledge\n返回用户的所有知识库及文档数量统计。\n\n### POST /api/knowledge\n创建新知识库，请求体：\n```json\n{\n  "name": "技术文档库",\n  "description": "后端架构和API文档汇总"\n}\n```\n\n### POST /api/knowledge/:id/documents\n上传文档到指定知识库，使用 multipart/form-data。',
    ],
    部署: [
      "# 部署流程\n\n## 环境准备\n\n### 1. 系统要求\n- Ubuntu 22.04 LTS / macOS 14+\n- Node.js 22+\n- pnpm 10+\n- Docker 27+\n- PostgreSQL 17 (通过 Docker)\n\n### 2. 克隆项目\n```bash\ngit clone https://github.com/org/langchain-rag.git\ncd langchain-rag\n```\n\n### 3. 安装依赖\n```bash\npnpm install\n```",
      "## Docker 部署\n\n### 启动 PostgreSQL (含 pgvector)\n```bash\ncd docker\ndocker compose up -d\n```\n\n### 初始化数据库\n```bash\ncd apps/backend\ncp .env.example .env\n# 编辑 .env 配置数据库连接\nnpx prisma migrate deploy\nnpx prisma generate\n```\n\n### 启动服务\n```bash\n# 终端 1: 后端\npnpm --filter @langchain-rag/backend dev\n\n# 终端 2: 前端\npnpm --filter @langchain-rag/frontend dev\n```",
      "## 生产环境配置\n\n### 环境变量\n| 变量 | 说明 | 示例 |\n|------|------|------|\n| DATABASE_URL | 数据库连接 | postgresql://user:pass@host:5432/rag |\n| JWT_SECRET | JWT 签名密钥 | your-256-bit-secret |\n| AI_API_KEY | AI 服务密钥 | sk-xxxx |\n| AI_BASE_URL | AI 服务地址 | https://api.deepseek.com/v1 |\n\n### Nginx 反向代理\n```nginx\nserver {\n  listen 80;\n  server_name rag.example.com;\n  location / { proxy_pass http://localhost:3000; }\n  location /api { proxy_pass http://localhost:3001/api; }\n}\n```",
    ],
    FAQ: [
      "## 常见问题\n\n### Q1: 知识库支持哪些文档格式？\n目前支持以下格式：\n- **PDF** (.pdf) — 支持文本型 PDF，扫描件需 OCR 预处理\n- **Markdown** (.md) — 推荐格式，解析效果最佳\n- **Word** (.docx) — 支持文字和表格内容\n- **纯文本** (.txt) — UTF-8 编码\n- **代码文件** (.ts, .tsx, .js, .py, .sql 等)\n\n后续计划支持：PPT、Excel、HTML、EPUB。",
      "### Q2: 文档切片是如何工作的？\n系统采用智能切片策略：\n1. **Markdown 文档**：按标题层级切分，保持段落完整性\n2. **普通文档**：使用滑动窗口方式，每个切片约 500 tokens\n3. **代码文件**：按函数/类边界切分\n\n切片间保留 50 token 的重叠，避免上下文断裂。检索时使用父文档检索策略，确保回答的完整性。",
      "### Q3: 如何提升检索准确率？\n建议从以下几个方面优化：\n1. **文档质量**：确保文档内容清晰、结构良好\n2. **命名规范**：使用有意义的文件名和知识库名称\n3. **切片策略**：根据文档类型选择合适的切片大小\n4. **混合检索**：开启关键词 + 语义向量混合模式\n5. **重排序**：对候选结果进行 Cross-encoder 重排",
      "### Q4: 知识库有容量限制吗？\n当前版本的限制：\n- 单个知识库：最多 1000 个文档\n- 单个文档：最大 50MB\n- 切片总数：每个知识库最多 100,000 条\n- 总存储空间：每用户 5GB\n\n如需扩容，请联系管理员升级套餐。",
    ],
    默认: [
      "本段内容简要介绍了 RAG（检索增强生成）的基本原理。\n\nRAG 将大语言模型与外部知识库结合，在生成回答前先从知识库中检索相关信息，将检索结果作为上下文注入模型的 Prompt 中，从而使模型能够基于最新、准确的知识进行回答。\n\n核心流程包括：文档加载 → 文本切片 → 向量嵌入 → 相似度检索 → 上下文增强生成。",
      "## 切片策略对比\n\n| 策略 | 粒度 | 优点 | 缺点 |\n|------|------|------|------|\n| 固定长度 | 粗 | 简单高效 | 语义不完整 |\n| 语义分块 | 中 | 语义连贯 | 计算开销大 |\n| 递归分割 | 细 | 灵活适配 | 参数调优难 |\n| 文档感知 | 最优 | 按结构切分 | 需格式支持 |\n\n推荐优先使用文档感知策略，对无结构文本回退到递归分割。",
      "向量嵌入是将文本转换为高维数值向量的过程。相似文本在向量空间中距离较近，是语义检索的基础。\n\n常用的嵌入模型：\n- text-embedding-3-small (1536维)\n- text-embedding-3-large (3072维)\n- bge-large-zh-v1.5 (1024维，中文优化)\n- m3e-base (768维，中文优化)",
    ],
  };

  // 尝试匹配特定内容，否则使用通用模板
  const allContents = Object.values(contents).flat();
  const fallbackKeys = Object.keys(contents);

  return Array.from({ length: Math.floor(Math.random() * 8) + 3 }, (_, i) => {
    const contentPool = contents[fallbackKeys[docId % fallbackKeys.length]] ?? allContents;
    return {
      id: docId * 1000 + i + 1,
      documentId: docId,
      index: i + 1,
      content: contentPool[i % contentPool.length] ?? allContents[i % allContents.length],
      tokenCount: Math.floor(Math.random() * 300) + 80,
    };
  });
}

const MOCK_CHUNKS: Record<number, DocumentChunk[]> = {};

// ============================================================================
// API 函数（mock 实现，后续替换为真实请求）
// ============================================================================

function delay<T>(data: T, ms = 400): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

export async function getKnowledgeBases(): Promise<KnowledgeBase[]> {
  // TODO: return get<KnowledgeBase[]>("/knowledge");
  return delay([...bases]);
}

export async function getKnowledgeBase(id: number): Promise<KnowledgeBase> {
  // TODO: return get<KnowledgeBase>(`/knowledge/${id}`);
  const kb = bases.find((b) => b.id === id);
  if (!kb) throw new Error("知识库不存在");
  return delay({ ...kb });
}

export async function createKnowledgeBase(input: CreateKnowledgeBaseInput): Promise<KnowledgeBase> {
  // TODO: return post<KnowledgeBase>("/knowledge", input);
  const kb: KnowledgeBase = {
    id: nextId++,
    name: input.name,
    description: input.description,
    documentCount: 0,
    status: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  bases.unshift(kb);
  return delay(kb);
}

export async function updateKnowledgeBase(id: number, input: UpdateKnowledgeBaseInput): Promise<KnowledgeBase> {
  // TODO: return patch<KnowledgeBase>(`/knowledge/${id}`, input);
  const idx = bases.findIndex((b) => b.id === id);
  if (idx === -1) throw new Error("知识库不存在");
  bases[idx] = { ...bases[idx], ...input, updatedAt: new Date().toISOString() };
  return delay(bases[idx]);
}

export async function deleteKnowledgeBase(id: number): Promise<void> {
  // TODO: return del<void>(`/knowledge/${id}`);
  const idx = bases.findIndex((b) => b.id === id);
  if (idx === -1) throw new Error("知识库不存在");
  bases.splice(idx, 1);
  return delay(undefined);
}

// ============================================================================
// 文档 & 切片 API
// ============================================================================

export async function getDocuments(knowledgeBaseId: number): Promise<KnowledgeBaseDocument[]> {
  // TODO: return get<KnowledgeBaseDocument[]>(`/knowledge/${knowledgeBaseId}/documents`);
  if (!MOCK_DOCUMENTS[knowledgeBaseId]) {
    MOCK_DOCUMENTS[knowledgeBaseId] = generateMockDocuments(knowledgeBaseId);
  }
  return delay([...MOCK_DOCUMENTS[knowledgeBaseId]]);
}

export async function getChunks(documentId: number): Promise<DocumentChunk[]> {
  // TODO: return get<DocumentChunk[]>(`/documents/${documentId}/chunks`);
  if (!MOCK_CHUNKS[documentId]) {
    MOCK_CHUNKS[documentId] = generateMockChunks(documentId);
  }
  return delay([...MOCK_CHUNKS[documentId]], 300);
}
