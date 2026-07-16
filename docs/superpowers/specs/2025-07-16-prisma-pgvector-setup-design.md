# Prisma + PostgreSQL + pgvector 环境配置

## 概述

为 NestJS 后端配置 Prisma ORM + PostgreSQL（含 pgvector 扩展）开发环境，为后续 RAG 功能中的向量存储与检索做好准备。

## 架构

```
docker/postgres (pgvector/pgvector:pg17)
       │ :5432
       ▼
DATABASE_URL ──► PrismaClient ──► PrismaService (可注入 Provider)
                                           │
                                    NestJS Service 层
                                           │
                                    Controller / Resolver
```

## 配置项

### Docker 容器

- **位置**: `docker/docker-compose.yml`
- **镜像**: `pgvector/pgvector:pg17`（标准 PostgreSQL 17 + pgvector 预装）
- **数据库名**: `langchain_rag`
- **用户/密码**: `postgres` / `postgres`
- **端口**: 5432
- **数据卷**: `pgdata` 持久化

### 环境变量

- **`DATABASE_URL`**: `postgresql://postgres:postgres@localhost:5432/langchain_rag`

### Prisma Schema

- **位置**: `apps/backend/prisma/schema.prisma`
- **数据源**: `postgresql`，通过 `DATABASE_URL` 环境变量连接
- **Client 输出**: `../src/generated/prisma`（已在 `.gitignore` 中排除）
- **pgvector 扩展**: 通过 `extensions` 属性声明，支持 vector 类型

### NestJS 集成

- **PrismaModule**: `apps/backend/src/prisma/prisma.module.ts`
  - 全局模块，导出 PrismaService
- **PrismaService**: `apps/backend/src/prisma/prisma.service.ts`
  - 继承 PrismaClient，处理连接生命周期（onModuleInit / onModuleDestroy）

### 依赖

| 包名 | 类型 | 说明 |
|------|------|------|
| `@prisma/client` | runtime | Prisma ORM 客户端 |
| `prisma` | dev | Prisma CLI（已安装） |

## 后续向量支持

pgvector 扩展就绪后，Prisma Schema 中可使用 `Unsupported("vector")` 类型标注向量字段，或通过原始查询执行向量相似度搜索（`SELECT * FROM items ORDER BY embedding <-> $1 LIMIT 5`）。具体 Schema 设计在后续 RAG 功能开发时补充。

## 实施步骤

1. 创建 `docker/docker-compose.yml`
2. 更新 `.env` 的 DATABASE_URL
3. 更新 Prisma Schema（添加 url + 扩展声明）
4. 安装 `@prisma/client`
5. 创建 PrismaModule + PrismaService
6. 生成 Prisma Client
7. 启动 PostgreSQL 容器并测试连接
