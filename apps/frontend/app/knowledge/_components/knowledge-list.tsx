"use client";

import { Library, Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { KnowledgeBase } from "@/mock/knowledge-api";

interface KnowledgeListProps {
  items: KnowledgeBase[];
  selectedId: number | null;
  loading: boolean;
  onSelect: (id: number) => void;
  onCreateClick: () => void;
  onEdit: (kb: KnowledgeBase) => void;
  onDelete: (kb: KnowledgeBase) => void;
}

export function KnowledgeList({
  items,
  selectedId,
  loading,
  onSelect,
  onCreateClick,
  onEdit,
  onDelete,
}: KnowledgeListProps) {
  return (
    <div className="flex h-full flex-col bg-background border-r">
      {/* 顶栏 */}
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
        <span className="text-xs font-medium text-muted-foreground">
          {loading ? <Skeleton className="h-3 w-12" /> : `${items.length} 个知识库`}
        </span>
        <Button variant="ghost" size="icon" className="size-7" onClick={onCreateClick}>
          <Plus className="size-4" />
        </Button>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-1 p-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
                <Skeleton className="size-7 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-10" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Library className="size-8 mb-2" strokeWidth={1.5} />
            <p className="text-xs">暂无知识库</p>
          </div>
        ) : (
          <div className="p-2">
            {items.map((kb) => (
              <div
                key={kb.id}
                className={cn(
                  "group flex w-full items-center gap-1 rounded-lg text-left text-sm transition-colors",
                  selectedId === kb.id ? "bg-muted" : "hover:bg-muted/50",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(kb.id)}
                  className={cn(
                    "flex flex-1 items-center gap-3 px-3 py-2.5 cursor-pointer min-w-0",
                    selectedId === kb.id && "font-medium",
                  )}
                >
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Library className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm">{kb.name}</p>
                    <p className="text-xs text-muted-foreground">{kb.documentCount} 个文档</p>
                  </div>
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mr-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-32">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(kb);
                      }}
                    >
                      <Pencil className="size-3.5 mr-2" />
                      编辑
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(kb);
                      }}
                    >
                      <Trash2 className="size-3.5 mr-2" />
                      删除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
