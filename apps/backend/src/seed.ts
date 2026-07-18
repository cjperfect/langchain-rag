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
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
