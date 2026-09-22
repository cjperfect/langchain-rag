"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  AiEngine: () => AiEngine,
  BM25_PARAMS: () => BM25_PARAMS,
  LexicalIndexService: () => LexicalIndexService,
  RagService: () => RagService,
  createEmbeddings: () => createEmbeddings,
  defaultEmbeddings: () => defaultEmbeddings,
  lexicalIndex: () => lexicalIndex,
  loadCsv: () => loadCsv,
  loadMarkdown: () => loadMarkdown,
  loadPdf: () => loadPdf,
  loadText: () => loadText,
  ragService: () => ragService,
  splitTextToChunks: () => splitTextToChunks,
  tokenizeForIndex: () => tokenizeForIndex,
  tokenizeQuery: () => tokenizeQuery
});
module.exports = __toCommonJS(index_exports);
var import_config = require("dotenv/config");

// src/agent/index.ts
var import_messages2 = require("@langchain/core/messages");
var import_langchain2 = require("langchain");

// src/agent/model.ts
var import_constants = require("@langchain-rag/shared/constants");
var import_openai = require("@langchain/openai");
var baseConfig = {
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0.7,
  maxTokens: 1024,
  timeout: 6e4,
  configuration: { baseURL: process.env.LLM_BASE_URL }
};
function createModel(modelName) {
  return new import_openai.ChatOpenAI({
    ...baseConfig,
    model: modelName || import_constants.DEFAULT_MODEL
  });
}
var defaultModel = createModel();

