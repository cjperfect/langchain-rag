# LangChain RAG

企业内部知识库问答系统，基于 LangChain + DeepSeek + PostgreSQL/pgvector。

## 技术栈

| 模块 | 技术 |
|---|---|
| 前端 | Next.js 16 (Turbopack) + React 19 + Tailwind CSS 4 + shadcn/ui + assistant-ui |
| 后端 | NestJS 11 + Prisma 7 |
| AI 引擎 | LangChain.js + DeepSeek |
| 数据库 | PostgreSQL 17 + pgvector |
| 构建工具 | pnpm workspace + tsup + oxlint/oxfmt |

## 项目结构

```
langchain-rag/
├── apps/
│   ├── backend/          # NestJS API 服务 (端口 3001)
│   └── frontend/         # Next.js 前端应用 (端口 3000)
├── packages/
│   ├── ai-engine/        # LangChain RAG 引擎
│   └── shared/           # 共享类型（规划中）
├── docker/
│   └── docker-compose.yml  # PostgreSQL 17
└── pnpm-workspace.yaml
```

## 前置环境

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 9
- [Docker](https://www.docker.com/)（用于运行 PostgreSQL）
- DeepSeek API Key（[申请地址](https://platform.deepseek.com/)）

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 环境变量配置

三个项目各自需要 `.env` 文件，参考对应的 `.env.example` 模板：

**apps/backend/.env**

```env
DATABASE_URL=postgresql://root:chenjiang@localhost:5432/langchain_rag
DEEPSEEK_API_KEY=your-deepseek-api-key
```

**apps/frontend/.env**

```env
DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_API_BASE_URL=https://api.deepseek.com
```

**packages/ai-engine/.env**

```env
DEEPSEEK_API_KEY=your-deepseek-api-key
```

### 3. 启动 PostgreSQL

```bash
docker compose -f docker/docker-compose.yml up -d
```

### 4. 初始化数据库

```bash
cd apps/backend

# 生成 Prisma Client
npx prisma generate

# 运行数据库迁移（创建表结构）
npx prisma migrate dev
```

### 5. 启动 AI 引擎（开发模式）

```bash
# 在项目根目录执行，监听文件变化自动重新构建
pnpm dev:ai-engine
```

### 6. 启动后端

```bash
# 在项目根目录执行，端口 3001，文件变化自动重启
pnpm dev:backend
```

### 7. 启动前端

```bash
# 在项目根目录执行，端口 3000，Turbopack 热更新
pnpm dev:frontend
```

## 一键启动（开发）

在项目根目录依次执行：

```bash
# 终端 1：启动 PostgreSQL
docker compose -f docker/docker-compose.yml up -d

# 终端 2：构建并监听 AI 引擎
pnpm dev:ai-engine

# 终端 3：启动后端
pnpm dev:backend

# 终端 4：启动前端
pnpm dev:frontend
```

启动后访问：
- 前端：http://localhost:3000
- 后端 API：http://localhost:3001