/**
 * 百度 OCR 客户端：认证、文档解析-办公文档识别调用，以及 OCR 结果的版面重组。
 *
 * 只负责「跟百度打交道」：换取 access_token、调用 doc_analysis_office、
 * 把接口返回的版面/行/表格结构重组为可入库文本。路由逻辑见 loader.ts，
 * 编排逻辑见 pdf/loader.ts。
 */

const BAIDU_TOKEN_URL = "https://aip.baidubce.com/oauth/2.0/token";
/** 文档解析-办公文档识别：输出版面结构（标题/表格/阅读顺序/页眉页脚），pdf_file 编码后限 4M */
const DOC_ANALYSIS_URL = "https://aip.baidubce.com/rest/2.0/ocr/v1/doc_analysis_office";
/** doc_analysis_office 的 pdf_file 要求 base64+urlencode 后 ≤4M，按原始字节 2.5MB 留出余量 */
export const PDF_DIRECT_LIMIT_BYTES = 2.5 * 1024 * 1024;

/** access_token 有效期约 30 天，进程内缓存避免每个文件都重复换取 */
const TOKEN_TTL_MS = 29 * 24 * 60 * 60 * 1000;

export interface BaiduDocAnalysisLine {
  words_type?: string;
  words?: {
    word?: string;
    words_location?: { left: number; top: number; width: number; height: number };
  };
}

export interface BaiduLayout {
  layout?: "table" | "figure" | "text" | "title" | "contents" | "doc_title";
  layout_idx?: number[];
}

export interface BaiduSection {
  attribute?: "section" | "header" | "footer" | "number" | "footnote";
  sec_idx?: { idx?: number[] };
}

export interface BaiduDocAnalysisResponse {
  results?: BaiduDocAnalysisLine[];
  layouts?: BaiduLayout[];
  sections?: BaiduSection[];
  pdf_file_size?: number;
  error_code?: number;
  error_msg?: string;
}

interface BaiduTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;

export function getBaiduKeys(): { apiKey: string; secretKey: string } {
  const apiKey = process.env.BAIDU_OCR_API_KEY?.trim() ?? "";
  const secretKey = process.env.BAIDU_OCR_SECRET_KEY?.trim() ?? "";
  if (!apiKey || !secretKey) {
    throw new Error(
      "缺少百度 OCR 配置：请设置环境变量 BAIDU_OCR_API_KEY 与 BAIDU_OCR_SECRET_KEY（apps/backend/.env）",
    );
  }
  return { apiKey, secretKey };
}

/** 换取 access_token（命中进程内缓存则直接复用） */
async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;

  const { apiKey, secretKey } = getBaiduKeys();
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: apiKey,
    client_secret: secretKey,
  });
  const res = await fetch(`${BAIDU_TOKEN_URL}?${params.toString()}`, {
    method: "POST",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`获取百度 access_token 失败：HTTP ${res.status}`);
  const data = (await res.json()) as BaiduTokenResponse;
  if (!data.access_token) {
    throw new Error(
      `获取百度 access_token 失败：${data.error ?? "unknown"} ${data.error_description ?? ""}`.trim(),
    );
  }
  cachedToken = { token: data.access_token, expiresAt: Date.now() + TOKEN_TTL_MS };
  return data.access_token;
}

/**
 * 识别 PDF 指定页（doc_analysis_office，pageNum 不传则默认第 1 页，同时返回 pdf_file_size 总页数）
 */
export async function ocrPdfPage(
  pdfBuffer: Buffer,
  pageNum?: number,
): Promise<BaiduDocAnalysisResponse> {
  const token = await getAccessToken();

  const form = new URLSearchParams();
  form.set("access_token", token);
  form.set("pdf_file", pdfBuffer.toString("base64"));
  if (pageNum !== undefined) form.set("pdf_file_num", String(pageNum));
  form.set("language_type", "CHN_ENG");
  form.set("layout_analysis", "true");

  const res = await fetch(DOC_ANALYSIS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`百度 OCR 请求失败：HTTP ${res.status}`);
  const data = (await res.json()) as BaiduDocAnalysisResponse;
  if (data.error_code) {
    throw new Error(`百度 OCR 返回错误 ${data.error_code}：${data.error_msg ?? ""}`);
  }
  return data;
}

/** 表格区域内的文本行按 y 坐标归并成行、行内按 x 排序，恢复表格行列结构 */
function formatTable(idxs: number[], lines: BaiduDocAnalysisLine[]): string {
  interface Cell {
    top: number;
    left: number;
    word: string;
  }

  const cells: Cell[] = [];
  for (const i of idxs) {
    const loc = lines[i].words?.words_location;
    if (!loc) return idxs.map((j) => lines[j].words?.word ?? "").join("\n"); // 无坐标时退回平铺
    cells.push({ top: loc.top, left: loc.left, word: lines[i].words?.word ?? "" });
  }

  // 按 top 归行（容差 10px 视为同一行），行内按 left 排序
  const rows: Cell[][] = [];
  for (const cell of cells.sort((a, b) => a.top - b.top || a.left - b.left)) {
    const target = rows.find((row) => Math.abs(row[0].top - cell.top) <= 10);
    if (target) target.push(cell);
    else rows.push([cell]);
  }
  return rows
    .map((row) => row.sort((a, b) => a.left - b.left).map((c) => c.word).join(" | "))
    .join("\n");
}

/** 把单页 OCR 结果按版面阅读顺序重组为文本：剔除页眉/页脚/页码/脚注，标题与表格加结构标记 */
export function pageToText(res: BaiduDocAnalysisResponse): string {
  const lines = res.results ?? [];

  // 收集需要剔除的文本行序号（页眉/页脚/页码/脚注）
  const excluded = new Set<number>();
  for (const section of res.sections ?? []) {
    const attr = section.attribute;
    if (attr === "header" || attr === "footer" || attr === "number" || attr === "footnote") {
      for (const idx of section.sec_idx?.idx ?? []) excluded.add(idx);
    }
  }

  const layouts = res.layouts ?? [];
  if (layouts.length === 0) {
    // 版面分析未输出时，退回全部文本行（仅剔除页眉页脚类）
    return lines
      .map((line, i) => (excluded.has(i) ? "" : line.words?.word ?? ""))
      .filter((t) => t.length > 0)
      .join("\n");
  }

  const parts: string[] = [];
  for (const layout of layouts) {
    const type = layout.layout ?? "text";
    const idxs = (layout.layout_idx ?? []).filter(
      (i) => !excluded.has(i) && Boolean(lines[i]?.words?.word),
    );
    if (idxs.length === 0) continue; // figure 无文本、或内容全被剔除

    if (type === "table") {
      parts.push(`[表格]\n${formatTable(idxs, lines)}`);
      continue;
    }
    if (type === "figure") continue; // 图片本身无文本

    const text = idxs.map((i) => lines[i].words?.word ?? "").join("\n");
    // 接口对标题的标签为 doc_title（个别场景 title），统一按标题输出
    if (type === "doc_title" || type === "title") parts.push(`## ${text}`);
    else parts.push(text); // text / contents 按普通文本输出
  }
  return parts.join("\n");
}