// src/prompts/system.ts
var systemPrompt = `\u4F60\u662F\u667A\u80FD\u786C\u4EF6\u4EA7\u54C1\u7684\u552E\u540E\u670D\u52A1\u52A9\u624B\uFF0C\u8D1F\u8D23\u57FA\u4E8E\u4EA7\u54C1\u77E5\u8BC6\u5E93\u56DE\u7B54\u7528\u6237\u5173\u4E8E\u8BBE\u5907\u4F7F\u7528\u8BF4\u660E\u3001\u6280\u672F\u53C2\u6570\u548C\u5E38\u89C1\u95EE\u9898\uFF08FAQ\uFF09\u7684\u54A8\u8BE2\u3002\u56DE\u7B54\u7EDF\u4E00\u4F7F\u7528\u7B80\u4F53\u4E2D\u6587\uFF0C\u9762\u5411\u666E\u901A\u6D88\u8D39\u8005\uFF0C\u907F\u514D\u5DE5\u7A0B\u5E08\u672F\u8BED\u3002

## \u77E5\u8BC6\u6765\u6E90\uFF08\u552F\u4E00\u6765\u6E90\u662F\u68C0\u7D22\u5DE5\u5177\uFF0C\u5FC5\u987B\u4E3B\u52A8\u8C03\u7528\uFF09
1. search_knowledge_base \u5DE5\u5177\u2014\u2014\u7CFB\u7EDF**\u4E0D\u518D**\u9884\u5148\u6CE8\u5165\u6587\u6863\u7247\u6BB5\u3002\u51E1\u6D89\u53CA\u8BBE\u5907\u4F7F\u7528\u8BF4\u660E\u3001\u6280\u672F\u53C2\u6570\u3001\u6545\u969C\u7801\u3001\u6E05\u6D01\u4FDD\u517B\u3001\u5B89\u5168\u7981\u5FCC\u3001\u4FDD\u4FEE\u653F\u7B56\u7684\u95EE\u9898\uFF0C\u90FD\u5FC5\u987B**\u5148\u8C03\u7528\u8BE5\u5DE5\u5177\u68C0\u7D22**\u518D\u4F5C\u7B54\uFF0C\u4E0D\u5F97\u76F4\u63A5\u51ED\u8BB0\u5FC6\u56DE\u7B54\u3002
2. \u4E00\u6B21\u4E0D\u7406\u60F3\u65F6\uFF0C\u6539\u5199\u67E5\u8BE2\u8BCD\uFF08\u8BBE\u5907\u578B\u53F7\u3001\u6545\u969C\u7801\u3001"\u7981\u5FCC""\u6E05\u6D01"\u7B49\u529F\u80FD\u5173\u952E\u8BCD\uFF09\u518D\u8BD5\uFF0C\u6700\u591A\u91CD\u8BD5\u4E24\u6B21\u3002
3. \u68C0\u7D22\u4ECD\u65E0\u76F8\u5173\u5185\u5BB9\u65F6\uFF0C\u5982\u5B9E\u8BF4\u660E\u77E5\u8BC6\u5E93\u4E2D\u6CA1\u6709\u8BE5\u4FE1\u606F\uFF0C\u5EFA\u8BAE\u7528\u6237\u63D0\u4F9B\u578B\u53F7\u6216\u66F4\u5177\u4F53\u7684\u63CF\u8FF0\uFF0C\u6216\u8054\u7CFB\u552E\u540E\u3002**\u4E25\u7981\u51ED\u8BB0\u5FC6\u7F16\u9020\u4EA7\u54C1\u53C2\u6570\u3001\u7EED\u822A\u3001\u6E29\u5EA6\u3001\u6545\u969C\u7801\u542B\u4E49\u6216\u4FDD\u4FEE\u653F\u7B56\u3002**

## \u786C\u4EF6\u54A8\u8BE2\u4E13\u9879\u89C4\u5219
- **\u5148\u5B9A\u578B\u53F7\u518D\u56DE\u7B54**\uFF1A\u4E0D\u540C\u578B\u53F7\u7684\u7ED3\u8BBA\u53EF\u80FD\u76F8\u53CD\uFF08\u540C\u4E00\u6545\u969C\u7801\u5728\u4E0D\u540C\u8BBE\u5907\u4E0A\u542B\u4E49\u5B8C\u5168\u4E0D\u540C\uFF09\u3002\u7528\u6237\u672A\u8BF4\u660E\u578B\u53F7\u4E14\u68C0\u7D22\u7ED3\u679C\u8DE8\u591A\u4E2A\u578B\u53F7\u65F6\uFF0C\u6309\u578B\u53F7\u5206\u5217\u4F5C\u7B54\u6216\u53CD\u95EE\u786E\u8BA4\uFF0C\u4E0D\u5F97\u628A A \u578B\u53F7\u7684\u53C2\u6570\u5B89\u5230 B \u578B\u53F7\u5934\u4E0A\u3002
- **\u6545\u969C\u7801\u95EE\u9898**\uFF1A\u6309"\u542B\u4E49 \u2192 \u53EF\u81EA\u884C\u5904\u7406\u7684\u6392\u67E5\u6B65\u9AA4 \u2192 \u4F55\u65F6\u505C\u6B62\u4F7F\u7528\u5E76\u8054\u7CFB\u552E\u540E"\u4E09\u5C42\u56DE\u7B54\uFF1B\u8BF4\u660E\u4E66\u6807\u6CE8"\u8054\u7CFB\u552E\u540E"\u7684\u60C5\u5F62\u4E0D\u8981\u5F15\u5BFC\u7528\u6237\u81EA\u884C\u62C6\u4FEE\u3002
- **\u5B89\u5168\u7981\u5FCC\u96F6\u7701\u7565**\uFF1A\u6D89\u53CA\u7981\u5FCC\u4EBA\u7FA4\uFF08\u5B55\u5987\u3001\u513F\u7AE5\u3001\u6162\u6027\u75C5\u60A3\u8005\u3001\u4F53\u5185\u690D\u5165\u533B\u7597\u5668\u68B0\u8005\uFF09\u548C\u7981\u7528\u573A\u666F\u65F6\uFF0C\u5FC5\u987B\u5B8C\u6574\u8F6C\u8FF0\u539F\u6587\u8B66\u544A\uFF1B\u7528\u6237\u63CF\u8FF0\u7684\u75C7\u72B6\u7591\u4F3C\u7981\u5FCC\u60C5\u5F62\u65F6\uFF0C\u660E\u786E\u5EFA\u8BAE\u5148\u54A8\u8BE2\u533B\u751F\uFF0C\u4E0D\u4EE3\u66FF\u533B\u751F\u7ED9\u5EFA\u8BAE\u3002
- **\u53C2\u6570\u7CBE\u786E**\uFF1A\u6E29\u5EA6\u3001\u65F6\u957F\u3001\u6863\u4F4D\u3001\u5BB9\u91CF\u7B49\u6570\u503C\u53EA\u5F15\u7528\u8BF4\u660E\u4E66\u539F\u6587\uFF0C\u4E0D\u56DB\u820D\u4E94\u5165\u3001\u4E0D\u63A8\u6D4B"\u5927\u6982"\u3002
- **\u6E05\u6D01\u4FDD\u517B**\uFF1A\u533A\u5206\u53EF\u6C34\u6D17\u90E8\u4EF6\u4E0E\u4E25\u7981\u8FDB\u6C34\u7684\u4E3B\u673A\u90E8\u5206\uFF0C\u6309\u539F\u6587\u8868\u8FF0\u3002

## \u56DE\u7B54\u8981\u6C42
- **\u7ED3\u8BBA\u5148\u884C**\uFF1A\u7B2C\u4E00\u53E5\u7ED9\u76F4\u63A5\u7B54\u6848\u6216\u5224\u65AD\uFF0C\u518D\u5206\u70B9\u5C55\u5F00\uFF1B\u64CD\u4F5C\u6B65\u9AA4\u7528\u6709\u5E8F\u5217\u8868\uFF0C\u6BCF\u6B65\u4E0D\u8D85\u8FC7\u4E24\u884C\u3002
- **\u5FE0\u4E8E\u7247\u6BB5**\uFF1A\u7247\u6BB5\u4E4B\u95F4\u51B2\u7A81\u65F6\u6307\u51FA\u5DEE\u5F02\u5E76\u5217\u51FA\u5404\u81EA\u6765\u6E90\uFF1B\u6587\u6863\u6CA1\u5199\u5230\u7684\u90E8\u5206\u660E\u786E\u8BF4"\u8BF4\u660E\u4E66\u4E2D\u672A\u63D0\u53CA"\uFF0C\u4E0D\u8981\u8111\u8865\u8865\u5168\u3002
- **\u5F15\u7528\u6765\u6E90**\uFF1A\u6D89\u53CA\u77E5\u8BC6\u5E93\u5185\u5BB9\u5904\u6807\u6CE8\u6587\u6863\u540D\uFF0C\u5982"\u6839\u636E\u300ANeckFit N1 \u4F7F\u7528\u8BF4\u660E\u4E66\u300B\u2026"\uFF0C\u53EA\u80FD\u5F15\u7528\u68C0\u7D22\u7ED3\u679C\u4E2D\u771F\u5B9E\u51FA\u73B0\u7684\u6765\u6E90\uFF0C\u4E0D\u8981\u865A\u6784\u6587\u4EF6\u540D\u6216\u7AE0\u8282\u53F7\u3002

## \u8FB9\u754C
- \u6253\u62DB\u547C\u3001\u95F2\u804A\u3001\u901A\u7528\u5E38\u8BC6\u95EE\u9898\u53EF\u4EE5\u6B63\u5E38\u56DE\u5E94\uFF0C\u4E0D\u53D7\u77E5\u8BC6\u5E93\u9650\u5236\u3002
- \u7EF4\u4FEE\u62C6\u673A\u3001\u9000\u6362\u8D27\u653F\u7B56\u82E5\u77E5\u8BC6\u5E93\u65E0\u5BF9\u5E94\u6587\u6863\uFF0C\u5F15\u5BFC\u7528\u6237\u8054\u7CFB\u552E\u540E\u6E20\u9053\uFF0C\u4E0D\u8981\u81EA\u884C\u7ED9\u51FA\u6D41\u7A0B\u3002`;

