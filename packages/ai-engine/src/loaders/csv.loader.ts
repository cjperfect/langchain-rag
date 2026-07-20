import { CSVLoader } from "@langchain/community/document_loaders/fs/csv";
import type { Document } from "@langchain/core/documents";
import { CsvLoadOptions } from "../interfaces/loader";

/**
 * 加载 CSV 文件，每行返回一个 Document。
 *
 * @param filePath  CSV 文件路径
 * @param options   可选：指定 column 用该列内容作为 pageContent
 */
export async function loadCsv(filePath: string, options?: CsvLoadOptions): Promise<Document[]> {
  const loader = new CSVLoader(filePath, options);
  return loader.load();
}
