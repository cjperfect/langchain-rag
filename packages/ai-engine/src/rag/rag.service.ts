import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { defaultEmbeddings } from "../embeddings";

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
  /** 余弦相似度 (0~1，越高越相似) */
  score: number;
}

/** PGVectorStore 中存储的 metadata */
interface ChunkMetadata {
  documentId: number;
  kbId: number;
  chunkIndex: number;
}

/** PGVectorStore 表名 */
const TABLE_NAME = "langchain_pg_embedding";

/** 向量维度（qwen3.7-text-embedding 默认 1024） */
const EMBEDDING_DIMENSIONS = Number(process.env.EMBEDDING_DIMENSIONS ?? "1024");

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
      tableName: TABLE_NAME,
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
      dimensions: EMBEDDING_DIMENSIONS,
    });
    return this.vectorStore;
  }

  /**
   * 索引文档：切片 + 向量化，返回切片数据供后端写 DB
   *
   * @param kbId 知识库 ID
   * @param documentId 文档 ID
   * @param content 文档全文
   * @returns 切片列表（含序号和 token 估算）
   */
  async indexDocument(
    kbId: number,
    documentId: number,
    content: string,
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
  ): Promise<ChunkData[]> {
    await this.deleteByDocumentId(documentId);
    return this.indexDocument(kbId, documentId, content);
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
        score: score, // PGVectorStore with scoreNormalization="similarity" already returns similarity
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
