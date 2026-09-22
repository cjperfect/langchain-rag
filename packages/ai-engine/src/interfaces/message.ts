import type { RagSearchResult } from "./rag";

export type StreamEvent =
  | { type: "token"; content: string }
  | { type: "reasoning"; content: string }
  | { type: "tool_start"; name?: string }
  | { type: "tool_end"; name?: string; result?: unknown }
  | {
      type: "knowledge_search";
      /** on_tool_start 时是模型填写的检索词；on_tool_end 时为空串（沿用既有约定） */
      query: string;
      /** 本次请求的作用域，来自 configurable 而非模型输入 */
      kbIds?: number[];
      kbNames?: string[];
      /** 供前端展示的格式化文本 */
      results?: string;
      /** 本次流**累计**的结构化检索结果（含重试与并行调用），后端据此汇总知识来源 */
      docs?: RagSearchResult[];
    };
