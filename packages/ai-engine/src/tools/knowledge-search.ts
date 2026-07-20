/** 知识库检索工具 — Agent 可调用此工具搜索企业内部知识库 */
import { tool } from "langchain";
import { z } from "zod";
import { ragService } from "../rag";
import type { RagSearchResult } from "../interfaces/rag";

/** 最近一次检索结果（供 agent event handler 读取结构化数据） */
let lastSearchResults: RagSearchResult[] = [];
export function getLastSearchResults(): RagSearchResult[] {
  return lastSearchResults;
}

export const knowledgeSearchTool = tool(
  async ({ query, kbIds }) => {
    const results = await ragService.search(query, {
      kbIds: kbIds ?? undefined,
      k: 5,
    });

    lastSearchResults = results;

    if (results.length === 0) {
      return "未找到相关文档。请告知用户当前知识库中没有匹配的信息。";
    }

    return results
      .map(
        (r, i) =>
          `[文档片段 ${i + 1}] 来源: ${r.kbName ?? `知识库#${r.kbId}`}` +
          `${r.documentName ? `/${r.documentName}` : ""}` +
          ` (相似度: ${(r.score * 100).toFixed(1)}%)\n${r.content}`,
      )
      .join("\n\n");
  },
  {
    name: "search_knowledge_base",
    description: `在企业知识库中检索相关文档内容。
适用场景：
- 用户询问公司政策、流程、规范、产品文档等内部资料
- 需要查找特定业务知识或操作指南
- 用户的问题需要基于公司文档来回答

注意：
- 检索结果来自向量相似度匹配，可能不完全精确
- 如果检索无结果，请明确告知用户知识库中没有相关信息`,
    schema: z.object({
      query: z.string().describe("检索查询语句，建议使用问题中的关键词"),
      kbIds: z
        .array(z.number())
        .optional()
        .describe("限定检索的知识库 ID 列表，不传则检索所有知识库"),
    }),
  },
);