// src/tools/knowledge-search.ts
var import_langchain = require("langchain");
var import_zod = require("zod");

// src/rag/rag.service.ts
var import_pgvector = require("@langchain/community/vectorstores/pgvector");
var import_documents = require("@langchain/core/documents");
var import_textsplitters = require("@langchain/textsplitters");

// src/embeddings/embedding.service.ts
var import_ollama = require("@langchain/ollama");
var EMBEDDING_BASE_URL = process.env.EMBEDDING_BASE_URL ?? "http://localhost:11434";
var EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "qwen3-embedding:0.6b";
var baseEmbeddingConfig = {
  model: EMBEDDING_MODEL,
  baseUrl: EMBEDDING_BASE_URL,
  batchSize: 32,
  stripNewLines: false
};
function createEmbeddings(modelName) {
  return new import_ollama.OllamaEmbeddings({
    ...baseEmbeddingConfig,
    model: modelName ?? EMBEDDING_MODEL
  });
}
var defaultEmbeddings = createEmbeddings();

// src/constants/rag.ts
var RAG_TABLE_NAME = "langchain_pg_embedding";
var LEXICAL_TABLE_NAME = "rag_bm25_index";
var RAG_EMBEDDING_DIMENSIONS = Number(process.env.EMBEDDING_DIMENSIONS ?? "1024");

// src/rag/tokenizer.ts
var CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
var WORD_RE = /[a-z0-9_]/;
function scanRuns(text) {
  const s = text.toLowerCase();
  const runs = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (CJK_RE.test(ch)) {
      let j = i;
      while (j < s.length && CJK_RE.test(s[j])) j++;
      runs.push({ type: "cjk", run: s.slice(i, j) });
      i = j;
    } else if (WORD_RE.test(ch)) {
      let j = i;
      while (j < s.length && WORD_RE.test(s[j])) j++;
      runs.push({ type: "word", run: s.slice(i, j) });
      i = j;
    } else {
      i++;
    }
  }
  return runs;
}
function bigrams(run) {
  const out = [];
  for (let x = 0; x + 1 < run.length; x++) out.push(run.slice(x, x + 2));
  return out;
}
function tokenizeForIndex(text) {
  const tokens = [];
  for (const { type, run } of scanRuns(text)) {
    if (type === "word") {
      tokens.push(run);
    } else if (run.length === 1) {
      tokens.push(run);
    } else {
      tokens.push(...run.split(""), ...bigrams(run));
    }
  }
  return tokens;
}
function tokenizeQuery(text) {
  const set = /* @__PURE__ */ new Set();
  for (const { type, run } of scanRuns(text)) {
    if (type === "word") {
      set.add(run);
    } else if (run.length === 1) {
      set.add(run);
    } else {
      for (const bg of bigrams(run)) set.add(bg);
    }
  }
  return [...set];
}

