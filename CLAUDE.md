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

# 个人开发习惯

1. **包管理**：安装依赖包使用 `pnpm`，禁用 npm/yarn
2. **状态管理**：避免过多 `useState`，优先使用 `useReducer` 或合并状态对象
3. **接口/类型**：所有接口/类型定义提取到 `interfaces/` 目录，不在 UI 层声明；所有字段都要加注释
4. **属性访问**：优先使用解构赋值 `const { x, y } = obj`，避免 `obj.x` 或 `obj["x"]`
5. **文件命名**：采用 `业务名.功能.后缀` 格式，如 `chat.adapter.ts`、`knowledge.service.ts`
6. **常量**：固定变量和常量提取到 `constants/` 目录，按业务命名文件
7. **异步处理**：全部使用 `async/await`，禁止 `.then()` 链式调用
8. **删除操作**：所有删除必须有二次确认弹窗，UI 优先使用项目已有组件库的组件
9. **UI 开发**：先检查项目中是否已有可复用的组件，避免重复造轮子
10. **类型断言**：TypeScript 中尽量少用 `as` 类型断言，优先使用类型守卫或泛型
