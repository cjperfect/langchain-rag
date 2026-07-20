import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import type { Document } from "@langchain/core/documents";
import { PdfLoadOptions } from "../interfaces/loader";

/**
 * 加载 PDF 文件，提取文本内容。
 *
 * @param filePath  PDF 文件路径
 * @param options   可选：splitPages（按页分割）、parsedItemSeparator（页间分隔符）
 */
export async function loadPdf(filePath: string, options?: PdfLoadOptions): Promise<Document[]> {
  const loader = new PDFLoader(filePath, {
    splitPages: options?.splitPages,
    parsedItemSeparator: options?.parsedItemSeparator,
  });
  return loader.load();
}
