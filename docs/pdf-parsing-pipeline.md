# PDF / Markdown 解析管线说明

本文档描述 `langchain-rag` 中「文档解析 → 清洗标准化 → 切片 → 嵌入 → 入库 → 检索」的完整链路，重点说明 PDF 的智能路由解析（Unstructured Transform v2 云版 + 百度 OCR）与 Markdown 解析。

---

## 1. 端到端总览

```mermaid
flowchart LR
    A[前端上传文档] --> B[后端 document.service<br/>uploadDocument]
    B --> C{文件类型路由}
    C -->|pdf| D[PDF 解析编排<br/>loadPdf]
    C -->|md| E[Markdown 解析<br/>loadMarkdown]
    D --> F[逐页路由判定<br/>needOcrPage]
    F -->|文本层页| G[Unstructured Transform v2<br/>版面分析 + 元素打标]
    F -->|空页/乱码/扫描页| H[百度 OCR<br/>doc_analysis_office]
    G --> I[标准化页文本<br/>标题 ## / [表格] 行列]
    H --> I
    E --> I
    I --> J[RecursiveCharacterTextSplitter<br/>chunk 500 / overlap 50]
    J --> K[向量化<br/>Ollama qwen3-embedding:0.6b]
    J --> L[BM25 词法索引<br/>rag_bm25_index 旁表]
    K --> M[(pgvector<br/>向量表)]
    L --> M
    M --> N[混合检索<br/>向量 + BM25, RRF 融合]
```

整体归属：后端 `DocumentService` 只做编排（进度事件、DB 记录、失败回滚），类型路由与解析全部收敛在 `@langchain-rag/ai-engine` 包 —— 后端只调统一入口 `parseDocument(filePath)`。

---

## 2. 文件类型路由

类型路由收敛在 ai-engine 统一入口 `parseDocument(filePath)`（`packages/ai-engine/src/loaders/extract.ts`），backend 无需感知 loader 选择：

| 扩展名 | 内部路由 | 说明 |
| --- | --- | --- |
| `.pdf` | `loadPdf` | 智能路由：文本层页 → Unstructured，扫描页 → 百度 OCR |
| `.md` | `loadMarkdown` | UTF-8 读取，返回单个 Document |
| 其他 | 抛错 | `暂不支持的文件类型：.{ext}（当前支持 pdf / md）` |

csv / txt loader 已删除，`shared` 无对应入口。

---

## 3. PDF 解析管线（核心）

### 3.1 为什么不用 LangChain PDFLoader

LangChain `PDFLoader` 的 `splitPages: true` 会**过滤掉无文本的图片页**，导致：
- 扫描页丢失；
- 剩余页的页号与真实页码错位，OCR 队列无法对齐。

因此改用 PDFLoader 的底层 `pdf-parse` 的 `getText()`：**按真实页码返回每一页**（空页保留空串），页号与 OCR 队列严格对齐。`pdf-parse` 仅用于「逐页文本提取 + 路由判定 + Unstructured 失败时的回退文本」，不做最终解析。

### 3.2 逐页路由判定（`routing.ts` `needOcrPage`，纯函数）

| 条件 | 判定 |
| --- | --- |
| `text.trim().length < 20` | → OCR（空页/纯扫描页） |
| 中文字符数 ≥ 5 | → 文本层页，本地提取 |
| `U+FFFD` 替换符占比 > 10% | → OCR（字体编码异常） |
| 可读字符（中日韩/全角标点/ASCII）占比 < 70% | → OCR（疑似乱码） |
| 无中文但可读字符占比高（如纯英文页） | → 文本层页，避免误 OCR |

### 3.3 文本层页 → Unstructured Transform v2（云版）

**部署形态**：官方托管云 API（`unstructured-transform-client` SDK），替代早期规划的本地 Docker 方案（`infra/unstructured/` 已删除）。

**接入要点**：
- 依赖：`unstructured-transform-client@0.18.19`（ESM-only，**要求 Node ≥ 22**；ai-engine 内用动态 `import()` 兼容 CJS 构建）。
- 环境变量：`UNSTRUCTURED_API_KEY`（transform.unstructured.io 控制台「API Keys」复制）；`UNSTRUCTURED_API_URL` 可选（默认 `https://transform.unstructured.io`）。
- 与旧版 Partition Endpoint（`api.unstructuredapp.io/general/v0/general`）**不兼容**，key 不通用。
- v2 是「一个文档进去，结构化输出回来」的异步任务式接口（创建 job → 轮询 → 下载元素），**无需手动指定 strategy/languages**（服务端自动平衡，等效 hi_res 级；中文自动识别）。

