/** PGVectorStore 表名 */
export const RAG_TABLE_NAME = "langchain_pg_embedding";

/** BM25 词法索引旁表名（与向量表按 documentId+chunkIndex 对应） */
export const LEXICAL_TABLE_NAME = "rag_bm25_index";

/** 向量维度（qwen3-embedding:0.6b 默认 1024） */
export const RAG_EMBEDDING_DIMENSIONS = Number(process.env.EMBEDDING_DIMENSIONS ?? "1024");
