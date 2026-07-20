/** 切片数据（索引后返回给后端写 DB） */
export interface ChunkData {
  /** 切片文本内容 */
  content: string;
  /** 切片序号 */
  index: number;
  /** 估算 token 数 */
  tokenCount: number;
}

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
  /** 余弦相似度 (0~1，越高越相似) */
  score: number;
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
