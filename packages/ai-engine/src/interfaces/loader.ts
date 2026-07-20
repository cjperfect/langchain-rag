export interface CsvLoadOptions {
  /** 作为 pageContent 的列名，不传则整行转 key: value */
  column?: string;
  /** 分隔符，默认逗号 */
  separator?: string;
}

export interface PdfLoadOptions {
  /** 是否按页分割，默认 true（每页一个 Document） */
  splitPages?: boolean;
  /** 合并模式下的页间分隔符，默认空字符串 */
  parsedItemSeparator?: string;
}