// src/rag/bm25.ts
var BM25_PARAMS = { k1: 1.2, b: 0.75 };
var BM25_SQL = `
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
var LexicalIndexService = class {
  pool = null;
  ready = null;
  /** 绑定 pg 连接池（来自 PGVectorStore 内部 pool），首次使用时建表 + 回填 */
  attach(pool) {
    if (this.pool) return;
    this.pool = pool;
    this.ready = this.init();
  }
  async init() {
    const pool = this.pool;
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
      `CREATE INDEX IF NOT EXISTS lexical_tokens_idx ON ${LEXICAL_TABLE_NAME} USING GIN (tokens)`
    );
    await pool.query(`CREATE INDEX IF NOT EXISTS lexical_doc_idx ON ${LEXICAL_TABLE_NAME} (document_id)`);
    await this.backfillFromVectorStore();
  }
  /**
   * 一次性回填：BM25 表是空的、但向量表里已有历史切片时，
   * 从向量表把 content+metadata 搬过来补建词法索引（否则老文档永远搜不到关键词）。
   */
  async backfillFromVectorStore() {
    const pool = this.pool;
    const lex = await pool.query(`SELECT count(*)::int AS n FROM ${LEXICAL_TABLE_NAME}`);
    if (lex.rows[0].n > 0) return;
    const res = await pool.query(
      `SELECT content, metadata FROM ${RAG_TABLE_NAME} WHERE (metadata->>'documentId') IS NOT NULL`
    );
    const chunks = [];
    for (const row of res.rows) {
      const m = row.metadata;
      if (m.documentId == null || m.kbId == null || m.chunkIndex == null || !row.content) continue;
      chunks.push({
        index: Number(m.chunkIndex),
        content: row.content,
        kbId: Number(m.kbId),
        documentId: Number(m.documentId),
        kbName: m.kbName,
        documentName: m.documentName
      });
    }
    const BATCH = 500;
    for (let i = 0; i < chunks.length; i += BATCH) {
      await this.insertChunks(chunks.slice(i, i + BATCH));
    }
  }
  async waitReady() {
    if (this.ready) await this.ready;
  }
  /** 写入一批切片的词法索引 */
  async addChunks(kbId, documentId, names, chunks) {
    await this.waitReady();
    if (chunks.length === 0) return;
    await this.insertChunks(
      chunks.map((c) => ({
        index: c.index,
        content: c.content,
        kbId,
        documentId,
        kbName: names.kbName,
        documentName: names.documentName
      }))
    );
  }
  async insertChunks(chunks) {
    const pool = this.pool;
    const values = [];
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
        tokens.length
      );
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}::text[], $${base + 8})`;
    });
    await pool.query(
      `INSERT INTO ${LEXICAL_TABLE_NAME}
         (document_id, kb_id, chunk_index, content, kb_name, document_name, tokens, token_count)
       VALUES ${tuples.join(", ")}`,
      values
    );
  }
  /** 删除某文档的全部词法索引 */
  async deleteByDocumentId(documentId) {
    await this.waitReady();
    await this.pool.query(`DELETE FROM ${LEXICAL_TABLE_NAME} WHERE document_id = $1`, [documentId]);
  }
  /** BM25 关键词检索 */
  async search(query, options = {}) {
    await this.waitReady();
    const { kbIds, k = 5 } = options;
    const tokens = tokenizeQuery(query);
    if (tokens.length === 0) return [];
    const res = await this.pool.query(BM25_SQL, [
      kbIds && kbIds.length > 0 ? kbIds : null,
      tokens,
      k,
      BM25_PARAMS.k1,
      BM25_PARAMS.b
    ]);
    return res.rows.map((r) => ({
      content: r.content,
      documentId: Number(r.document_id),
      kbId: Number(r.kb_id),
      kbName: r.kb_name ?? void 0,
      documentName: r.document_name ?? void 0,
      chunkIndex: Number(r.chunk_index),
      score: Number(r.score),
      matchType: "keyword"
    }));
  }
};
var lexicalIndex = new LexicalIndexService();

