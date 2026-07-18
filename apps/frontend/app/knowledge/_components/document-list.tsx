"use client";

import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/zh-cn";
import { FileText, File, FileCode, FileJson } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { KnowledgeBaseDocument } from "@/mock/knowledge-api";

dayjs.extend(relativeTime);
dayjs.locale("zh-cn");

interface DocumentListProps {
  documents: KnowledgeBaseDocument[];
  selectedId: number | null;
  onSelect: (doc: KnowledgeBaseDocument) => void;
  loading: boolean;
}

const typeIcons: Record<string, React.ReactNode> = {
  pdf: <File className="size-4 text-red-500" />,
  docx: <File className="size-4 text-blue-500" />,
  md: <FileText className="size-4 text-emerald-500" />,
  txt: <FileText className="size-4 text-muted-foreground" />,
  sql: <FileCode className="size-4 text-purple-500" />,
  ts: <FileCode className="size-4 text-cyan-500" />,
  tsx: <FileCode className="size-4 text-cyan-500" />,
  js: <FileJson className="size-4 text-amber-500" />,
  py: <FileCode className="size-4 text-blue-400" />,
  pptx: <File className="size-4 text-orange-500" />,
};

const typeColors: Record<string, string> = {
  pdf: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
  docx: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  md: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  txt: "bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  sql: "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
  ts: "bg-cyan-50 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400",
  tsx: "bg-cyan-50 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400",
  js: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
  py: "bg-blue-50 text-blue-500 dark:bg-blue-950 dark:text-blue-400",
  pptx: "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentList({ documents, selectedId, onSelect, loading }: DocumentListProps) {
  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg p-3">
            <Skeleton className="size-8 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <FileText className="size-10 mb-3" strokeWidth={1.5} />
        <p className="text-sm">暂无文档</p>
        <p className="text-xs mt-1">上传文档后即可查看</p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {documents.map((doc) => (
        <div
          key={doc.id}
          role="button"
          tabIndex={0}
          onClick={() => onSelect(doc)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(doc);
            }
          }}
          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 cursor-pointer ${
            selectedId === doc.id ? "bg-muted border-l-3 border-l-primary" : "border-l-2 border-transparent"
          }`}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
            {typeIcons[doc.fileType] ?? <FileText className="size-4 text-muted-foreground" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{doc.fileName}</p>
            <p className="text-xs text-muted-foreground">
              {formatSize(doc.fileSize)} · {doc.chunkCount} 切片 · {dayjs(doc.createdAt).format("MM/DD")}
            </p>
          </div>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded uppercase shrink-0 ${
              typeColors[doc.fileType] ?? "bg-muted text-muted-foreground"
            }`}
          >
            {doc.fileType}
          </span>
        </div>
      ))}
    </div>
  );
}
