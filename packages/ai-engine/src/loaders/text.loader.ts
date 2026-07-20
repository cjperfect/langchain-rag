import { readFileSync } from "fs";
import { Document } from "@langchain/core/documents";

/**
 * 加载纯文本文件（.txt、.md 等），返回单个 Document。
 *
 * @param filePath  文本文件路径
 */
export async function loadText(filePath: string): Promise<Document[]> {
  const content = readFileSync(filePath, "utf-8");
  return [
    new Document({
      pageContent: content,
      metadata: { source: filePath },
    }),
  ];
}

/**
 * 加载 Markdown 文件，与 loadText 行为一致，返回单个 Document。
 *
 * @param filePath  Markdown 文件路径
 */
export async function loadMarkdown(filePath: string): Promise<Document[]> {
  return loadText(filePath);
}