// src/rag/rag.service.ts
var import_events = require("@langchain-rag/shared/events");
var RRF_K = 60;
var RagService = class {
  vectorStore = null;
  embeddings;
  constructor(embeddings) {
    this.embeddings = embeddings ?? defaultEmbeddings;
  }
  /** 初始化 PGVectorStore（延迟初始化，避免模块加载时立即连接 DB） */
  async getStore() {
    if (this.vectorStore) return this.vectorStore;
    const config = {
      postgresConnectionOptions: {
        connectionString: process.env.DATABASE_URL
      },
      tableName: RAG_TABLE_NAME,
      columns: {
        idColumnName: "id",
        contentColumnName: "content",
        metadataColumnName: "metadata",
        vectorColumnName: "embedding"
      },
      distanceStrategy: "cosine",
      scoreNormalization: "similarity"
    };
    this.vectorStore = await import_pgvector.PGVectorStore.initialize(this.embeddings, {
      ...config,
      dimensions: RAG_EMBEDDING_DIMENSIONS
    });
    lexicalIndex.attach(this.vectorStore.pool);
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
  async indexDocument(kbId, documentId, content, names) {
    return (0, import_events.withTaskEvents)(import_events.TaskType.DOCUMENT_INDEX, { kbId, documentId, message: `\u7D22\u5F15\u6587\u6863 #${documentId}` }, (taskId) => this.vectorize(kbId, documentId, content, names, taskId));
  }
  /**
   * 重建索引：删除旧向量 → 重新切片 → 重新向量化
   */
  async reindexDocument(documentId, kbId, content, names) {
    return (0, import_events.withTaskEvents)(import_events.TaskType.DOCUMENT_INDEX, { kbId, documentId, message: `\u91CD\u5EFA\u7D22\u5F15\u6587\u6863 #${documentId}` }, async (taskId) => {
      await this.deleteByDocumentId(documentId);
      (0, import_events.emit)(import_events.TaskEvent.PROGRESS, { taskId, taskType: import_events.TaskType.DOCUMENT_INDEX, step: 1, message: "\u5DF2\u5220\u9664\u65E7\u5411\u91CF" });
      return this.vectorize(kbId, documentId, content, names, taskId, 2);
    });
  }
  /**
   * 切片 + 向量化核心逻辑（不发 started/completed，由 withTaskEvents 统一发）
   *
   * @param taskId 任务 ID（用于发进度事件）
   * @param stepOffset 步骤偏移（重建索引时前面多了"删旧向量"一步）
   */
  async vectorize(kbId, documentId, content, names, taskId, stepOffset = 1) {
    const texts = await splitTextToChunks(content);
    if (texts.length === 0) return [];
    (0, import_events.emit)(import_events.TaskEvent.PROGRESS, { taskId, taskType: import_events.TaskType.DOCUMENT_INDEX, step: stepOffset, message: `\u5207\u7247\u5B8C\u6210\uFF08${texts.length} \u7247\uFF09\uFF0C\u5F00\u59CB\u5411\u91CF\u5316` });
    const store = await this.getStore();
    const docs = texts.map(
      (text, i) => new import_documents.Document({
        pageContent: text,
        metadata: {
          documentId,
          kbId,
          chunkIndex: i + 1,
          kbName: names?.kbName,
          documentName: names?.documentName
        }
      })
    );
    await store.addDocuments(docs);
    await lexicalIndex.addChunks(
      kbId,
      documentId,
      { kbName: names?.kbName, documentName: names?.documentName },
      texts.map((text, i) => ({ content: text, index: i + 1 }))
    );
    (0, import_events.emit)(import_events.TaskEvent.PROGRESS, { taskId, taskType: import_events.TaskType.DOCUMENT_INDEX, step: stepOffset + 1, message: "\u5411\u91CF\u5316\u5B8C\u6210" });
    return texts.map((text, i) => ({
      content: text,
      index: i + 1,
      tokenCount: Math.ceil(text.length / 2)
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
  async search(query, options = {}) {
    const { kbIds, k = 5, mode = "hybrid" } = options;
    const fetchK = Math.max(k * 2, 10);
    return (0, import_events.withTaskEvents)(import_events.TaskType.RAG_SEARCH, { kbIds, message: `\u68C0\u7D22\uFF1A${query.slice(0, 50)}` }, async () => {
      await this.getStore();
      const lists = [];
      if (mode !== "keyword") lists.push(await this.semanticSearch(query, kbIds, fetchK));
      if (mode !== "semantic") lists.push(await lexicalIndex.search(query, { kbIds, k: fetchK }));
      if (mode !== "hybrid") return lists[0].slice(0, k);
      return fuseRrf(lists, k);
    });
  }
  /** 向量相似度检索 */
  async semanticSearch(query, kbIds, k) {
    const store = await this.getStore();
    const filter = kbIds && kbIds.length > 0 ? { kbId: { in: kbIds } } : void 0;
    const results = await store.similaritySearchWithScore(query, k, filter);
    return results.map(([doc, score]) => {
      const metadata = doc.metadata;
      return {
        content: doc.pageContent,
        documentId: metadata.documentId,
        kbId: metadata.kbId,
        kbName: metadata.kbName,
        documentName: metadata.documentName,
        chunkIndex: metadata.chunkIndex,
        score,
        matchType: "semantic"
      };
    });
  }
  /**
   * 删除某个文档的所有索引（向量 + BM25 词法）
   *
   * PGVectorStore 通过 metadata 过滤删除
   */
  async deleteByDocumentId(documentId) {
    const store = await this.getStore();
    await store.delete({ filter: { documentId } });
    await lexicalIndex.deleteByDocumentId(documentId);
  }
};
function fuseRrf(lists, k) {
  const fused = /* @__PURE__ */ new Map();
  for (const list of lists) {
    list.forEach((result, rank) => {
      const key = `${result.documentId}#${result.chunkIndex ?? -1}`;
      const entry = fused.get(key) ?? { result, rrf: 0, matched: /* @__PURE__ */ new Set() };
      entry.rrf += 1 / (RRF_K + rank + 1);
      entry.matched.add(result.matchType);
      fused.set(key, entry);
    });
  }
  const maxRrf = lists.length / (RRF_K + 1);
  return [...fused.values()].sort((a, b) => b.rrf - a.rrf).slice(0, k).map(({ result, rrf, matched }) => ({
    ...result,
    score: rrf / maxRrf,
    matchType: matched.size > 1 ? "both" : [...matched][0]
  }));
}
async function splitTextToChunks(text) {
  const splitter = new import_textsplitters.RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50,
    separators: ["\n\n", "\n", "\u3002", "\uFF01", "\uFF1F", "\uFF1B", "\uFF0C", " ", ""]
  });
  const docs = await splitter.createDocuments([text]);
  return docs.map((d) => d.pageContent).filter(Boolean);
}
var ragService = new RagService();

// src/tools/knowledge-search.ts
function chunkKey(r) {
  return `${r.kbId}:${r.documentId}:${r.chunkIndex ?? ""}:${r.content}`;
}
function appendScopedResults(scope, results) {
  if (!scope) return;
  const seen = new Set(scope.results.map(chunkKey));
  for (const r of results) {
    const key = chunkKey(r);
    if (seen.has(key)) continue;
    seen.add(key);
    scope.results.push(r);
  }
}
function isRetrievalScope(value) {
  return typeof value === "object" && value !== null && "results" in value && Array.isArray(value.results);
}
function readRetrievalScope(config) {
  const raw = config?.configurable?.retrieval;
  return isRetrievalScope(raw) ? raw : void 0;
}
function readScopedKbIds(config) {
  const raw = config?.configurable?.kbIds;
  if (!Array.isArray(raw)) return [];
  return raw.filter((value) => typeof value === "number");
}
var MATCH_LABELS = {
  both: "\u8BED\u4E49+\u5173\u952E\u8BCD",
  semantic: "\u8BED\u4E49",
  keyword: "\u5173\u952E\u8BCD"
};
var knowledgeSearchTool = (0, import_langchain.tool)(
  async ({ query }, config) => {
    const kbIds = readScopedKbIds(config);
    if (kbIds.length === 0) {
      return "\u5F53\u524D\u4F1A\u8BDD\u672A\u6307\u5B9A\u77E5\u8BC6\u5E93\uFF0C\u65E0\u6CD5\u68C0\u7D22\u3002\u8BF7\u63D0\u793A\u7528\u6237\u5148\u9009\u62E9\u8981\u67E5\u8BE2\u7684\u77E5\u8BC6\u5E93\u3002";
    }
    const results = await ragService.search(query, { kbIds, k: 5 });
    appendScopedResults(readRetrievalScope(config), results);
    if (results.length === 0) {
      return "\u672A\u627E\u5230\u76F8\u5173\u6587\u6863\u3002\u8BF7\u544A\u77E5\u7528\u6237\u5F53\u524D\u77E5\u8BC6\u5E93\u4E2D\u6CA1\u6709\u5339\u914D\u7684\u4FE1\u606F\u3002";
    }
    return results.map(
      (r, i) => `[\u6587\u6863\u7247\u6BB5 ${i + 1}] \u6765\u6E90: ${r.kbName ?? `\u77E5\u8BC6\u5E93#${r.kbId}`}${r.documentName ? `/${r.documentName}` : ""} (\u5339\u914D: ${MATCH_LABELS[r.matchType] ?? r.matchType}, \u5F97\u5206: ${(r.score * 100).toFixed(1)}%)
${r.content}`
    ).join("\n\n");
  },
  {
    name: "search_knowledge_base",
    description: `\u5728\u672C\u6B21\u4F1A\u8BDD\u6307\u5B9A\u7684\u77E5\u8BC6\u5E93\u4E2D\u68C0\u7D22\u76F8\u5173\u6587\u6863\u5185\u5BB9\uFF08\u5411\u91CF\u8BED\u4E49 + BM25 \u5173\u952E\u8BCD\u6DF7\u5408\u68C0\u7D22\uFF09\u3002
\u9002\u7528\u573A\u666F\uFF1A
- \u7528\u6237\u8BE2\u95EE\u516C\u53F8\u653F\u7B56\u3001\u6D41\u7A0B\u3001\u89C4\u8303\u3001\u4EA7\u54C1\u6587\u6863\u7B49\u5185\u90E8\u8D44\u6599
- \u9700\u8981\u67E5\u627E\u7279\u5B9A\u4E1A\u52A1\u77E5\u8BC6\u6216\u64CD\u4F5C\u6307\u5357
- \u7528\u6237\u7684\u95EE\u9898\u9700\u8981\u57FA\u4E8E\u516C\u53F8\u6587\u6863\u6216\u4EA7\u54C1\u8BF4\u660E\u4E66\u6765\u56DE\u7B54

\u6CE8\u610F\uFF1A
- \u68C0\u7D22\u8303\u56F4\u7531\u4F1A\u8BDD\u8BBE\u5B9A\uFF1A\u4F60\u53EA\u80FD\u51B3\u5B9A\u300C\u67E5\u4EC0\u4E48\u300D\uFF0C\u65E0\u6CD5\u6539\u53D8\u300C\u80FD\u67E5\u54EA\u4E9B\u5E93\u300D\u3002\u672A\u6307\u5B9A\u77E5\u8BC6\u5E93\u65F6\u5DE5\u5177\u4F1A\u76F4\u63A5\u8FD4\u56DE\u63D0\u793A\u3002
- \u68C0\u7D22\u7ED3\u679C\u6309\u6DF7\u5408\u76F8\u5173\u6027\u6392\u5E8F\uFF0C\u53EF\u80FD\u4E0D\u5B8C\u5168\u7CBE\u786E\u3002
- \u4E00\u6B21\u4E0D\u7406\u60F3\u65F6\u6539\u5199\u67E5\u8BE2\u8BCD\uFF08\u8BBE\u5907\u578B\u53F7\u3001\u6545\u969C\u7801\u3001\u529F\u80FD\u5173\u952E\u8BCD\uFF09\u518D\u8BD5\uFF0C\u6700\u591A\u91CD\u8BD5\u4E24\u6B21\u3002
- \u68C0\u7D22\u65E0\u7ED3\u679C\u65F6\u8BF7\u660E\u786E\u544A\u77E5\u7528\u6237\u77E5\u8BC6\u5E93\u4E2D\u6CA1\u6709\u76F8\u5173\u4FE1\u606F\uFF0C\u4E0D\u8981\u51ED\u8BB0\u5FC6\u8865\u5168\u3002`,
    schema: import_zod.z.object({
      query: import_zod.z.string().describe("\u68C0\u7D22\u67E5\u8BE2\u8BED\u53E5\uFF1B\u5EFA\u8BAE\u4F7F\u7528\u95EE\u9898\u4E2D\u7684\u5173\u952E\u8BCD\uFF0C\u9996\u6B21\u4E0D\u7406\u60F3\u65F6\u53EF\u6362\u7528\u578B\u53F7\u3001\u6545\u969C\u7801\u7B49\u529F\u80FD\u5173\u952E\u8BCD")
    })
  }
);

// src/agent/index.ts
var import_events2 = require("@langchain-rag/shared/events");

// src/libs/messages.ts
var import_messages = require("@langchain/core/messages");
function toLangChainMessages(messages) {
  return messages.map((m) => {
    switch (m.role) {
      case "user":
        return new import_messages.HumanMessage(m.content);
      case "assistant":
        return new import_messages.AIMessage(m.content);
      case "system":
        return new import_messages.SystemMessage(m.content);
    }
  });
}

// src/agent/index.ts
function readQuery(data) {
  if (typeof data !== "object" || data === null || !("input" in data)) return "";
  const wrapper = data.input;
  if (typeof wrapper !== "object" || wrapper === null || !("input" in wrapper)) return "";
  const serialized = wrapper.input;
  if (typeof serialized !== "string") return "";
  try {
    const parsed = JSON.parse(serialized);
    if (typeof parsed === "object" && parsed !== null && "query" in parsed && typeof parsed.query === "string") {
      return parsed.query;
    }
  } catch {
  }
  return "";
}
function readToolOutput(output) {
  if (typeof output === "string") return output;
  if (typeof output === "object" && output !== null && "content" in output && typeof output.content === "string") {
    return output.content;
  }
  return void 0;
}
var AiEngine = class _AiEngine {
  /**
   * Agent 全局单例
   */
  static agent = (0, import_langchain2.createAgent)({
    model: defaultModel,
    tools: [knowledgeSearchTool],
    systemPrompt
  });
  /** 获取 agent（需要切换模型时创建新实例） */
  getAgent(modelName) {
    if (!modelName || modelName === defaultModel.model) return _AiEngine.agent;
    return (0, import_langchain2.createAgent)({
      model: createModel(modelName),
      tools: [knowledgeSearchTool],
      systemPrompt
    });
  }
  /**
   * 普通对话
   */
  async chat(input, options = {}) {
    const messages = [...toLangChainMessages(options.history ?? []), new import_messages2.HumanMessage(input)];
    const res = await this.getAgent(options.model).invoke(
      { messages },
      { configurable: { kbIds: options.kbIds } }
    );
    const last = res.messages.at(-1);
    return typeof last?.content === "string" ? last.content : JSON.stringify(last?.content);
  }
  /**
   * 流式对话
   */
  async *stream(input, options = {}) {
    const messages = [...toLangChainMessages(options.history ?? []), new import_messages2.HumanMessage(input)];
    const stream = await this.getAgent(options.model).stream(
      { messages },
      { streamMode: "messages", configurable: { kbIds: options.kbIds } }
    );
    for await (const [chunk] of stream) {
      if (typeof chunk.content === "string") {
        yield chunk.content;
      }
    }
  }
  /**
   * 流式对话 + 观察整个执行过程（token + tool + chain）
   *
   * 流式是 AsyncGenerator，包不进 withTaskEvents，手动发三段生命周期事件：
   * started → （逐 token 流式）→ completed / failed。
   * 工具调用的明细不再单独 emit——前端经 SSE 的 tool_start/tool_end 已能看到。
   *
   * 检索完全交给 agent：这里不做预检索，由模型自行决定是否调用检索工具。
   * 检索作用域（kbIds）与结果归属都经 `configurable` 下传给工具，
   * 结果写在每次调用新建的 `retrieval` 对象上——不用模块级变量，并发会话不会互相污染。
   */
  async *streamEvents(input, options = {}) {
    const taskId = (0, import_events2.newTaskId)(import_events2.TaskType.CHAT);
    const startedAt = Date.now();
    (0, import_events2.emit)(import_events2.TaskEvent.STARTED, { taskId, taskType: import_events2.TaskType.CHAT, message: `\u5BF9\u8BDD\uFF1A${input.slice(0, 50)}` });
    const retrieval = { results: [] };
    try {
      const messages = [...toLangChainMessages(options.history ?? []), new import_messages2.HumanMessage(input)];
      const stream = await this.getAgent(options.model).streamEvents(
        { messages },
        { version: "v2", configurable: { kbIds: options.kbIds, retrieval } }
      );
      for await (const event of stream) {
        switch (event.event) {
          case "on_chat_model_stream": {
            const chunk = event.data.chunk;
            const reasoning = chunk.additional_kwargs?.reasoning || chunk.additional_kwargs?.reasoning_content;
            if (typeof reasoning === "string" && reasoning) {
              yield { type: "reasoning", content: reasoning };
            }
            if (typeof chunk.content === "string" && chunk.content) {
              yield { type: "token", content: chunk.content };
            }
            break;
          }
          // 知识库检索工具 → 专用事件，前端可展示检索状态 + 知识库名称
          case "on_tool_start":
            if (event.name === "search_knowledge_base") {
              yield { type: "knowledge_search", query: readQuery(event.data), kbIds: options.kbIds };
            } else {
              yield { type: "tool_start", name: event.name };
            }
            break;
          case "on_tool_end":
            if (event.name === "search_knowledge_base") {
              const docs = retrieval.results;
              const kbNames = [...new Set(docs.map((r) => r.kbName).filter((name) => typeof name === "string"))];
              yield {
                type: "knowledge_search",
                query: "",
                kbIds: options.kbIds,
                kbNames,
                results: readToolOutput(event.data.output),
                docs
              };
            } else {
              yield {
                type: "tool_end",
                name: event.name,
                result: readToolOutput(event.data.output)
              };
            }
            break;
        }
      }
      (0, import_events2.emit)(import_events2.TaskEvent.COMPLETED, { taskId, taskType: import_events2.TaskType.CHAT, durationMs: Date.now() - startedAt });
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      (0, import_events2.emit)(import_events2.TaskEvent.FAILED, { taskId, taskType: import_events2.TaskType.CHAT, durationMs: Date.now() - startedAt, error: e.message, stack: e.stack });
      throw err;
    }
  }
};

// src/loaders/csv.loader.ts
var import_csv = require("@langchain/community/document_loaders/fs/csv");
async function loadCsv(filePath, options) {
  const loader = new import_csv.CSVLoader(filePath, options);
  return loader.load();
}

// src/loaders/pdf.loader.ts
var import_pdf = require("@langchain/community/document_loaders/fs/pdf");
async function loadPdf(filePath, options) {
  const loader = new import_pdf.PDFLoader(filePath, {
    splitPages: options?.splitPages,
    parsedItemSeparator: options?.parsedItemSeparator
  });
  return loader.load();
}

// src/loaders/text.loader.ts
var import_fs = require("fs");
var import_documents2 = require("@langchain/core/documents");
async function loadText(filePath) {
  const content = (0, import_fs.readFileSync)(filePath, "utf-8");
  return [
    new import_documents2.Document({
      pageContent: content,
      metadata: { source: filePath }
    })
  ];
}
async function loadMarkdown(filePath) {
  return loadText(filePath);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AiEngine,
  BM25_PARAMS,
  LexicalIndexService,
  RagService,
  createEmbeddings,
  defaultEmbeddings,
  lexicalIndex,
  loadCsv,
  loadMarkdown,
  loadPdf,
  loadText,
  ragService,
  splitTextToChunks,
  tokenizeForIndex,
  tokenizeQuery
});
