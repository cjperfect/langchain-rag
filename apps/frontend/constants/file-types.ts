// ============================================================================
// 文件类型 → 颜色、工具函数（纯数据，无 JSX）
// ============================================================================

/** 文件类型对应的标签颜色 */
export const FILE_TYPE_COLORS: Record<string, string> = {
  pdf: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
  docx: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  md: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  txt: "bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  sql: "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
  ts: "bg-cyan-50 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400",
  tsx: "bg-cyan-50 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400",
  js: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
  py: "bg-blue-50 text-blue-500 dark:bg-blue-950 dark:text-blue-400",
  pptx: "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
};

/** 默认标签颜色（未知文件类型回退） */
export const DEFAULT_FILE_COLOR = "bg-muted text-muted-foreground";

/** 文件大小格式化：字节 → 可读字符串 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
