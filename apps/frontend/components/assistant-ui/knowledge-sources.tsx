"use client";

import { useAuiState } from "@assistant-ui/react";
import { Library, FileText } from "lucide-react";
import { useMemo, type FC } from "react";

/** RAG 来源数据结构（来自后端 done 事件的 rag_sources） */
interface RagSource {
  kbId: number;
  kbName: string;
  documentId: number;
  documentName: string;
  score: number;
}

/** 稳定空数组引用，避免 useAuiState 选择器每次返回新 [] 导致无限渲染 */
const EMPTY_SOURCES: RagSource[] = [];

/** 取唯一来源（按 kbId + documentId 去重），按相似度降序 */
function dedupeSources(sources: RagSource[]): RagSource[] {
  const seen = new Set<string>();
  return sources
    .filter((s) => {
      const key = `${s.kbId}_${s.documentId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.score - a.score);
}

export const KnowledgeSources: FC = () => {
  const rawSources = useAuiState(
    (s) => (s.message.metadata?.custom?.rag_sources as RagSource[]) ?? EMPTY_SOURCES,
  );

  // 去重 + 分组，只在 rawSources 变化时重算
  const grouped = useMemo(() => {
    if (!rawSources.length) return null;

    const unique = dedupeSources(rawSources);
    const map = new Map<string, RagSource[]>();
    for (const s of unique) {
      const list = map.get(s.kbName) ?? [];
      list.push(s);
      map.set(s.kbName, list);
    }
    return map;
  }, [rawSources]);

  if (!grouped) return null;

  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300 select-none">
        <Library className="size-3" />
        知识来源
      </span>
      {Array.from(grouped.entries()).map(([kbName, docs]) => (
        <span
          key={kbName}
          className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 dark:bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary select-none"
          title={docs.map((d) => `${d.documentName}（${(d.score * 100).toFixed(0)}%）`).join("\n")}
        >
          <FileText className="size-3 opacity-60" />
          {kbName}
          {docs.length > 1 ? <span className="opacity-60">·{docs.length}篇</span> : null}
        </span>
      ))}
    </div>
  );
};
