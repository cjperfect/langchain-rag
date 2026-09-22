/**
 * BM25 词法检索 — 纯 SQL 实现在 PostgreSQL 里
 *
 * 为什么不用数据库自带全文检索：镜像 pgvector/pgvector:pg17 没有 zhparser/pg_jieba，
 * 内置 to_tsvector 无法切中文。所以分词在 TS 侧完成（见 tokenizer.ts），
 * token 数组落到旁表 rag_bm25_index，BM25 打分公式直接翻译成一条 SQL：
 *
 *   score(q,d) = Σ_t  idf(t) · tf(t,d)·(k1+1) / ( tf(t,d) + k1·(1-b+b·|d|/avgdl) )
 *   idf(t)     = ln(1 + (N - df(t) + 0.5) / (df(t) + 0.5))      -- Lucene 风格，恒为非负
 *
 * 表结构与向量库解耦：向量在 langchain_pg_embedding（PGVectorStore 管），
 * 词法在这张旁表，删除/重建时两边同步。
 */
import { tokenizeForIndex, tokenizeQuery } from "./tokenizer";
import type { ChunkData, RagSearchResult } from "../interfaces/rag";
import { LEXICAL_TABLE_NAME, RAG_TABLE_NAME } from "../constants/rag";

/** BM25 调参：k1 控制词频饱和（1.2~2.0），b 控制长度归一化强度（0~1） */
export const BM25_PARAMS = { k1: 1.2, b: 0.75 };

/** 只声明用到的 pg.Pool 子集 —— 复用 PGVectorStore 内部已建好的连接池，避免额外依赖 */
export interface PgPoolLike {
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
}

interface LexicalChunk {
  index: number;
  content: string;
  kbId: number;
  documentId: number;
  kbName?: string;
  documentName?: string;
}

/** BM25 打分 SQL：$1=kbIds(int[]|null) $2=query tokens(text[]) $3=limit */
const BM25_SQL = `
WITH params AS (SELECT $4::float8 AS k1, $5::float8 AS b),
docs AS (
  SELECT id, document_id, kb_id, chunk_index, content, kb_name, document_name, tokens, token_count
  FROM ${LEXICAL_TABLE_NAME}
  WHERE $1::int[] IS NULL OR kb_id = ANY($1)
),
corpus AS (
  SELECT count(*)::float8 AS n, coalesce(avg(token_count)::float8, 1) AS avgdl
  FROM docs
),
terms AS (SELECT DISTINCT unnest($2::text[]) AS term),
cands AS (
  SELECT * FROM docs WHERE tokens && $2::text[]
),
df AS (
  SELECT t.term, count(c.id)::float8 AS n_df
  FROM terms t
  LEFT JOIN cands c ON c.tokens @> ARRAY[t.term]
  GROUP BY t.term
),
idf AS (
  SELECT d.term, ln(1 + (co.n - d.n_df + 0.5) / (d.n_df + 0.5)) AS idf
  FROM df d
  CROSS JOIN corpus co
  WHERE d.n_df > 0
),
tf AS (
  SELECT c.id, w.term, count(*)::float8 AS n_tf
  FROM cands c
  JOIN LATERAL unnest(c.tokens) AS w(term) ON true
  JOIN terms t ON t.term = w.term
  GROUP BY c.id, w.term
)
SELECT c.document_id, c.kb_id, c.chunk_index, c.content, c.kb_name, c.document_name,
       sum(i.idf * (tf.n_tf * (p.k1 + 1)) / (tf.n_tf + p.k1 * (1 - p.b + p.b * c.token_count / co.avgdl)))::float8 AS score
FROM tf
JOIN idf i ON i.term = tf.term
JOIN cands c ON c.id = tf.id
CROSS JOIN params p
CROSS JOIN corpus co
GROUP BY c.document_id, c.kb_id, c.chunk_index, c.content, c.kb_name, c.document_name, p.k1, p.b, co.avgdl
ORDER BY score DESC
LIMIT $3
`;

export class LexicalIndexService {
  private pool: PgPoolLike | null = null;
  private ready: Promise<void> | null = null;

  /** 绑定 pg 连接池（来自 PGVectorStore 内部 pool），首次使用时建表 + 回填 */
  attach(pool: PgPoolLike): void {
    if (this.pool) return;
    this.pool = pool;
    this.ready = this.init();
  }

  private async init(): Promise<void> {
    const pool = this.pool!;
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${LEXICAL_TABLE_NAME} (
        id            serial PRIMARY KEY,
        document_id   int  NOT NULL,
        kb_id         int  NOT NULL,
        chunk_index   int  NOT NULL,
        content       text NOT NULL,
        kb_name       text,
        document_name text,
        tokens        text[] NOT NULL,
        token_count   int  NOT NULL
      )
    `);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS lexical_tokens_idx ON ${LEXICAL_TABLE_NAME} USING GIN (tokens)`,
    );
    await pool.query(`CREATE INDEX IF NOT EXISTS lexical_doc_idx ON ${LEXICAL_TABLE_NAME} (document_id)`);

