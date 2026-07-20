/** PGVectorStore 表名 */
export const RAG_TABLE_NAME = "langchain_pg_embedding";

/** 向量维度（qwen3-embedding:0.6b 默认 1024） */
export const RAG_EMBEDDING_DIMENSIONS = Number(process.env.EMBEDDING_DIMENSIONS ?? "1024");
