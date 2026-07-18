"use client";

import { FileText, Hash, Braces } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { DocumentChunk } from "@/mock/knowledge-api";

interface ChunkViewerProps {
  chunks: DocumentChunk[];
  fileName: string | null;
  loading: boolean;
}

export function ChunkViewer({ chunks, fileName, loading }: ChunkViewerProps) {
  if (!fileName) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <Braces className="size-12" strokeWidth={1} />
        <div className="text-center">
          <p className="text-sm">选择左侧文档查看切片</p>
          <p className="text-xs mt-1">每个切片包含文档的一个语义段落</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-5 w-40" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-xl border p-4">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (chunks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <FileText className="size-10 mb-3" strokeWidth={1.5} />
        <p className="text-sm">该文档暂无切片</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="sticky top-0 z-10 bg-background border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">{fileName}</h2>
          <span className="text-xs text-muted-foreground">
            · {chunks.length} 个切片
          </span>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {chunks.map((chunk) => (
          <div
            key={chunk.id}
            className="rounded-xl border bg-card p-4 space-y-3 transition-colors hover:border-primary/20"
          >
            {/* 切片头部 */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Hash className="size-3" />
              <span>切片 {chunk.index}</span>
              <span>·</span>
              <span>{chunk.tokenCount} tokens</span>
            </div>

            {/* 切片内容 */}
            <div className="text-sm leading-relaxed text-card-foreground whitespace-pre-wrap">
              {chunk.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
