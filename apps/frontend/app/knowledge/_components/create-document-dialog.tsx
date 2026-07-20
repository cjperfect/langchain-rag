"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, Maximize2, Minimize2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor, htmlToMd } from "@/components/rich-text-editor";

// ---------------------------------------------------------------------------
// localStorage key
// ---------------------------------------------------------------------------

const DRAFT_KEY = "kb-create-document-draft";

interface Draft {
  fileName: string;
  content: string;
}

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return JSON.parse(raw) as Draft;
  } catch {
    /* 忽略解析错误 */
  }
  return { fileName: "", content: "" };
}

function saveDraft(draft: Draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* 忽略存储满等异常 */
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* 忽略 */
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CreateDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { fileName: string; content: string }) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreateDocumentDialog({ open, onOpenChange, onSubmit }: CreateDocumentDialogProps) {
  const [fileName, setFileName] = useState("");
  const [content, setContent] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const editorRef = useRef<ReturnType<typeof import("@tiptap/react").useEditor>>(null);

  // 打开弹窗时恢复草稿
  useEffect(() => {
    if (open) {
      const draft = loadDraft();
      setFileName(draft.fileName);
      setContent(draft.content);
      setFullscreen(false);
      setError("");
    }
  }, [open]);

  // 清理：关闭弹窗时
  useEffect(() => {
    if (!open) {
      setContent("");
    }
  }, [open]);

  // 实时保存草稿（防抖 500ms）
  const saveDraftDebounced = useCallback(() => {
    saveDraft({ fileName, content });
  }, [fileName, content]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(saveDraftDebounced, 500);
    return () => clearTimeout(timer);
  }, [fileName, content, open, saveDraftDebounced]);

  const reset = () => {
    clearDraft();
    setFileName("");
    setContent("");
    setFullscreen(false);
    setError("");
  };

  const handleSubmit = async () => {
    const trimmedName = fileName.trim();
    if (!trimmedName) {
      setError("请输入文件名");
      return;
    }

    const md = editorRef.current?.getMarkdown?.() ?? htmlToMd(editorRef.current?.getHTML?.() ?? "") ?? content;
    if (!md.trim()) {
      setError("请输入文档内容");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await onSubmit({ fileName: trimmedName, content: md.trim() });
      reset();
      onOpenChange(false);
    } catch {
      setError("保存失败，请重试");
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
      <DialogContent
        showCloseButton={false}
        className={`flex flex-col transition-all duration-200 ${
          fullscreen
            ? "max-w-none! w-[98dvw]! h-[98dvh]! rounded-xl!"
            : "sm:max-w-3xl max-h-[85dvh]"
        }`}
      >
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle>新建文档</DialogTitle>
              <DialogDescription>使用富文本编辑器编写 Markdown 文档</DialogDescription>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                title={fullscreen ? "退出全屏" : "全屏"}
                onClick={() => setFullscreen(!fullscreen)}
                type="button"
              >
                {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                title="关闭"
                onClick={() => onOpenChange(false)}
                type="button"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto py-2">
          <div className="space-y-2">
            <Label htmlFor="doc-name">文件名</Label>
            <Input
              id="doc-name"
              placeholder="例如：产品需求文档.md"
              value={fileName}
              onChange={(e) => {
                setFileName(e.target.value);
                if (error) setError("");
              }}
              disabled={loading}
              maxLength={200}
            />
          </div>

          <div className="flex-1 flex flex-col min-w-0 space-y-1">
            <Label>内容</Label>
            <RichTextEditor
              initialContent={content}
              placeholder="使用 Markdown 语法或工具栏编写文档内容..."
              minHeight="200px"
              onContentChange={setContent}
              editorRef={editorRef}
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="gap-2 ml-2">
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
