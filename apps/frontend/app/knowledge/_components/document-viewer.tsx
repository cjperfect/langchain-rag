"use client";

import { FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { DocumentViewerProps } from "@/interfaces/knowledge";

export function DocumentViewer({ chunks, fileName, loading }: DocumentViewerProps) {
  if (!fileName) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <FileText className="size-12" strokeWidth={1} />
        <div className="text-center">
          <p className="text-sm">选择左侧文档查看内容</p>
          <p className="text-xs mt-1">点击文档即可预览全文</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (chunks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <FileText className="size-10 mb-3" strokeWidth={1.5} />
        <p className="text-sm">该文档暂无内容</p>
      </div>
    );
  }

  const totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);

  return (
    <div className="h-full overflow-y-auto">
      {/* 文档头部 */}
      <div className="sticky top-0 z-10 bg-background border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">{fileName}</h2>
          <span className="text-xs text-muted-foreground">
            · {totalTokens} tokens
          </span>
        </div>
      </div>

      {/* 文档正文 */}
      <div className="p-6">
        <article className="text-sm leading-relaxed">
          {chunks.map((chunk) => (
            <div key={chunk.id} className="whitespace-pre-wrap mb-4 last:mb-0">
              {chunk.content}
            </div>
          ))}
        </article>
      </div>
    </div>
  );
}
