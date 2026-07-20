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
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
