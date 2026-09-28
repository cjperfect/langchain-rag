export * from "./extract";
// loader 工具函数一并导出（内部在回退路径使用，导出便于单测与外部复用）
export { loadPdf, needOcrPage, markLocalTables, cleanFallbackPageTexts, isPageNumberLine, reflowBrokenLines, normalizeHeadings } from "./pdf/loader";
// 图片语义化（豆包视觉识别流程图/架构图）：导出供验证与外部复用
export { detectPdfImageBlocks, isImageSemanticEnabled, semanticizePdfFigures } from "./pdf/image-semantic";
export type { FigureBlock, ImageSemanticResult } from "./pdf/image-semantic";
// Unstructured 元素解析（导出便于验证坐标格式与图片语义化）
export { parsePdfWithUnstructured, elementsToPageTexts } from "./pdf/unstructured";
