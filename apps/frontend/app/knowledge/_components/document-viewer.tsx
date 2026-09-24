"use client";

import { FileText, Pencil, Save, X, List } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { useShikiHighlighter } from "react-shiki";
import { useState, useCallback, useRef, type ComponentProps, type FC } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RichTextEditor, htmlToMd } from "@/components/rich-text-editor";
import { updateDocument } from "@/api/knowledge-api";
import { ChunksDialog } from "./chunks-dialog";
import { TaskProgressPanel } from "./task-progress";
import type { DocumentViewerProps } from "@/interfaces/knowledge";

// ---------------------------------------------------------------------------
// 代码块语法高亮
// ---------------------------------------------------------------------------

const CodeBlock: FC<{ language?: string; code: string }> = ({ language, code }) => {
  const highlighted = useShikiHighlighter(
    code,
    language,
    {
      dark: "github-dark-default",
      light: "github-light-default",
    },
    { defaultColor: "light-dark()" },
  );

  return (
    highlighted ?? (
      <pre className="overflow-x-auto rounded-xl border bg-muted/30 p-3.5 text-[13px] leading-relaxed">
        <code>{code}</code>
      </pre>
    )
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
// DocumentViewer
// ---------------------------------------------------------------------------

export function DocumentViewer({ content, fileName, loading, knowledgeBaseId, documentId, onSaved }: DocumentViewerProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [chunksOpen, setChunksOpen] = useState(false);
  // 保存后的重建索引进度（SSE 事件驱动；更新场景步骤：重建索引 → 切片 → 向量化）
  const [progressActive, setProgressActive] = useState(false);
  const [fallbackDone, setFallbackDone] = useState(false);
  const [fallbackError, setFallbackError] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const editorRef = useRef<ReturnType<typeof import("@tiptap/react").useEditor>>(null);

  // 解析产物多为「一行一换行」的行式文本（pdf-parse 逐行输出 / OCR 版面重组）。
  // CommonMark 会把单个换行折叠成空格、只有空行才分段 —— 直接喂给 react-markdown
  // 会导致预览时段落全部挤在一起。渲染前把单个换行提升为空行（段落分隔）：
  //   \n   → \n\n（单换行升级为分段）
  //   \n\n → \n\n（已有空行保持不变，避免重复分段）
  const fullText = (content ?? "").replace(/\n{1,2}/g, "\n\n");

  const canEdit = knowledgeBaseId != null && documentId != null;

  const startEdit = useCallback(() => {
    setEditing(true);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditing(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!canEdit || saving) return;
    setSaving(true);
    setResetKey((k) => k + 1);
    setProgressActive(true);
    setFallbackDone(false);
    setFallbackError(null);
    try {
      const md = editorRef.current?.getMarkdown?.() ?? htmlToMd(editorRef.current?.getHTML?.() ?? "");
      await updateDocument(documentId!, { content: md });
      // HTTP 成功即重建成功：SSE 无事件时用它兜底；留一点时间让事件渲染
      setFallbackDone(true);
      setTimeout(() => {
        setEditing(false);
        setProgressActive(false);
        setSaving(false);
        onSaved?.();
      }, 600);
    } catch (e) {
      // 失败保持编辑状态可重试；SSE failed 的具体原因优先
      setFallbackError(e instanceof Error ? e.message : "保存失败，请重试");
      setProgressActive(false);
      setSaving(false);
    }
  }, [canEdit, saving, documentId, onSaved]);

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
          {!editing && canEdit && (
            <>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setChunksOpen(true)} title="查看切片">
                <List className="size-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="size-7" onClick={startEdit} title="编辑">
                <Pencil className="size-3.5" />
              </Button>
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
        progressActive ? (
          <div className="flex-1 overflow-y-auto p-6">
            <TaskProgressPanel
              enabled={progressActive}
              active={progressActive}
              labels={["重建索引", "切片", "向量化", "完成"]}
              fallbackDone={fallbackDone}
              fallbackError={fallbackError}
              resetKey={resetKey}
              onCompleted={() => {
                setEditing(false);
                setProgressActive(false);
                setSaving(false);
                onSaved?.();
              }}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            <RichTextEditor initialContent={fullText} placeholder="编辑文档内容（支持 Markdown 快捷键）..." minHeight="60vh" editorRef={editorRef} />
          </div>
        )
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          <div
            className="prose prose-sm dark:prose-invert max-w-none
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
      {/* 文档切片弹窗：展示该文档所有 chunk（Dialog 走 portal，放容器内即可） */}
      {canEdit && (
        <ChunksDialog
          open={chunksOpen}
          onOpenChange={setChunksOpen}
          documentId={documentId!}
          fileName={fileName}
        />
      )}
    </div>
  );
}
