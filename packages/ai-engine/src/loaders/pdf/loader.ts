import { readFileSync } from "fs";
import { PDFParse } from "pdf-parse";
import type { Document } from "@langchain/core/documents";
import type { PdfLoadOptions } from "../../interfaces/loader";
import { PDF_DIRECT_LIMIT_BYTES, ocrPdfPage, pageToText } from "./baidu";
import { parsePdfWithUnstructured, elementsToPageTexts } from "./unstructured";

/**
 * PDF 解析编排层（Unstructured 版面分析 + 百度 OCR 智能路由）。
 *
 * 职责：决定每一页走「Unstructured 版面分析」还是「百度 OCR」，并组装最终 Document。
 * 能力拆分（pdf/ 目录共 3 个文件，按职责划分）：
 *   - loader.ts：编排 + 逐页路由判定（needOcrPage，纯函数可单测）
 *   - unstructured.ts：调 Unstructured Transform v2 云 API（官方托管），元素打标 + 表格结构化
 *   - baidu.ts：百度认证、接口调用、OCR 结果的版面重组（表格/标题/页眉页脚）
 *
 * 流程：
 *   1. pdf-parse 逐页提取文本（用于逐页路由判定 + Unstructured 失败时的回退文本）；
 *   2. 文本层页 → Unstructured 版面分析（v2 自动平衡策略，等效 hi_res 级）：
 *      标题/段落/表格/列表元素打标，表格输出行列结构化文本（保留文档结构，提升 RAG 检索精度）；
 *   3. 空页/乱码页/扫描页 → 百度「办公文档识别 doc_analysis_office」（layout_analysis），
 *      输出版面（标题/表格/阅读顺序）并剔除页眉/页脚/页码/脚注；
 *   4. Unstructured 服务不可用/超时 → 回退 pdf-parse 原始文本，解析链路不中断；
 *   5. 纯文本 PDF 全程不调 OCR（mode=text-layer）；纯扫描件全 OCR（mode=baidu-doc-analysis）；
 *      混合文档逐页路由（mode=mixed）。
 *
 * 说明：不用 LangChain PDFLoader 的 splitPages:true 做逐页判定，是因为它会把
 * 无文本的图片页过滤掉，导致页号错位、扫描页丢失；pdf-parse 的 getText() 按真实
 * 页码返回每一页（空页保留空串），页号与 OCR 队列严格对齐。
 *
 * 限制：doc_analysis_office 的 pdf_file 要求 base64 编码并 urlencode 后 ≤4M
 *   （原始文件约 2.5MB 以内）；超出且含扫描页的文件会报错，建议压缩/拆分。
 *
 * 依赖环境变量（apps/backend/.env）：
 *   BAIDU_OCR_API_KEY       百度智能云应用的 API Key
 *   BAIDU_OCR_SECRET_KEY    百度智能云应用的 Secret Key
 *   UNSTRUCTURED_API_KEY    Unstructured Transform v2 云 API key（transform.unstructured.io 控制台获取）
 */

/** 超出直传上限时的统一报错（「无法解析」与「含扫描页」两种场景复用同一提示） */
function throwOversizeError(reason: "无法本地解析文本" | "包含无文本层页面"): never {
  throw new Error(
    `PDF 文件超过 ${PDF_DIRECT_LIMIT_BYTES / 1024 / 1024}MB 且${reason}，` +
      `超出百度文档解析 pdf_file 直传上限（编码后 4M），请压缩或拆分后重试`,
  );
}

// ==========================================================================
// 逐页路由判定（纯函数、无副作用，可独立单测）
// ==========================================================================

/** 本地提取文本达到该字符数才视为「有文本层」，否则按扫描页走 OCR */
const MIN_TEXT_CHARS = 20;
/** 页面提取文本中至少出现该数量的中文字符，才判定为有效中文文本层 */
const MIN_CJK_CHARS = 5;

/**
 * 判定某页是否应走 OCR：
 *   - 文本太少（空页/纯扫描页）→ OCR；
 *   - 有足够中文字符 → 有效文本层，本地提取；
 *   - 无中文时检查乱码特征：出现大量替换字符 U+FFFD，或
 *     「可读字符（中日韩/全角标点/ASCII）」占比过低 → 疑似字体编码异常，走 OCR；
 *   - 反之（无中文但可读字符占比高，如纯英文页）→ 按文本页处理，避免误 OCR 英文文档。
 */
export function needOcrPage(pageText: string): boolean {
  const text = pageText.trim();
  if (text.length < MIN_TEXT_CHARS) return true;

  const cjkCount = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
  if (cjkCount >= MIN_CJK_CHARS) return false;

  if ((text.match(/\uFFFD/g) ?? []).length / text.length > 0.1) return true;

  const usableRatio =
    (text.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u3000-\u303f\uff00-\uffef\x00-\x7f]/g) ?? []).length /
    text.length;
  return usableRatio < 0.7;
}

// ==========================================================================
// 编排
// ==========================================================================

/** pdf-parse 逐页提取文本：按真实页码返回每一页（空页保留空串，页号与 OCR 队列对齐） */
async function extractLocalPageTexts(filePath: string): Promise<string[]> {
  const parser = new PDFParse({ data: new Uint8Array(readFileSync(filePath)) });
  try {
    const result = await parser.getText();
    return result.pages.map((p) => p.text.trim());
  } finally {
    await parser.destroy();
  }
}

