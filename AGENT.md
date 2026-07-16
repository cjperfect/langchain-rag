# 项目背景

企业内部知识库问答系统，用于回答企业内部员工的问题。

# 技术栈

- apps/backend 技术栈：Nest.js + TypeScript + Prisma + PostgreSQL
- apps/frontend 技术栈：Next.js 14 + TypeScript + Tailwind CSS + Shadcn-ui + assistant-ui
- packages/ai-engine 技术栈：Langchain + TypeScript + Deepseek + pgvector

# 项目结构

- apps/backend 主要是定义API路由和数据库的操作
- apps/frontend 主要是定义前端的组件和路由
- packages/ai-engine 主要是定义AI引擎的逻辑
- packages/shared 主要是定义共享的类型

# 代码规范

- 组件使用函数式声明 + 默认导出
- 所有异步操作必须包含 try-catch 错误处理
- 样式优先使用 Tailwind 类名，禁止编写自定义 CSS
- 所有组件必须包含必要的 props 类型定义
- 对象解构赋值必须包含必要的类型定义

# 常用命令

- 开发：pnpm dev
- 构建：pnpm build