**调用流程**（`unstructured.client.ts` `parsePdfWithUnstructured`）：

```
parse.run({ input, output: "elements", include: ["table_html"], waitSeconds: 0 })
  → 200: 直接返回元素 | 202: job id
  → jobs.get(jobId, { output: "elements", include: ["table_html"] }) 每 2s 轮询
  → 完成：elements 数组；120s 超时抛错（由调用方回退）
```

**元素 → 标准化文本映射**（`elementsToPageTexts`）：

| Unstructured 元素类型 | 输出格式 |
| --- | --- |
| `Title` | `## 标题` |
| `Table` | `[表格]\n` + `textAsHtml` 转行列（`|` 分隔） |
| `ListItem` | `- 条目` |
| `Header` / `Footer` / `PageBreak` | 丢弃 |
| `NarrativeText` / 其余 | 原文（段落自然换行） |

**失败回退**：Unstructured 调用异常（key 缺失、网络、超时、job 失败）→ 该页回退 `pdf-parse` 原始文本，解析链路不中断。

### 3.4 扫描页 → 百度 OCR（`baidu.client.ts`）

- 接口：百度智能云「文档解析-办公文档识别 `doc_analysis_office`」（`layout_analysis`），返回版面结构（标题/表格/阅读顺序/页眉页脚）。
- `access_token` 进程内缓存（约 29 天 TTL）。
- 版面重组 `pageToText`：剔除 `header/footer/number/footnote`；`title` → `## 标题`；`table` → `[表格]` + 行内 `top` 容差 10px 归行、按 `left` 排序；`figure` 跳过。
- **直传上限**：`pdf_file` base64+urlencode 后 ≤ 4M（原始约 2.5MB，`PDF_DIRECT_LIMIT_BYTES`）；超出且含扫描页 → 明确报错，建议压缩/拆分。

### 3.5 模式判定（`buildDocument` metadata）

| 场景 | `mode` | `ocrPages` |
| --- | --- | --- |
| 纯文本 PDF（零扫描页） | `text-layer` | 0 |
| 纯扫描件（全部走 OCR） | `baidu-doc-analysis` | = pages |
| 混合文档（逐页路由） | `mixed` | = 实际 OCR 页数 |

多页输出加 `===== 第 N 页 =====` 分隔，空页过滤。

---

## 4. Markdown 解析管线

`loadMarkdown`：按 UTF-8 读全文 → 单个 `Document`。不做渲染/结构提取——切片阶段由 `RecursiveCharacterTextSplitter` 按段落/标题递归切分，MD 结构（标题层级）在切片时自然保留。

---

## 5. 切片与嵌入（`rag.service.ts`）

- **切片**：`RecursiveCharacterTextSplitter`，`chunkSize: 500`、`chunkOverlap: 50`，按段落 → 句子 → 逗号 → 字符优先级递归切分。
- **嵌入**：Ollama `qwen3-embedding:0.6b`（1024 维），`EMBEDDING_BASE_URL` 默认 `http://localhost:11434`。
- **入库**：`PGVectorStore`（pgvector 扩展），向量列 `embedding`；同库旁表 `rag_bm25_index` 同步写词法索引（BM25）。
- **检索**：向量 + BM25 双路召回，**RRF 融合**（只用名次不用原始分，规避余弦 0~1 与 BM25 无上界不可比），同一 chunk 两路都命中时分数累加自然靠前。

---

## 6. 上传进度事件流（前端分步条）

`uploadDocument` 用 `withTaskEvents(TaskType.DOCUMENT_INDEX)` 包裹整条链路，前端按以下事件渲染「上传解析 → 切片 → 向量化 → 完成」四步条：

| 顺序 | 事件 | 含义 |
| --- | --- | --- |
| 1 | `task.started` | 「上传文档：xxx」 |
| 2 | `step=1` | 解析文档内容（PDF 逐页路由 / Markdown） |
| 3 | `step=2` | 解析完成（共 N 页 · mode · OCR M 页），开始切片与向量化 |
| 4 | `step=3` | 切片完成（N 片），开始向量化 |
| 5 | `step=4` | 向量化完成 |
| 6 | `task.completed` | 返回文档记录（含 chunkCount） |

