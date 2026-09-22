import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { defaultEmbeddings } from "../embeddings";
import type { ChunkData, ChunkMetadata, RagMatchType, RagSearchMode, RagSearchResult } from "../interfaces/rag";
import { RAG_TABLE_NAME, RAG_EMBEDDING_DIMENSIONS } from "../constants/rag";
import { lexicalIndex, type PgPoolLike } from "./bm25";
import { emit, withTaskEvents, TaskEvent, TaskType } from "@langchain-rag/shared/events";

export type { ChunkData, RagSearchResult, RagSearchMode, RagMatchType };

/** RRF（Reciprocal Rank Fusion）常数：弱化头部名次差距，业界惯用 60 */
const RRF_K = 60;

/**
 * RAG 服务 — 文档向量化 + 混合检索（语义向量 + BM25 词法，RRF 融合）
 *
 * 使用 pgvector 的 PGVectorStore，AI Engine 负责全部索引操作，
 * 后端仅调用 indexDocument / search / deleteByDocumentId。
 * BM25 词法索引落在同库旁表 rag_bm25_index（见 bm25.ts），与向量表同步写入/删除。
 *
 * 每个耗时方法用 withTaskEvents 包一层，自动发送 started/completed/failed 事件，
 * 中间进度在回调里手动 emit PROGRESS。
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
    // BM25 复用 PGVectorStore 内部的 pg 连接池（同库同连接串，省一个 Pool 也省一个依赖）
    lexicalIndex.attach((this.vectorStore as unknown as { pool: PgPoolLike }).pool);
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
  async indexDocument(kbId: number, documentId: number, content: string, names?: { kbName?: string; documentName?: string }): Promise<ChunkData[]> {
    return withTaskEvents(TaskType.DOCUMENT_INDEX, { kbId, documentId, message: `索引文档 #${documentId}` }, (taskId) => this.vectorize(kbId, documentId, content, names, taskId));
  }

  /**
   * 重建索引：删除旧向量 → 重新切片 → 重新向量化
   */
  async reindexDocument(documentId: number, kbId: number, content: string, names?: { kbName?: string; documentName?: string }): Promise<ChunkData[]> {
    return withTaskEvents(TaskType.DOCUMENT_INDEX, { kbId, documentId, message: `重建索引文档 #${documentId}` }, async (taskId) => {
      await this.deleteByDocumentId(documentId);
      emit(TaskEvent.PROGRESS, { taskId, taskType: TaskType.DOCUMENT_INDEX, step: 1, message: "已删除旧向量" });
      return this.vectorize(kbId, documentId, content, names, taskId, 2);
    });
  }

  /**
   * 切片 + 向量化核心逻辑（不发 started/completed，由 withTaskEvents 统一发）
   *
   * @param taskId 任务 ID（用于发进度事件）
   * @param stepOffset 步骤偏移（重建索引时前面多了"删旧向量"一步）
   */
  private async vectorize(
    kbId: number,
    documentId: number,
    content: string,
    names: { kbName?: string; documentName?: string } | undefined,
    taskId: string,
    stepOffset = 1,
  ): Promise<ChunkData[]> {
    const texts = await splitTextToChunks(content);
    if (texts.length === 0) return [];

    emit(TaskEvent.PROGRESS, { taskId, taskType: TaskType.DOCUMENT_INDEX, step: stepOffset, message: `切片完成（${texts.length} 片），开始向量化` });

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

    // 向量与词法索引同步写入（rag_bm25_index 旁表，供 BM25 检索）
    await lexicalIndex.addChunks(
      kbId,
      documentId,
      { kbName: names?.kbName, documentName: names?.documentName },
      texts.map((text, i) => ({ content: text, index: i + 1 })),
    );

    emit(TaskEvent.PROGRESS, { taskId, taskType: TaskType.DOCUMENT_INDEX, step: stepOffset + 1, message: "向量化完成" });

    return texts.map((text, i) => ({
      content: text,
      index: i + 1,
      tokenCount: Math.ceil(text.length / 2),
    }));
  }

  /**
   * 检索（默认混合模式）
   *
   * - semantic：向量余弦相似度，长于语义近似（"如何请假" 能命中 "休假申请流程"）
   * - keyword：BM25 词法匹配，长于精确词（型号、错误码、人名等专有名词）
   * - hybrid：两路各取候选，用 RRF 融合排名 —— rank 求和不用原始分，
   *   天然规避"余弦分 0~1 与 BM25 分无上界"不可比的问题
   *
   * @param query 用户问题
   * @param options.kbIds 限制在指定知识库
   * @param options.k top-K
   * @param options.mode 检索模式，默认 hybrid
   */
  async search(query: string, options: { kbIds?: number[]; k?: number; mode?: RagSearchMode } = {}): Promise<RagSearchResult[]> {
    const { kbIds, k = 5, mode = "hybrid" } = options;
    // 每路多召回一些候选再融合，比各路只取 top-k 融合效果好
    const fetchK = Math.max(k * 2, 10);

    return withTaskEvents(TaskType.RAG_SEARCH, { kbIds, message: `检索：${query.slice(0, 50)}` }, async () => {
      // 先确保 PGVectorStore 已初始化 —— 它会顺带把 pg 连接池交给词法索引（keyword 模式也依赖它）
      await this.getStore();

      const lists: RagSearchResult[][] = [];

      if (mode !== "keyword") lists.push(await this.semanticSearch(query, kbIds, fetchK));
      if (mode !== "semantic") lists.push(await lexicalIndex.search(query, { kbIds, k: fetchK }));

      if (mode !== "hybrid") return lists[0].slice(0, k);
      return fuseRrf(lists, k);
    });
  }

  /** 向量相似度检索 */
  private async semanticSearch(query: string, kbIds: number[] | undefined, k: number): Promise<RagSearchResult[]> {
    const store = await this.getStore();

    const filter = kbIds && kbIds.length > 0 ? { kbId: { in: kbIds } } : undefined;

    // PGVectorStore 的 filter 类型对 { in: number[] } 形式不友好，沿用原作者的单层 as any 旁路
    const results = await store.similaritySearchWithScore(query, k, filter);

    return results.map(([doc, score]) => {
      const metadata = doc.metadata as unknown as ChunkMetadata;
      return {
        content: doc.pageContent,
        documentId: metadata.documentId,
        kbId: metadata.kbId,
        kbName: metadata.kbName,
        documentName: metadata.documentName,
        chunkIndex: metadata.chunkIndex,
        score,
        matchType: "semantic" as const,
      } satisfies RagSearchResult;
    });
  }

  /**
   * 删除某个文档的所有索引（向量 + BM25 词法）
   *
   * PGVectorStore 通过 metadata 过滤删除
   */
  async deleteByDocumentId(documentId: number): Promise<void> {
    const store = await this.getStore();
    // PGVectorStore 支持通过 metadata filter 删除
    await store.delete({ filter: { documentId } });
    await lexicalIndex.deleteByDocumentId(documentId);
  }
}

