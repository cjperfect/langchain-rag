后端启动

```bash

# 1. 安装依赖
npm install

# 2. 生成 Prisma Client（如果 postinstall 没执行的话）
npx prisma generate

# 3. 运行数据库迁移（创建表结构）
npx prisma migrate dev

# 4. 启动项目
npm run start:dev

```
