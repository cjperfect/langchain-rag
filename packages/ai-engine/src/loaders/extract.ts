import type { Document } from "@langchain/core/documents";
import { loadPdf } from "./pdf/loader";
import { loadMarkdown } from "./markdown/loader";

/**
 * 文档解析统一入口：backend 只需传入文件路径，内部按扩展名路由到对应 Loader。
 *
 * 类型路由是 ai-engine 的领域知识（支持哪些类型、各类型怎么解析），
 * 不暴露给 backend —— 后端不再需要自己判断 pdf/md 并挑选 loader。
 *
 * @param filePath 待解析文件路径（带扩展名）
 * @returns fileType（小写扩展名，供入库记录）+ 解析后的 Document 列表
 */
export async function parseDocument(filePath: string): Promise<{ fileType: string; docs: Document[] }> {
  const fileType = filePath.split(".").pop()?.toLowerCase() ?? "";

  switch (fileType) {
    case "pdf":
      return { fileType, docs: await loadPdf(filePath, { splitPages: false }) };
    case "md":
      return { fileType, docs: await loadMarkdown(filePath) };
    default:
      throw new Error(`暂不支持的文件类型：.${fileType}（当前支持 pdf / md）`);
  }
}
