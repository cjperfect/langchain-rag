import { ComposerPrimitive } from "@assistant-ui/react";
import { unstable_useMentionAdapter } from "@assistant-ui/react";
import { ComposerTriggerPopover } from "@/components/assistant-ui/composer-trigger-popover";
import { HighlightOverlay } from "@/components/assistant-ui/highlight-overlay";
import { atMentionFormatter } from "@/lib/directive-formatter";
import { LibraryIcon } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { getKnowledgeBases } from "@/mock/knowledge-api";
import { knowledgeBaseRegistry } from "@/lib/knowledge-base-registry";
import type { KnowledgeBase } from "@/mock/knowledge-api";

export function ComposerInput() {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    getKnowledgeBases().then((kbs) => {
      setKnowledgeBases(kbs);
      knowledgeBaseRegistry.setAll(kbs);
    });
  }, []);

  // @ 提及配置 — 选择知识库
  const mention = unstable_useMentionAdapter({
    formatter: atMentionFormatter,
    items: knowledgeBases.map((kb) => ({
      id: String(kb.id),
      type: "knowledge-base",
      label: kb.name,
      description: kb.description,
      metadata: { icon: "Library", documentCount: kb.documentCount },
    })),
  });

  // 2. 渲染UI
  return (
    <ComposerPrimitive.Unstable_TriggerPopoverRoot>
      <div className="relative">
        <HighlightOverlay textareaRef={textareaRef} formatter={atMentionFormatter} />
        <ComposerPrimitive.Input
          ref={textareaRef}
          placeholder="发送消息，输入@选择知识库"
          className="aui-composer-input text-transparent caret-primary placeholder:text-muted-foreground/80 max-h-32 min-h-10 w-full resize-none bg-transparent px-2.5 py-1 text-base outline-none"
          rows={1}
          autoFocus
          enterKeyHint="send"
          aria-label="消息输入框"
        />
      </div>

      <ComposerTriggerPopover
        char="@"
        {...mention}
        emptyItemsLabel="暂无知识库"
        fallbackIcon={LibraryIcon}
        iconMap={{ Library: LibraryIcon }}
      />
    </ComposerPrimitive.Unstable_TriggerPopoverRoot>
  );
}