上传链路把外层 `taskId` 透传给 `indexDocument`（`stepOffset=3`），避免嵌套任务导致前端锚错事件。

---

## 7. 环境变量清单（`apps/backend/.env`）

| 变量 | 用途 | 默认 |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL 连接串（pgvector） | — |
| `BAIDU_OCR_API_KEY` | 百度智能云应用 API Key | — |
| `BAIDU_OCR_SECRET_KEY` | 百度智能云应用 Secret Key | — |
| `UNSTRUCTURED_API_KEY` | Unstructured Transform v2 云 API key（必填） | — |
| `UNSTRUCTURED_API_URL` | Transform API 根地址 | `https://transform.unstructured.io` |
| `EMBEDDING_BASE_URL` | Ollama 地址 | `http://localhost:11434` |
| `EMBEDDING_MODEL` | 嵌入模型 | `qwen3-embedding:0.6b` |
| `EMBEDDING_DIMENSIONS` | 向量维度 | 1024 |

---

## 8. 验证记录（实测）

测试件：`test-fixtures/倍轻松N6mini使用说明书.pdf`（3 页，中文文本层正常）。

- **Unstructured v2 云 API 单测**：job 创建 → 轮询 → `completed`，39 个结构化元素；`Title/NarrativeText/Table` 打标正确；技术参数表 8 行完整还原（`textAsHtml` 行列文本）。
- **CJS 构建产物完整编排**：`loadPdf` → 页 1/3 走 Unstructured（`## 标题`、`[表格]` 齐备），页 2 走百度 OCR → `mode=mixed, pages=3, ocrPages=1`。
- **第 2 页 OCR 是合理路由而非误判**：该页为配件清单图，`pdf-parse` 仅提取 9 个字符（`使用说明书 × 1`）→ 命中 `MIN_TEXT_CHARS < 20` 判为扫描页，由百度 OCR 补全。

---

## 9. 限制与注意

1. **百度直传上限**：含扫描页的 PDF 原始体积需 < ~2.5MB（编码后 4M），超出报错建议压缩/拆分；纯文本层 PDF 不受限。
2. **Unstructured 计费与数据出域**：文本层页全部上传至 Unstructured 官方服务器解析，按解析量计费（免费额度有限）；内部/敏感文档需知晓数据出域。
3. **Node 版本**：`unstructured-transform-client` 要求 Node ≥ 22（当前环境 22.23.2 ✅）。
4. **Reranker**：Ollama 0.34.3 不支持 `/api/rerank`（需 ≥ v0.10），已搁置，未写代码。
5. **中文文件名**：上传接口配置 `FileInterceptor("file", { defParamCharset: "utf8" })`，busboy 按 UTF-8 解码 multipart 文件名（浏览器 FormData 无编码声明、busboy 默认 latin1 会乱码），已实测中文/含空格/纯 ASCII 三种场景；旧的 `decodeFileName` 还原逻辑已移除。

---

## 10. 相关文件索引

| 文件 | 职责 |
| --- | --- |
| `packages/ai-engine/src/loaders/extract.ts` | 文档解析统一入口 `parseDocument`（类型路由收敛于此） |
| `packages/ai-engine/src/loaders/pdf/loader.ts` | PDF 解析编排（逐页路由 + 双通道组装） |
| `packages/ai-engine/src/loaders/pdf/unstructured.ts` | Unstructured Transform v2 SDK 客户端 + 元素标准化 |
| `packages/ai-engine/src/loaders/pdf/baidu.ts` | 百度认证 / doc_analysis_office / 版面重组 |
| `packages/ai-engine/src/loaders/pdf/loader.ts`（内含） | `needOcrPage` 逐页路由判定（纯函数） |
| `packages/ai-engine/src/loaders/markdown/loader.ts` | Markdown 解析 |
| `packages/ai-engine/src/rag/rag.service.ts` | 切片 / 嵌入 / 向量入库 / BM25 / RRF 混合检索 |
| `apps/backend/src/document/document.service.ts` | 进度事件、DB 记录、失败回滚（解析只调 `parseDocument`） |
| `apps/backend/src/knowledge/knowledge.service.ts` | 知识库容器 CRUD（与文档操作分离） |