/**
 * 文本层页 → Unstructured 版面分析（v2 自动平衡策略：标题/段落/表格元素打标，表格行列结构化）。
 *
 * 只替换路由判定为「无需 OCR」的页；扫描页保留 pdf-parse 占位文本，稍后由百度 OCR 覆盖。
 * Unstructured 服务不可用/超时/异常时整体回退 pdf-parse 原始文本，保证解析链路不中断。
 */
async function applyUnstructuredToTextPages(
  filePath: string,
  buffer: Buffer,
  localPages: string[],
  scanPageNums: number[],
): Promise<string[]> {
  const pageTexts = localPages.slice();
  const scanPageSet = new Set(scanPageNums);

  try {
    const elements = await parsePdfWithUnstructured(buffer, {
      strategy: "hi_res",
      languages: ["chi_sim"],
    });
    const structured = elementsToPageTexts(elements, localPages.length);
    structured.forEach((text, i) => {
      // 扫描页最终由百度 OCR 覆盖，不采用 Unstructured 输出（其内置 OCR 中文质量不如百度）
      if (!scanPageSet.has(i + 1)) pageTexts[i] = text;
    });
  } catch (err) {
    console.warn(
      `[loadPdf] Unstructured 版面分析失败，文本层页回退本地提取：${err instanceof Error ? err.message : String(err)}`,
    );
  }
  return pageTexts;
}

/** 本地文本层探测失败（无法解析）时的整份文档 OCR 通道 */
async function routeWholeOcr(
  filePath: string,
  buffer: Buffer,
  options?: PdfLoadOptions,
): Promise<Document[]> {
  if (buffer.byteLength > PDF_DIRECT_LIMIT_BYTES) {
    throwOversizeError("无法本地解析文本");
  }

  // 第一页调用同时返回 pdf_file_size 总页数，再逐页结构化识别
  const first = await ocrPdfPage(buffer);
  const pages = first.pdf_file_size ?? 1;
  const pageTexts = [pageToText(first)];
  for (let page = 2; page <= pages; page++) {
    pageTexts.push(pageToText(await ocrPdfPage(buffer, page)));
  }
  return buildDocument(filePath, pageTexts, { pages, ocrPages: pages, options });
}

/**
 * 智能路由解析 PDF：文本层页 → Unstructured 版面分析，扫描页 → 百度 OCR。
 * 纯文本 PDF 全程不调 OCR；纯扫描件全 OCR；混合文档逐页路由。
 *
 * @param filePath PDF 文件路径
 * @param options  可选：splitPages（语义对齐，当前统一返回单文档）、parsedItemSeparator
 */
export async function loadPdf(filePath: string, options?: PdfLoadOptions): Promise<Document[]> {
  const buffer = readFileSync(filePath);

  // 1) pdf-parse 逐页提取（路由判定 + Unstructured 失败回退都用它）
  let localPages: string[] = [];
  try {
    localPages = await extractLocalPageTexts(filePath);
  } catch (err) {
    // 解析失败时整份文档走 OCR（百度服务端自己栅格化，容错更强）
    console.warn(
      `[loadPdf] 本地文本层探测失败，整份文档走 OCR：${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (localPages.length === 0) {
    return routeWholeOcr(filePath, buffer, options);
  }

  // 2) 逐页判断：有文本层的页保留本地文本，空页/乱码页/扫描页进入 OCR 队列
  const scanPageNums: number[] = [];
  localPages.forEach((text, i) => {
    if (needOcrPage(text)) scanPageNums.push(i + 1);
  });

  // 3) 文本层页 → Unstructured 版面分析（元素打标/表格结构化；失败回退本地文本）
  const pageTexts = await applyUnstructuredToTextPages(filePath, buffer, localPages, scanPageNums);

  if (scanPageNums.length === 0) {
    // 3a) 纯文本 PDF：不调 OCR，直接入库
    return buildDocument(filePath, pageTexts, { pages: localPages.length, ocrPages: 0, options });
  }

  // 3b) 存在扫描页：文件需在 doc_analysis_office 直传上限内
  if (buffer.byteLength > PDF_DIRECT_LIMIT_BYTES) {
    throwOversizeError("包含无文本层页面");
  }

  // 4) 扫描页逐页走 doc_analysis_office（结构化识别），其余页保留 Unstructured 结果
  for (const page of scanPageNums) {
    pageTexts[page - 1] = pageToText(await ocrPdfPage(buffer, page));
  }
  return buildDocument(filePath, pageTexts, { pages: localPages.length, ocrPages: scanPageNums.length, options });
}

/** 组装最终 Document：多页加页码分隔，元数据记录路由模式与 OCR 页数 */
function buildDocument(
  filePath: string,
  pageTexts: string[],
  info: { pages: number; ocrPages: number; options?: PdfLoadOptions },
): Document[] {
  const { pages, ocrPages, options } = info;
  const mode = ocrPages === 0 ? "text-layer" : ocrPages === pages ? "baidu-doc-analysis" : "mixed";

  const content = pageTexts
    .map((text, i) => (pages > 1 ? `===== 第 ${i + 1} 页 =====\n${text}` : text))
    .filter((t) => t.trim().length > 0)
    .join("\n\n");

  return [
    {
      pageContent: content,
      metadata: {
        source: filePath,
        mode,
        pages,
        ocrPages,
        splitPages: options?.splitPages ?? false,
      },
    },
  ];
}
