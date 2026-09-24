export interface PdfLoadOptions {
  /** 是否按页分割，默认 true（每页一个 Document） */
  splitPages?: boolean;
  /** 合并模式下的页间分隔符，默认空字符串 */
  parsedItemSeparator?: string;
}
