# LangChain RAG

企业内部知识库问答系统，基于 LangChain + DeepSeek + PostgreSQL/pgvector。

## 技术栈

| 模块     | 技术                                                                          |
| -------- | ----------------------------------------------------------------------------- |
| 前端     | Next.js 16 (Turbopack) + React 19 + Tailwind CSS 4 + shadcn/ui + assistant-ui |
| 后端     | NestJS 11 + Prisma 7                                                          |
| AI 引擎  | LangChain.js + DeepSeek                                                       |
| 数据库   | PostgreSQL 17 + pgvector                                                      |
| 构建工具 | pnpm workspace + tsup + oxlint/oxfmt                                          |

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

**apps/backend/.env**

```env
cp .env.example .env

DATABASE_URL=postgresql://root:chenjiang@localhost:5432/langchain_rag
DEEPSEEK_API_KEY=your-deepseek-api-key
```

### 3. 启动 PostgreSQL

```bash
docker compose -f docker/docker-compose.yml up -d
```

### 4. 初始化数据库

```bash
pnpm db:migrate

# 生成测试数据
pnpm db:seed

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

启动后访问：

- 前端：http://localhost:3000
- 后端 API：http://localhost:3001
