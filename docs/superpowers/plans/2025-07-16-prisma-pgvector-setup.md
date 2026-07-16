# Prisma + PostgreSQL + pgvector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure Prisma ORM with PostgreSQL (pgvector) for the NestJS backend, with Docker containerized database.

**Architecture:** A `docker/docker-compose.yml` runs PostgreSQL 17 with pgvector pre-installed. The NestJS app uses a custom `PrismaModule` → `PrismaService` (wrapping PrismaClient) injected into the application layer. Prisma Schema is already initialized; update datasource config and generate the client.

**Tech Stack:** Docker, PostgreSQL 17, pgvector, Prisma 7, NestJS 11

## Global Constraints

- PostgreSQL runs via Docker with `pgvector/pgvector:pg17` image
- DATABASE_URL format: `postgresql://postgres:postgres@localhost:5432/langchain_rag`
- Prisma client output path: `../src/generated/prisma` (already configured)
- PrismaModule is a custom Global module (no `nestjs-prisma` package)
- All docker files in `docker/` at repo root
- `.gitignore` already excludes `/src/generated/prisma` (no change needed)

---
### Task 1: Create Docker Compose for PostgreSQL + pgvector

**Files:**
- Create: `docker/docker-compose.yml`

- [ ] **Step 1: Create docker-compose.yml**

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg17
    container_name: langchain-rag-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: langchain_rag
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

- [ ] **Step 2: Commit**

```bash
git add docker/docker-compose.yml
git commit -m "feat: add docker-compose with postgres + pgvector"
```

---

### Task 2: Update Environment Variables

**Files:**
- Modify: `apps/backend/.env.example`
- Modify: `apps/backend/.env`

- [ ] **Step 1: Update .env with production DATABASE_URL**

Write to `apps/backend/.env`:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/langchain_rag"
```

- [ ] **Step 2: Update .env.example**

Write to `apps/backend/.env.example`:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/langchain_rag"
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/.env apps/backend/.env.example
git commit -m "chore: update DATABASE_URL for local postgres"
```

---

### Task 3: Update Prisma Schema

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`

- [ ] **Step 1: Update schema with datasource URL and pgvector extension**

Write to `apps/backend/prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions {
    vector   = {
      version: "0.8.0"
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/prisma/schema.prisma
git commit -m "feat: add datasource url and pgvector extension to prisma schema"
```

---

### Task 4: Install @prisma/client and Install Dependencies

**Files:**
- Modify: `apps/backend/package.json`

- [ ] **Step 1: Install @prisma/client**

Run from repo root:
```bash
pnpm --filter backend add @prisma/client
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/package.json pnpm-lock.yaml
git commit -m "feat: add @prisma/client dependency"
```

---

### Task 5: Create PrismaModule and PrismaService

**Files:**
- Create: `apps/backend/src/prisma/prisma.service.ts`
- Create: `apps/backend/src/prisma/prisma.module.ts`

- [ ] **Step 1: Create PrismaService**

Write to `apps/backend/src/prisma/prisma.service.ts`:
```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "../generated/prisma";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

- [ ] **Step 2: Create PrismaModule**

Write to `apps/backend/src/prisma/prisma.module.ts`:
```typescript
import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/prisma/
git commit -m "feat: add PrismaModule and PrismaService"
```

---

### Task 6: Integrate PrismaModule into AppModule

**Files:**
- Modify: `apps/backend/src/app.module.ts`

- [ ] **Step 1: Import PrismaModule in AppModule**

Edit `apps/backend/src/app.module.ts`:
```typescript
import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ChatModule } from "./chat/chat.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [PrismaModule, ChatModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/app.module.ts
git commit -m "feat: integrate PrismaModule into AppModule"
```

---

### Task 7: Generate Prisma Client and Verify

**Files:**
- Run: `prisma generate`

- [ ] **Step 1: Start PostgreSQL container**

```bash
docker compose -f docker/docker-compose.yml up -d
```

Wait a few seconds for the health check to pass.

- [ ] **Step 2: Generate Prisma client**

```bash
cd apps/backend && npx prisma generate
```

Expected output: Prisma Client generated to `src/generated/prisma`

- [ ] **Step 3: Push schema to database (create vector extension)**

```bash
cd apps/backend && npx prisma db push
```

Expected output: Your database is now in sync with your schema.

- [ ] **Step 4: Verify PrismaClient import works**

```bash
cd apps/backend && npx ts-node -e "
const { PrismaClient } = require('./src/generated/prisma');
const client = new PrismaClient();
client.\$connect().then(() => {
  console.log('Connected successfully!');
  return client.\$disconnect();
}).catch(console.error);
"
```

Expected output: `Connected successfully!`

- [ ] **Step 5: Commit generated files**

```bash
git add apps/backend/src/generated/prisma
git commit -m "feat: generate prisma client"
```
