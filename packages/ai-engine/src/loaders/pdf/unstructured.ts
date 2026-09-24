/**
 * Unstructured Transform v2 客户端（官方托管 API）：负责「版面分析 + 元素打标」。
 *
 * 只负责跟 Unstructured 云服务打交道：上传 PDF、接收元素列表、把元素按页重组为标准化文本。
 * 路由编排见 loader.ts（文本层页 → Unstructured，扫描页 → 百度 OCR）。
 *
 * 实现方式：官方 JS SDK `unstructured-transform-client`（内部封装 api/v2 的
 *   创建任务 → 轮询 → 下载结果 三步，输出结构化元素 JSON）。
 *
 * 依赖环境变量（apps/backend/.env）：
 *   UNSTRUCTURED_API_KEY   transform.unstructured.io 控制台「API Keys」里复制的 key（必填）
 *   UNSTRUCTURED_API_URL   可选，默认 https://transform.unstructured.io
 *
 * 注意：Transform v2 是「一个文档进去，结构化输出回来」的新一代接口，不再需要手动指定
 *   strategy（vlm/hi_res/fast），由服务端按 profile 自动平衡；中文自动识别，无需 languages 参数。
 *   与旧版 Partition Endpoint（api.unstructuredapp.io/general/v0/general）不兼容，key 也不通用。
 */

/** 轮询解析结果的总超时（v2 走异步任务，给足时间） */
const UNSTRUCTURED_TIMEOUT_MS = 120_000;
/** 轮询间隔 */
const UNSTRUCTURED_POLL_INTERVAL_MS = 2_000;

/** Unstructured 元素类型（常见子集） */
export type UnstructuredElementType =
  | "Title"
  | "NarrativeText"
  | "Table"
  | "ListItem"
  | "PageBreak"
  | "Header"
  | "Footer"
  | "FigureCaption"
  | "Figure"
  | "Image"
  | "UncategorizedText"
  | string;

export interface UnstructuredElement {
  element_id?: string;
  type?: UnstructuredElementType;
  text?: string;
  metadata?: {
    page_number?: number;
    /** Table 类型特有的 HTML 表格结构 */
    text_as_html?: string;
  };
}

export interface UnstructuredParseOptions {
  /** 保留兼容位：v2 由服务端自动平衡（profile），不再需要手动选策略；此处仅文档说明 */
  strategy?: "hi_res" | "fast" | "auto" | "ocr_only";
  /** 保留兼容位：v2 自动识别语言，无需传参 */
  languages?: string[];
}

/** SDK 返回的 Element（见 unstructured-transform-client 类型定义） */
interface TransformElement {
  elementId: string;
  type: string;
  text: string | null;
  metadata: {
    pageNumber: number | null;
    textAsHtml: string | null;
  };
}

/**
 * 调用 Unstructured 解析 PDF，返回元素列表（标题/段落/表格/列表已打标，表格带 text_as_html）
 *
 * 失败时抛错（由调用方决定降级策略——默认回退 pdf-parse 原始文本，不让解析链路挂掉）。
 * SDK 为 ESM-only，这里用动态 import 以兼容本包的双构建（CJS + ESM）。
 */
export async function parsePdfWithUnstructured(
  pdfBuffer: Buffer,
  _options: UnstructuredParseOptions = {},
): Promise<UnstructuredElement[]> {
  const apiKey = process.env.UNSTRUCTURED_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 Unstructured 云 API 配置：请设置环境变量 UNSTRUCTURED_API_KEY（apps/backend/.env）");
  }

  // 动态加载官方 SDK（ESM-only）；CJS 构建下 node 22 支持动态 import ESM
  const { TransformClient, isAccepted } = await import("unstructured-transform-client");
  const client = new TransformClient({ apiKey });

  const outcome = await client.parse.run({
    input: { data: pdfBuffer, filename: "document.pdf" },
    output: "elements",
    include: ["table_html"],
    waitSeconds: 0, // 不阻塞，拿 job handle 后自行轮询，便于统一超时控制
  });

  let elements: TransformElement[] = [];

  if (isAccepted(outcome)) {
    const jobId = outcome.body.id;
    const deadline = Date.now() + UNSTRUCTURED_TIMEOUT_MS;

    let job = await client.jobs.get(jobId, { output: "elements", include: ["table_html"] });
    while (job.status === "queued" || job.status === "processing") {
      if (Date.now() >= deadline) {
        throw new Error(`Unstructured 解析超时：job ${jobId} 在 ${UNSTRUCTURED_TIMEOUT_MS / 1000}s 内未完成（状态 ${job.status}）`);
      }
      await new Promise((resolve) => setTimeout(resolve, UNSTRUCTURED_POLL_INTERVAL_MS));
      job = await client.jobs.get(jobId, { output: "elements", include: ["table_html"] });
    }

    if (job.status !== "completed" || !job.result) {
      throw new Error(`Unstructured 解析失败：job ${jobId} 最终状态 ${job.status}`);
    }
    elements = job.result.elements ?? [];
  } else {
    elements = outcome.body.elements ?? [];
  }

  return elements.map(toUnstructuredElement);
}

/** SDK Element → 项目内部元素结构（对齐百度 OCR 页的版面语义） */
function toUnstructuredElement(el: TransformElement): UnstructuredElement {
  return {
    element_id: el.elementId,
    type: el.type,
    text: el.text ?? "",
    metadata: {
      page_number: el.metadata.pageNumber ?? 1,
      text_as_html: el.metadata.textAsHtml ?? undefined,
    },
  };
}

/** 把 `<table><tr><td>a</td><td>b</td></tr></table>` 简化为行文本（列用 | 分隔），保留行列结构 */
export function htmlTableToText(html: string): string {
  return html
    .replace(/<table[^>]*>/gi, "")
    .replace(/<tr[^>]*>/gi, "\n")
    .replace(/<\/tr>/gi, "")
    .replace(/<t[dh][^>]*>/gi, " | ")
    .replace(/<\/t[dh]>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\n\s*\|\s*/g, "\n") // 行首多余的列分隔符
    .replace(/^\| /gm, "")
    .trim();
}

/**
 * 把 Unstructured 元素列表按页码重组为「每页一段标准化文本」。
 *
 * 标准化规则（对齐现有知识库格式）：
 *   - Title        → `## 标题`（与百度 OCR 页的标题标记一致）
 *   - Table        → `[表格]\n行列文本`（与百度 OCR 页的表格标记一致）
 *   - ListItem     → `- 条目`
 *   - Header/Footer→ 丢弃（页眉页脚不产生内容）
 *   - 其余正文     → 原文
 * 每个元素之间用换行分隔，保持段落结构，方便后续切片。
 */
export function elementsToPageTexts(elements: UnstructuredElement[], totalPages: number): string[] {
  const pages: string[][] = Array.from({ length: totalPages }, () => []);

  for (const el of elements) {
    const type = el.type ?? "UncategorizedText";
    const text = (el.text ?? "").trim();
    if (!text) continue;
    if (type === "Header" || type === "Footer" || type === "PageBreak") continue;

    const page = el.metadata?.page_number ?? 1;
    const target = pages[page - 1] ?? pages[0];

    switch (type) {
      case "Title":
        target.push(`## ${text}`);
        break;
      case "Table":
        target.push(`[表格]\n${el.metadata?.text_as_html ? htmlTableToText(el.metadata.text_as_html) : text}`);
        break;
      case "ListItem":
        target.push(`- ${text}`);
        break;
      default:
        // NarrativeText / UncategorizedText 等按正文输出，段落之间自然换行
        target.push(text);
    }
  }

  return pages.map((lines) => lines.join("\n"));
}
