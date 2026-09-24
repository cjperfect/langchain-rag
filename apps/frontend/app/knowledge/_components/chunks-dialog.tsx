"use client";

import { useEffect, useState } from "react";
import { FileText, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getDocumentChunks } from "@/api/knowledge-api";
import type { DocumentChunk } from "@/interfaces/knowledge";

/**
 * 文档切片弹窗：展示当前文档的所有切片（序号 / token 数 / 内容）
 *
 * 切片是 RAG 检索的基本单元，这里按 index 顺序展示全文分片，
 * 便于检查解析质量（切片是否断裂、内容是否完整）与检索命中范围。
 */
export function ChunksDialog({
  open,
  onOpenChange,
  documentId,
  fileName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: number;
  fileName: string;
}) {
  const [chunks, setChunks] = useState<DocumentChunk[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setChunks(null);
    setError(null);
    getDocumentChunks(documentId)
      .then(setChunks)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "加载切片失败"));
  }, [open, documentId]);

  const totalTokens = chunks?.reduce((sum, c) => sum + c.tokenCount, 0) ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] flex-col gap-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="size-4 text-muted-foreground" />
            文档切片：{fileName}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {chunks ? `共 ${chunks.length} 片 · 约 ${totalTokens} tokens` : "加载中..."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {error ? (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <AlertCircle className="size-4" />
              {error}
            </div>
          ) : chunks === null ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-lg border p-3">
                  <Skeleton className="mb-2 h-3 w-24" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="mt-1 h-3 w-4/5" />
                </div>
              ))}
            </div>
          ) : chunks.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">该文档暂无切片</div>
          ) : (
            <div className="space-y-3">
              {chunks.map((chunk) => (
                <div key={chunk.id} className="rounded-lg border bg-muted/20 p-3">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                      切片 #{chunk.index}
                    </span>
                    <span className="text-xs text-muted-foreground">≈ {chunk.tokenCount} tokens</span>
                  </div>
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/85">{chunk.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t px-6 py-3">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
