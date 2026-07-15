import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"], // 你的入口文件
  format: ["cjs", "esm"], // 同时输出 CJS 和 ESM，确保 Node.js 环境最大兼容性
  splitting: false, // 后端项目通常不需要代码分割
  sourcemap: false, // 方便生产环境调试
  clean: true, // 每次构建前清理 dist 目录
  target: "node20", // 目标 Node.js 版本（建议 Node 20+）
});
