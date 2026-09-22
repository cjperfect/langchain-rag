/** 知识库检索工具 — Agent 可调用此工具搜索企业内部知识库 */
import { tool } from "langchain";
import type { ToolRunnableConfig } from "@langchain/core/tools";
import { z } from "zod";
import { ragService } from "../rag";
import type { RagSearchResult } from "../interfaces/rag";

/**
 * 一次对话流（一次 `streamEvents` 调用）的检索收集器。
 *
 * 由 `AiEngine.streamEvents` 每次调用时新建、经 `configurable` 下传；
 * 工具把结果并入，事件处理器从同一个对象读。
 * 数据跟着单次流走，取代原先的模块级可变变量（进程内共享，并发会话会互相覆盖）。
 *
 * 语义是**累计**而非覆盖：模型可能并行发起或改写重试多次检索，
 * 若每次覆盖，先发起那次的结果会被后一次顶掉，最终汇总的知识来源会丢。
 */
export interface RetrievalScope {
  results: RagSearchResult[];
}

/** 去重键：同一文档的同一切片只保留一份 */
function chunkKey(r: RagSearchResult): string {
  return `${r.kbId}:${r.documentId}:${r.chunkIndex ?? ""}:${r.content}`;
}

/** 把本次检索结果并入作用域（按切片去重），供事件处理器汇总知识来源 */
export function appendScopedResults(scope: RetrievalScope | undefined, results: RagSearchResult[]): void {
  if (!scope) return;
  const seen = new Set(scope.results.map(chunkKey));
  for (const r of results) {
    const key = chunkKey(r);
    if (seen.has(key)) continue;
    seen.add(key);
    scope.results.push(r);
  }
}

/** 形状校验：configurable 里的值类型是 unknown，不能直接当结构用 */
function isRetrievalScope(value: unknown): value is RetrievalScope {
  return typeof value === "object" && value !== null && "results" in value && Array.isArray(value.results);
}

/** 读本次调用的检索作用域；不是本进程放进去的对象就当作没有 */
export function readRetrievalScope(config?: ToolRunnableConfig): RetrievalScope | undefined {
  const raw: unknown = config?.configurable?.retrieval;
  return isRetrievalScope(raw) ? raw : undefined;
}

/**
 * 读本次请求允许检索的知识库范围。
 *
 * 作用域来自 harness（后端会话配置），**不来自模型输入**——
 * 模型无从得知会话勾选了哪些库，让它填只会填出 undefined，进而把范围静默扩大到全库。
 * 逐项运行时校验，避免把 `configurable` 的值直接当 number[] 用。
 */
export function readScopedKbIds(config?: ToolRunnableConfig): number[] {
  const raw: unknown = config?.configurable?.kbIds;
  if (!Array.isArray(raw)) return [];
  return raw.filter((value): value is number => typeof value === "number");
}

/** 匹配方式的可读标签（混合检索结果标注命中来源，便于用户理解排序） */
const MATCH_LABELS: Record<string, string> = {
  both: "语义+关键词",
  semantic: "语义",
  keyword: "关键词",
};

export const knowledgeSearchTool = tool(
  async ({ query }, config) => {
    const kbIds = readScopedKbIds(config);

    // fail-closed：作用域缺失就拒绝检索，绝不降级为「检索全部知识库」。
    // 静默扩大范围会把用户勾选之外的库内容答进回答并标成来源，是隔离性问题而非准确性问题。
    if (kbIds.length === 0) {
      return "当前会话未指定知识库，无法检索。请提示用户先选择要查询的知识库。";
    }

    const results = await ragService.search(query, { kbIds, k: 5 });

    // 并入本次流的作用域（累计去重），事件处理器据此汇总知识来源
    appendScopedResults(readRetrievalScope(config), results);

    if (results.length === 0) {
      return "未找到相关文档。请告知用户当前知识库中没有匹配的信息。";
    }

    return results
      .map(
        (r, i) =>
          `[文档片段 ${i + 1}] 来源: ${r.kbName ?? `知识库#${r.kbId}`}` +
          `${r.documentName ? `/${r.documentName}` : ""}` +
          ` (匹配: ${MATCH_LABELS[r.matchType] ?? r.matchType}, 得分: ${(r.score * 100).toFixed(1)}%)\n${r.content}`,
      )
      .join("\n\n");
  },
  {
    name: "search_knowledge_base",
    description: `在本次会话指定的知识库中检索相关文档内容（向量语义 + BM25 关键词混合检索）。
适用场景：
- 用户询问公司政策、流程、规范、产品文档等内部资料
- 需要查找特定业务知识或操作指南
- 用户的问题需要基于公司文档或产品说明书来回答

注意：
- 检索范围由会话设定：你只能决定「查什么」，无法改变「能查哪些库」。未指定知识库时工具会直接返回提示。
- 检索结果按混合相关性排序，可能不完全精确。
- 一次不理想时改写查询词（设备型号、故障码、功能关键词）再试，最多重试两次。
- 检索无结果时请明确告知用户知识库中没有相关信息，不要凭记忆补全。`,
    schema: z.object({
      query: z.string().describe("检索查询语句；建议使用问题中的关键词，首次不理想时可换用型号、故障码等功能关键词"),
    }),
  },
);