/**
 * RRF（Reciprocal Rank Fusion）融合多路检索结果
 *
 *   rrf(d) = Σ_lists 1 / (RRF_K + rank)
 *
 * 只用名次不用原始分，因此不需要给余弦相似度和 BM25 分做归一化对齐。
 * 同一个 chunk（documentId+chunkIndex 唯一）在两路里都出现时分数会累加，自然靠前。
 * 最终 score 除以理论最大值（两路都排第 1）归一化到 0~1，方便前端按百分比展示。
 */
function fuseRrf(lists: RagSearchResult[][], k: number): RagSearchResult[] {
  interface Fused {
    result: RagSearchResult;
    rrf: number;
    matched: Set<RagMatchType>;
  }
  const fused = new Map<string, Fused>();

  for (const list of lists) {
    list.forEach((result, rank) => {
      const key = `${result.documentId}#${result.chunkIndex ?? -1}`;
      const entry = fused.get(key) ?? { result, rrf: 0, matched: new Set<RagMatchType>() };
      entry.rrf += 1 / (RRF_K + rank + 1);
      entry.matched.add(result.matchType);
      fused.set(key, entry);
    });
  }

  const maxRrf = lists.length / (RRF_K + 1);

  return [...fused.values()]
    .sort((a, b) => b.rrf - a.rrf)
    .slice(0, k)
    .map(({ result, rrf, matched }) => ({
      ...result,
      score: rrf / maxRrf,
      matchType: matched.size > 1 ? "both" : [...matched][0],
    }));
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
