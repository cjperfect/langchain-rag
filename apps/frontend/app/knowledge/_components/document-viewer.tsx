"use client";

import { FileText, Pencil, Save, X, Bold, Italic, Strikethrough, Code, Quote, List, ListOrdered, Heading1, Heading2, Heading3, CodeXml, Minus, Undo2, Redo2, Underline, Link, ListChecks, Highlighter, RemoveFormatting } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { useShikiHighlighter } from "react-shiki";
import { useState, useCallback, useRef, type ComponentProps, type FC } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TipTapUnderline from "@tiptap/extension-underline";
import TipTapLink from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Highlight from "@tiptap/extension-highlight";
import TurndownService from "turndown";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { updateDocument } from "@/api/knowledge-api";
import type { DocumentViewerProps } from "@/interfaces/knowledge";

// ---------------------------------------------------------------------------
// Turndown — HTML → Markdown
// ---------------------------------------------------------------------------

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

// 保留 <u> 下划线为 HTML（Markdown 无对应语法）
turndownService.addRule("underline", {
  filter: (node) => node.nodeName === "U" || (node as HTMLElement).style?.textDecoration === "underline",
  replacement: (content) => `<u>${content}</u>`,
});

// 保留 <mark> 高亮为 HTML（Markdown 无对应语法）
turndownService.addRule("mark", {
  filter: (node) => node.nodeName === "MARK",
  replacement: (content) => `<mark>${content}</mark>`,
});

// 任务列表 → GFM 语法: - [ ] / - [x]
turndownService.addRule("taskList", {
  filter: (node) =>
    node.nodeName === "LI" && node.getAttribute("data-type") === "taskItem",
  replacement: (content, _node) => {
    const checked = (_node as HTMLElement).getAttribute("data-checked") === "true";
    return `- [${checked ? "x" : " "}] ${content}\n`;
  },
});

function htmlToMd(html: string): string {
  return turndownService.turndown(html);
}

// ---------------------------------------------------------------------------
// 代码块语法高亮
// ---------------------------------------------------------------------------

const CodeBlock: FC<{ language?: string; code: string }> = ({ language, code }) => {
  const highlighted = useShikiHighlighter(code, language, {
    dark: "github-dark-default",
    light: "github-light-default",
  }, { defaultColor: "light-dark()" });

  return highlighted ?? (
    <pre className="overflow-x-auto rounded-xl border bg-muted/30 p-3.5 text-[13px] leading-relaxed">
      <code>{code}</code>
    </pre>
  );
};

// ---------------------------------------------------------------------------
// react-markdown 组件映射
// ---------------------------------------------------------------------------

const markdownComponents: ComponentProps<typeof Markdown>["components"] = {
  code({ className, children, node: _node, ...props }) {
    const match = /language-(\w+)/.exec(className ?? "");
    const codeStr = String(children).replace(/\n$/, "");

    if (!match) {
      return (
        <code className="rounded bg-muted px-1.5 py-0.5 text-[13px] font-mono" {...props}>
          {children}
        </code>
      );
    }

    return <CodeBlock language={match[1]} code={codeStr} />;
  },
  pre({ children }) {
    return <>{children}</>;
  },
};

// ---------------------------------------------------------------------------
// 工具栏按钮类型
// ---------------------------------------------------------------------------

interface ToolbarButton {
  label: string;
  icon: FC<{ className?: string }>;
  action: () => void;
  isActive: () => boolean;
}

// ---------------------------------------------------------------------------
// DocumentViewer
// ---------------------------------------------------------------------------