    await this.backfillFromVectorStore();
  }

  /**
   * 一次性回填：BM25 表是空的、但向量表里已有历史切片时，
   * 从向量表把 content+metadata 搬过来补建词法索引（否则老文档永远搜不到关键词）。
   */
  private async backfillFromVectorStore(): Promise<void> {
    const pool = this.pool!;
    const lex = await pool.query(`SELECT count(*)::int AS n FROM ${LEXICAL_TABLE_NAME}`);
    if ((lex.rows[0] as { n: number }).n > 0) return;

    const res = await pool.query(
      `SELECT content, metadata FROM ${RAG_TABLE_NAME} WHERE (metadata->>'documentId') IS NOT NULL`,
    );
    const chunks: LexicalChunk[] = [];
    for (const row of res.rows as { content: string; metadata: Record<string, unknown> }[]) {
      const m = row.metadata;
      if (m.documentId == null || m.kbId == null || m.chunkIndex == null || !row.content) continue;
      chunks.push({
        index: Number(m.chunkIndex),
        content: row.content,
        kbId: Number(m.kbId),
        documentId: Number(m.documentId),
        kbName: m.kbName as string | undefined,
        documentName: m.documentName as string | undefined,
      });
    }
    // 分批插入，避免一条 SQL 参数过多
    const BATCH = 500;
    for (let i = 0; i < chunks.length; i += BATCH) {
      await this.insertChunks(chunks.slice(i, i + BATCH));
    }
  }

  private async waitReady(): Promise<void> {
    if (this.ready) await this.ready;
  }

  /** 写入一批切片的词法索引 */
  async addChunks(
    kbId: number,
    documentId: number,
    names: { kbName?: string; documentName?: string },
    chunks: Array<Pick<ChunkData, "index" | "content">>,
  ): Promise<void> {
    await this.waitReady();
    if (chunks.length === 0) return;
    await this.insertChunks(
      chunks.map((c) => ({
        index: c.index,
        content: c.content,
        kbId,
        documentId,
        kbName: names.kbName,
        documentName: names.documentName,
      })),
    );
  }

  private async insertChunks(chunks: LexicalChunk[]): Promise<void> {
    const pool = this.pool!;
    const values: unknown[] = [];
    const tuples = chunks.map((c, i) => {
      const base = i * 8;
      const tokens = tokenizeForIndex(c.content);
      values.push(
        c.documentId,
        c.kbId,
        c.index,
        c.content,
        c.kbName ?? null,
        c.documentName ?? null,
        tokens,
        tokens.length,
      );
      // 数组参数必须显式 ::text[]，否则 node-pg 以 unknown 类型发送会报
      // "could not determine polymorphic type"
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}::text[], $${base + 8})`;
    });
    await pool.query(
      `INSERT INTO ${LEXICAL_TABLE_NAME}
         (document_id, kb_id, chunk_index, content, kb_name, document_name, tokens, token_count)
       VALUES ${tuples.join(", ")}`,
      values,
    );
  }

  /** 删除某文档的全部词法索引 */
  async deleteByDocumentId(documentId: number): Promise<void> {
    await this.waitReady();
    await this.pool!.query(`DELETE FROM ${LEXICAL_TABLE_NAME} WHERE document_id = $1`, [documentId]);
  }

  /** BM25 关键词检索 */
  async search(query: string, options: { kbIds?: number[]; k?: number } = {}): Promise<RagSearchResult[]> {
    await this.waitReady();
    const { kbIds, k = 5 } = options;
    const tokens = tokenizeQuery(query);
    if (tokens.length === 0) return [];

    const res = await this.pool!.query(BM25_SQL, [
      kbIds && kbIds.length > 0 ? kbIds : null,
      tokens,
      k,
      BM25_PARAMS.k1,
      BM25_PARAMS.b,
    ]);

    return (res.rows as Record<string, unknown>[]).map((r) => ({
      content: r.content as string,
      documentId: Number(r.document_id),
      kbId: Number(r.kb_id),
      kbName: (r.kb_name as string | null) ?? undefined,
      documentName: (r.document_name as string | null) ?? undefined,
      chunkIndex: Number(r.chunk_index),
      score: Number(r.score),
      matchType: "keyword" as const,
    }));
  }
}

/** 默认词法索引单例（与 ragService 共用） */
export const lexicalIndex = new LexicalIndexService();
