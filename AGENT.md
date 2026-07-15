# 项目背景

- 技术栈：Next.js 14 + TypeScript + Tailwind CSS
- UI 组件库：Shadcn-ui
- 状态管理：Zustand
- 包管理器：pnpm

# 代码规范

- 组件使用函数式声明 + 默认导出
- 所有异步操作必须包含 try-catch 错误处理
- 样式优先使用 Tailwind 类名，禁止编写自定义 CSS
- 所有组件必须包含必要的 props 类型定义
- 对象解构赋值必须包含必要的类型定义

# 常用命令

- 开发：pnpm dev
- 构建：pnpm build
