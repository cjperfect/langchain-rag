import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env["DATABASE_URL"]! }),
});

async function main() {
  console.log("🌱 Seeding database...");

  const password = await bcrypt.hash("123456", 10);

  const user = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      name: "陈江",
      email: "admin@example.com",
      password,
    },
  });

  console.log(`✅ Created user: ${user.email} (id: ${user.id})`);

  // ==========================================================================
  // 知识库测试数据
  // ==========================================================================

  const kb = await prisma.knowledgeBase.create({
    data: {
      userId: user.id,
      name: "LangChain 技术文档",
      description: "LangChain 框架的中文技术文档和最佳实践",
      documentCount: 1,
      chunkCount: 3,
    },
  });

  console.log(`✅ Created knowledge base: ${kb.name} (id: ${kb.id})`);

  const doc = await prisma.knowledgeDocument.create({
    data: {
      knowledgeBaseId: kb.id,
      userId: user.id,
      fileName: "langchain-intro.txt",
      fileType: "txt",
      fileSize: 1024,
      content: "LangChain 是一个用于构建 LLM 应用的开源框架。它提供了 Chains、Agents、Tools 等核心抽象。",
      chunkCount: 3,
    },
  });

  console.log(`✅ Created document: ${doc.fileName} (id: ${doc.id})`);

  const chunks = await Promise.all([
    prisma.knowledgeChunk.create({
      data: {
        documentId: doc.id,
        kbId: kb.id,
        index: 0,
        content: "LangChain 是一个用于构建 LLM 应用的开源框架。",
        tokenCount: 15,
      },
    }),
    prisma.knowledgeChunk.create({
      data: {
        documentId: doc.id,
        kbId: kb.id,
        index: 1,
        content: "它提供了 Chains、Agents、Tools 等核心抽象。",
        tokenCount: 12,
      },
    }),
    prisma.knowledgeChunk.create({
      data: {
        documentId: doc.id,
        kbId: kb.id,
        index: 2,
        content: "开发者可以通过组合这些组件快速搭建 RAG 管道。",
        tokenCount: 10,
      },
    }),
  ]);

  console.log(`✅ Created ${chunks.length} chunks for document`);

  // ==========================================================================
  // 知识库 2
  // ==========================================================================

  const kb2 = await prisma.knowledgeBase.create({
    data: {
      userId: user.id,
      name: "React 最佳实践",
      description: "React 组件设计、性能优化、状态管理等常见模式和反模式",
      documentCount: 1,
      chunkCount: 2,
    },
  });

  console.log(`✅ Created knowledge base: ${kb2.name} (id: ${kb2.id})`);

  const doc2 = await prisma.knowledgeDocument.create({
    data: {
      knowledgeBaseId: kb2.id,
      userId: user.id,
      fileName: "react-hooks-guide.txt",
      fileType: "txt",
      fileSize: 2048,
      content: "React Hooks 是 React 16.8 引入的特性，允许在函数组件中使用 state 和其他 React 特性。常用的 Hooks 包括 useState、useEffect、useMemo、useCallback 等。合理使用 Hooks 可以显著提升代码可读性和复用性。",
      chunkCount: 2,
    },
  });

  console.log(`✅ Created document: ${doc2.fileName} (id: ${doc2.id})`);

  await Promise.all([
    prisma.knowledgeChunk.create({
      data: {
        documentId: doc2.id,
        kbId: kb2.id,
        index: 0,
        content: "React Hooks 是 React 16.8 引入的特性，允许在函数组件中使用 state 和其他 React 特性。",
        tokenCount: 20,
      },
    }),
    prisma.knowledgeChunk.create({
      data: {
        documentId: doc2.id,
        kbId: kb2.id,
        index: 1,
        content: "常用的 Hooks 包括 useState、useEffect、useMemo、useCallback 等。合理使用 Hooks 可以显著提升代码可读性和复用性。",
        tokenCount: 18,
      },
    }),
  ]);

  console.log("✅ Created 2 chunks for React document");

  // ==========================================================================
  // 知识库 3
  // ==========================================================================

  const kb3 = await prisma.knowledgeBase.create({
    data: {
      userId: user.id,
      name: "NestJS 开发指南",
      description: "NestJS 企业级 Node.js 框架的模块化设计、依赖注入、中间件和守卫",
      documentCount: 1,
      chunkCount: 2,
    },
  });

  console.log(`✅ Created knowledge base: ${kb3.name} (id: ${kb3.id})`);

  const doc3 = await prisma.knowledgeDocument.create({
    data: {
      knowledgeBaseId: kb3.id,
      userId: user.id,
      fileName: "nestjs-modules.md",
      fileType: "md",
      fileSize: 1536,
      content: "NestJS 使用模块（Module）来组织应用结构。每个应用至少有一个根模块。通过 @Module 装饰器声明模块，并通过 imports、controllers、providers 来管理依赖。依赖注入（DI）是 NestJS 的核心特性，大大简化了测试和模块解耦。",
      chunkCount: 2,
    },
  });

  console.log(`✅ Created document: ${doc3.fileName} (id: ${doc3.id})`);

  await Promise.all([
    prisma.knowledgeChunk.create({
      data: {
        documentId: doc3.id,
        kbId: kb3.id,
        index: 0,
        content: "NestJS 使用模块（Module）来组织应用结构。每个应用至少有一个根模块。通过 @Module 装饰器声明模块，并通过 imports、controllers、providers 来管理依赖。",
        tokenCount: 22,
      },
    }),
    prisma.knowledgeChunk.create({
      data: {
        documentId: doc3.id,
        kbId: kb3.id,
        index: 1,
        content: "依赖注入（DI）是 NestJS 的核心特性，大大简化了测试和模块解耦。",
        tokenCount: 14,
      },
    }),
  ]);

  console.log("✅ Created 2 chunks for NestJS document");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