export function DocumentViewer({ content, fileName, loading, knowledgeBaseId, documentId, onSaved }: DocumentViewerProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const initializedRef = useRef(false);
  const fullText = content ?? "";

  const canEdit = knowledgeBaseId != null && documentId != null;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      }),
      Placeholder.configure({
        placeholder: "编辑文档内容（支持 Markdown 快捷键）...",
      }),
      TipTapUnderline,
      TipTapLink.configure({ openOnClick: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
    ],
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none min-h-[60vh] px-6 py-4 rounded-b-md border border-input border-t-0 bg-background focus:outline-none " +
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

  // 工具栏按钮
  const toolbarButtons: ToolbarButton[] = editor
    ? [
        { label: "撤销", icon: Undo2, action: () => editor.chain().focus().undo().run(), isActive: () => false },
        { label: "重做", icon: Redo2, action: () => editor.chain().focus().redo().run(), isActive: () => false },
        { label: "标题1", icon: Heading1, action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), isActive: () => editor.isActive("heading", { level: 1 }) },
        { label: "标题2", icon: Heading2, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), isActive: () => editor.isActive("heading", { level: 2 }) },
        { label: "标题3", icon: Heading3, action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), isActive: () => editor.isActive("heading", { level: 3 }) },
        { label: "加粗", icon: Bold, action: () => editor.chain().focus().toggleBold().run(), isActive: () => editor.isActive("bold") },
        { label: "斜体", icon: Italic, action: () => editor.chain().focus().toggleItalic().run(), isActive: () => editor.isActive("italic") },
        { label: "下划线", icon: Underline, action: () => editor.chain().focus().toggleUnderline().run(), isActive: () => editor.isActive("underline") },
        { label: "删除线", icon: Strikethrough, action: () => editor.chain().focus().toggleStrike().run(), isActive: () => editor.isActive("strike") },
        { label: "高亮", icon: Highlighter, action: () => editor.chain().focus().toggleHighlight().run(), isActive: () => editor.isActive("highlight") },
        { label: "行内代码", icon: Code, action: () => editor.chain().focus().toggleCode().run(), isActive: () => editor.isActive("code") },
        { label: "链接", icon: Link, action: () => {
          const url = window.prompt("输入链接 URL");
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }, isActive: () => editor.isActive("link") },
        { label: "代码块", icon: CodeXml, action: () => editor.chain().focus().toggleCodeBlock().run(), isActive: () => editor.isActive("codeBlock") },
        { label: "引用", icon: Quote, action: () => editor.chain().focus().toggleBlockquote().run(), isActive: () => editor.isActive("blockquote") },
        { label: "无序列表", icon: List, action: () => editor.chain().focus().toggleBulletList().run(), isActive: () => editor.isActive("bulletList") },
        { label: "有序列表", icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run(), isActive: () => editor.isActive("orderedList") },
        { label: "任务列表", icon: ListChecks, action: () => editor.chain().focus().toggleTaskList().run(), isActive: () => editor.isActive("taskList") },
        { label: "分割线", icon: Minus, action: () => editor.chain().focus().setHorizontalRule().run(), isActive: () => false },
        { label: "清除格式", icon: RemoveFormatting, action: () => editor.chain().focus().clearNodes().unsetAllMarks().run(), isActive: () => false },
      ]
    : [];

  // 进入 / 退出编辑模式
  const startEdit = useCallback(() => {
    if (!editor) return;
    initializedRef.current = false;
    editor.commands.setContent(`<p>${fullText.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")}</p>`);
    requestAnimationFrame(() => {
      initializedRef.current = true;
    });
    setEditing(true);
  }, [editor, fullText]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!canEdit || saving || !editor) return;
    setSaving(true);
    try {
      const html = editor.getHTML();
      const md = htmlToMd(html);
      await updateDocument(knowledgeBaseId!, documentId!, { content: md });
      setEditing(false);
      onSaved?.();
    } catch {
      // 保存失败保持编辑状态
    } finally {
      setSaving(false);
    }
  }, [canEdit, saving, editor, knowledgeBaseId, documentId, onSaved]);

  // 空状态
  if (!fileName) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
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

  if (!fullText && !editing) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
        <FileText className="size-10 mb-3" strokeWidth={1.5} />
        <p className="text-sm">该文档暂无内容</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* 头部 */}
      <div className="sticky top-0 z-10 shrink-0 bg-background border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-muted-foreground" />
          <h2 className="flex-1 text-sm font-semibold">{fileName}</h2>
          {!editing && (
            <>
              {canEdit && (
                <Button variant="ghost" size="icon" className="size-7" onClick={startEdit} title="编辑">
                  <Pencil className="size-3.5" />
                </Button>
              )}
            </>
          )}
          {editing && (
            <>
              <Button variant="ghost" size="icon" className="size-7" onClick={cancelEdit} title="取消">
                <X className="size-3.5" />
              </Button>
              <Button variant="default" size="sm" className="h-7 gap-1.5 text-xs" onClick={handleSave} disabled={saving}>
                <Save className="size-3" />
                {saving ? "保存中..." : "保存"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 正文区域 */}
      {editing ? (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* 富文本工具栏 */}
          <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-b bg-muted/10 px-4 py-1.5">
            {toolbarButtons.map((btn, i) => (
              <span key={btn.label} className="contents">
                {i > 0 && ["标题1", "加粗", "行内代码", "代码块", "无序列表"].includes(btn.label) && (
                  <span className="mx-1 h-4 w-px bg-border" />
                )}
                <Button
                  variant={btn.isActive() ? "secondary" : "ghost"}
                  size="icon"
                  className="size-7"
                  onClick={btn.action}
                  title={btn.label}
                >
                  <btn.icon className="size-3.5" />
                </Button>
              </span>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto [&_.ProseMirror]:min-h-[60vh] [&_.ProseMirror]:outline-none">
            <EditorContent editor={editor} className="h-full" />
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="prose prose-sm dark:prose-invert max-w-none
            prose-headings:text-foreground
            prose-p:text-foreground/85 prose-p:leading-relaxed
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            prose-strong:text-foreground
            prose-code:text-foreground
            prose-ol:text-foreground/85 prose-ul:text-foreground/85
            prose-table:border prose-table:border-border
            prose-th:bg-muted prose-th:px-3 prose-th:py-2
            prose-td:px-3 prose-td:py-2 prose-td:border-b prose-td:border-border
            prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground
            prose-img:rounded-xl"
          >
            <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={markdownComponents}>
              {fullText}
            </Markdown>
          </div>
        </div>
      )}
    </div>
  );
}
