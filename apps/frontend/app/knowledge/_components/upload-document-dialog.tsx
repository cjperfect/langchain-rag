"use client";

import { useState, useRef, type DragEvent } from "react";
import { Loader2, Upload, File, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (file: File) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UploadDocumentDialog({ open, onOpenChange, onUpload }: UploadDocumentDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setDragging(false);
    setError("");
  };

  const handleFile = (f: File | null) => {
    setError("");
    if (!f) return;
    setFile(f);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async () => {
    if (!file) {
      setError("请先选择文件");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await onUpload(file);
      reset();
      onOpenChange(false);
    } catch {
      setError("上传失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) reset();
        onOpenChange(open);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>上传文档</DialogTitle>
          <DialogDescription>
            支持 PDF、Markdown、Word、TXT、CSV、代码文件等格式，单个文件最大 50MB
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {file ? (
            /* 已选择文件 */
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <File className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(0)} KB
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                title="移除文件"
                onClick={() => setFile(null)}
                disabled={loading}
              >
                <X className="size-4" />
              </Button>
            </div>
          ) : (
            /* 拖拽上传区域 */
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 transition-colors ${
                dragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/50 hover:bg-muted/20"
              }`}
            >
              <Upload className="size-10 text-muted-foreground" strokeWidth={1.5} />
              <div className="text-center">
                <p className="text-sm font-medium">拖拽文件到此处或点击选择</p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF · MD · DOCX · TXT · CSV · 代码文件
                </p>
              </div>
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                accept=".pdf,.md,.docx,.txt,.csv,.ts,.tsx,.js,.jsx,.py,.sql,.json,.yml,.yaml,.pptx"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </div>
          )}
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !file} className="gap-2 ml-2">
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            上传
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
