export type StreamEvent =
  | { type: "token"; content: string }
  | { type: "reasoning"; content: string }
  | { type: "tool_start"; name?: string }
  | { type: "tool_end"; name?: string; result?: unknown };
