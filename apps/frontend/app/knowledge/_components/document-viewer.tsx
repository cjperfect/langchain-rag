"use client";

import { FileText } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useShikiHighlighter } from "react-shiki";
import type { ComponentProps, FC } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { DocumentViewerProps } from "@/interfaces/knowledge";

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

    // 行内代码
    if (!match) {
      return (
        <code className="rounded bg-muted px-1.5 py-0.5 text-[13px] font-mono" {...props}>
          {children}
        </code>
      );
    }

    // 代码块
    return <CodeBlock language={match[1]} code={codeStr} />;
  },
  pre({ children }) {
    return <>{children}</>;
  },
};

// ---------------------------------------------------------------------------
// DocumentViewer
// ---------------------------------------------------------------------------

export function DocumentViewer({ content, fileName, loading }: DocumentViewerProps) {
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

  if (content.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
        <FileText className="size-10 mb-3" strokeWidth={1.5} />
        <p className="text-sm">该文档暂无内容</p>
      </div>
    );
  }

  const totalTokens = content.reduce((sum, c) => sum + c.tokenCount, 0);
  const fullText = content.map((c) => c.content).join("\n\n");

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

      {/* 文档正文 — Markdown 渲染 + 语法高亮 */}
      <div className="p-6">
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
          <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {fullText}
          </Markdown>
        </div>
      </div>
    </div>
  );
}
