"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, Maximize2, Minimize2, X } from "lucide-react";
import {
  Bold, Italic, Strikethrough, Code, List, ListOrdered,
  Heading1, Heading2, Heading3, Quote, Minus, CodeXml,
} from "lucide-react";
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
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { marked } from "marked";
import TurndownService from "turndown";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Markdown ↔ HTML 转换
// ---------------------------------------------------------------------------

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
});

function mdToHtml(markdown: string): string {
  if (!markdown.trim()) return "";
  try {
    return marked.parse(markdown, { async: false }) as string;
  } catch {
    return markdown;
  }
}

function htmlToMd(html: string): string {
  if (!html.trim() || html === "<p></p>") return "";
  try {
    return turndownService.turndown(html);
  } catch {
    return html;
  }
}

// ---------------------------------------------------------------------------
// localStorage key
// ---------------------------------------------------------------------------

const DRAFT_KEY = "kb-create-document-draft";

interface Draft {
  fileName: string;
  content: string; // markdown
}

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return JSON.parse(raw);
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
// 工具栏按钮定义
// ---------------------------------------------------------------------------

interface ToolbarButton {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  isActive: () => boolean;
}

// ---------------------------------------------------------------------------
// 工具栏组件
// ---------------------------------------------------------------------------

function EditorToolbar({ buttons }: { buttons: ToolbarButton[] }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-t-md border border-b-0 border-input bg-muted/40 px-2 py-1.5">
      {buttons.map((btn) => (
        <button
          key={btn.label}
          type="button"
          title={btn.label}
          onClick={btn.action}
          className={cn(
            "inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            btn.isActive() && "bg-muted text-foreground"
          )}
        >
          <btn.icon className="size-4" />
        </button>
      ))}
    </div>
  );
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
  const [content, setContent] = useState(""); // markdown string
  const [fullscreen, setFullscreen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 防止初始化时触发 onUpdate 覆盖 content
  const initializedRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      }),
      Placeholder.configure({
        placeholder: "使用 Markdown 语法或工具栏编写文档内容...",
      }),
    ],
    onUpdate: ({ editor: ed }) => {
      if (!initializedRef.current) return;
      const html = ed.getHTML();
      const md = htmlToMd(html);
      setContent(md);
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none min-h-[200px] px-4 py-3 rounded-b-md border border-input border-t-0 bg-background focus:outline-none " +
          "[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 " +
          "[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-2 " +
          "[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 " +
          "[&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 " +
          "[&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic " +
          "[&_pre]:bg-muted/30 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:border " +
          "[&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm " +
          "[&_pre_code]:bg-transparent [&_pre_code]:p-0 " +
          "[&_hr]:my-4 [&_hr]:border-border " +
          "[&_.ProseMirror-placeholder]:text-muted-foreground [&_.ProseMirror-placeholder]:pointer-events-none",
      },
    },
  });

  // 构建工具栏按钮
  const toolbarButtons: ToolbarButton[] = editor
    ? [
        {
          label: "标题1",
          icon: Heading1,
          action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
          isActive: () => editor.isActive("heading", { level: 1 }),
        },
        {
          label: "标题2",
          icon: Heading2,
          action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
          isActive: () => editor.isActive("heading", { level: 2 }),
        },
        {
          label: "标题3",
          icon: Heading3,
          action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
          isActive: () => editor.isActive("heading", { level: 3 }),
        },
        {
          label: "加粗",
          icon: Bold,
          action: () => editor.chain().focus().toggleBold().run(),
          isActive: () => editor.isActive("bold"),
        },
        {
          label: "斜体",
          icon: Italic,
          action: () => editor.chain().focus().toggleItalic().run(),
          isActive: () => editor.isActive("italic"),
        },
        {
          label: "删除线",
          icon: Strikethrough,
          action: () => editor.chain().focus().toggleStrike().run(),
          isActive: () => editor.isActive("strike"),
        },
        {
          label: "行内代码",
          icon: Code,
          action: () => editor.chain().focus().toggleCode().run(),
          isActive: () => editor.isActive("code"),
        },
        {
          label: "代码块",
          icon: CodeXml,
          action: () => editor.chain().focus().toggleCodeBlock().run(),
          isActive: () => editor.isActive("codeBlock"),
        },
        {
          label: "引用",
          icon: Quote,
          action: () => editor.chain().focus().toggleBlockquote().run(),
          isActive: () => editor.isActive("blockquote"),
        },
        {
          label: "无序列表",
          icon: List,
          action: () => editor.chain().focus().toggleBulletList().run(),
          isActive: () => editor.isActive("bulletList"),
        },
        {
          label: "有序列表",
          icon: ListOrdered,
          action: () => editor.chain().focus().toggleOrderedList().run(),
          isActive: () => editor.isActive("orderedList"),
        },
        {
          label: "分割线",
          icon: Minus,
          action: () => editor.chain().focus().setHorizontalRule().run(),
          isActive: () => false,
        },
      ]
    : [];

  // 打开弹窗时恢复草稿并设置编辑器内容
  useEffect(() => {
    if (open && editor) {
      const draft = loadDraft();
      setFileName(draft.fileName);

      initializedRef.current = false;
      const html = mdToHtml(draft.content);
      editor.commands.setContent(html);
      setContent(draft.content);
      // 延迟开启同步，避免 setContent 触发 onUpdate 覆盖
      requestAnimationFrame(() => {
        initializedRef.current = true;
      });

      setFullscreen(false);
      setError("");
    }
  }, [open, editor]);

  // 清理：关闭弹窗时销毁编辑器状态
  useEffect(() => {
    if (!open && editor) {
      initializedRef.current = false;
      editor.commands.clearContent();
    }
  }, [open, editor]);

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

    // 从编辑器获取最新 markdown
    const md = editor ? htmlToMd(editor.getHTML()) : content;
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

          {/* 编辑器区域 */}
          <div className="flex-1 flex flex-col min-w-0 space-y-1">
            <Label>内容</Label>
            {editor ? <EditorToolbar buttons={toolbarButtons} /> : null}
            <EditorContent editor={editor} className="flex-1 flex flex-col min-h-0" />
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
