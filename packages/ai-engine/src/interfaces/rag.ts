/** 切片数据（索引后返回给后端写 DB） */
export interface ChunkData {
  /** 切片文本内容 */
  content: string;
  /** 切片序号 */
  index: number;
  /** 估算 token 数 */
  tokenCount: number;
}

/** 检索模式：混合（语义+BM25，RRF 融合）/ 纯语义 / 纯关键词 */
export type RagSearchMode = "hybrid" | "semantic" | "keyword";

/** 结果的命中来源 */
export type RagMatchType = "semantic" | "keyword" | "both";

/** 检索结果 */
export interface RagSearchResult {
  /** chunk 文本内容 */
  content: string;
  /** 文档 ID */
  documentId: number;
  /** 知识库 ID */
  kbId: number;
  /** 知识库名称 */
  kbName?: string;
  /** 文档文件名 */
  documentName?: string;
  /** 切片在文档内的序号（用于混合检索时跨两路结果去重合并） */
  chunkIndex?: number;
  /**
   * semantic 模式下是余弦相似度 (0~1)；
   * hybrid 模式下是 RRF 融合分归一化到 0~1（两路都排名第 1 ≈ 1.0，单路第一 ≈ 0.5）；
   * keyword 模式下是 BM25 原始分（无上界）
   */
  score: number;
  /** 命中来源 */
  matchType: RagMatchType;
}

/** PGVectorStore 中存储的 metadata */
export interface ChunkMetadata {
  documentId: number;
  kbId: number;
  chunkIndex: number;
  /** 知识库名称（便于检索时直接返回，无需查 DB） */
  kbName?: string;
  /** 文档文件名 */
  documentName?: string;
}
