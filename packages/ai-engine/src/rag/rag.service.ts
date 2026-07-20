import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { defaultEmbeddings } from "../embeddings";
import type { ChunkData, RagSearchResult, ChunkMetadata } from "../interfaces/rag";
import { RAG_TABLE_NAME, RAG_EMBEDDING_DIMENSIONS } from "../constants/rag";

export type { ChunkData, RagSearchResult };

/**
 * RAG 服务 — 文档向量化 + 向量检索
 *
 * 使用 pgvector 的 PGVectorStore，AI Engine 负责全部向量操作，
 * 后端仅调用 addDocuments / search / deleteByDocumentId。
 */
export class RagService {
  private vectorStore: PGVectorStore | null = null;
  private embeddings: EmbeddingsInterface;

  constructor(embeddings?: EmbeddingsInterface) {
    this.embeddings = embeddings ?? defaultEmbeddings;
  }

  /** 初始化 PGVectorStore（延迟初始化，避免模块加载时立即连接 DB） */
  private async getStore(): Promise<PGVectorStore> {
    if (this.vectorStore) return this.vectorStore;

    const config = {
      postgresConnectionOptions: {
        connectionString: process.env.DATABASE_URL,
      },
      tableName: RAG_TABLE_NAME,
      columns: {
        idColumnName: "id",
        contentColumnName: "content",
        metadataColumnName: "metadata",
        vectorColumnName: "embedding",
      },
      distanceStrategy: "cosine" as const,
      scoreNormalization: "similarity" as const,
    };

    this.vectorStore = await PGVectorStore.initialize(this.embeddings, {
      ...config,
      dimensions: RAG_EMBEDDING_DIMENSIONS,
    });
    return this.vectorStore;
  }

  /**
   * 索引文档：切片 + 向量化，返回切片数据供后端写 DB
   *
   * @param kbId 知识库 ID
   * @param documentId 文档 ID
   * @param content 文档全文
   * @param names 知识库名称 / 文档文件名（存入 vector metadata，检索时直接返回）
   * @returns 切片列表（含序号和 token 估算）
   */
  async indexDocument(
    kbId: number,
    documentId: number,
    content: string,
    names?: { kbName?: string; documentName?: string },
  ): Promise<ChunkData[]> {
    const texts = await splitTextToChunks(content);
    if (texts.length === 0) return [];

    const store = await this.getStore();

    const docs = texts.map(
      (text, i) =>
        new Document({
          pageContent: text,
          metadata: {
            documentId,
            kbId,
            chunkIndex: i + 1,
            kbName: names?.kbName,
            documentName: names?.documentName,
          } satisfies ChunkMetadata,
        }),
    );

    await store.addDocuments(docs);

    return texts.map((text, i) => ({
      content: text,
      index: i + 1,
      tokenCount: Math.ceil(text.length / 2),
    }));
  }

  /**
   * 重建索引：删除旧向量 → 重新切片 → 重新向量化
   */
  async reindexDocument(
    documentId: number,
    kbId: number,
    content: string,
    names?: { kbName?: string; documentName?: string },
  ): Promise<ChunkData[]> {
    await this.deleteByDocumentId(documentId);
    return this.indexDocument(kbId, documentId, content, names);
  }

  /**
   * 向量相似度检索
   *
   * @param query 用户问题
   * @param options.kbIds 限制在指定知识库
   * @param options.k top-K
   */
  async search(
    query: string,
    options: { kbIds?: number[]; k?: number } = {},
  ): Promise<RagSearchResult[]> {
    const { kbIds, k = 5 } = options;

    const store = await this.getStore();

    const filter = kbIds && kbIds.length > 0 ? { kbId: { in: kbIds } } : undefined;

    const results = await store.similaritySearchWithScore(query, k, filter as any);

    return results.map(([doc, score]) => {
      const metadata = doc.metadata as unknown as ChunkMetadata;
      return {
        content: doc.pageContent,
        documentId: metadata.documentId,
        kbId: metadata.kbId,
        kbName: metadata.kbName,
        documentName: metadata.documentName,
        score,
      };
    });
  }

  /**
   * 删除某个文档的所有向量
   *
   * PGVectorStore 通过 metadata 过滤删除
   */
  async deleteByDocumentId(documentId: number): Promise<void> {
    const store = await this.getStore();
    // PGVectorStore 支持通过 metadata filter 删除
    await store.delete({ filter: { documentId } });
  }

}

/**
 * 将文本按语义切分为切片
 *
 * 使用 RecursiveCharacterTextSplitter，按段落 → 句子 → 逗号 → 字 优先级递归切分，
 * 每个切片最大 500 字符，相邻切片重叠 50 字符。
 */
export async function splitTextToChunks(text: string): Promise<string[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50,
    separators: ["\n\n", "\n", "。", "！", "？", "；", "，", " ", ""],
  });

  const docs = await splitter.createDocuments([text]);
  return docs.map((d) => d.pageContent).filter(Boolean);
}

/** 默认 RAG 服务单例 */
export const ragService = new RagService();
