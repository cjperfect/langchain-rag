"use client";

import { useMemo, useCallback, useState, type FC } from "react";
import { AssistantRuntimeProvider, useLocalRuntime } from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/thread";
import { createKnowledgeChatAdapter } from "@/adapters/chat-adapter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Library, History, Plus, MessageSquare } from "lucide-react";

// ---------------------------------------------------------------------------
// 会话记录 mock（按知识库 ID 分组）
// ---------------------------------------------------------------------------

interface KbConversation {
  id: string;
  title: string;
  updatedAt: Date;
}

const mockConversations: Record<number, KbConversation[]> = {};

function getOrCreateConversations(kbId: number): KbConversation[] {
  if (!mockConversations[kbId]) {
    mockConversations[kbId] = [
      {
        id: `${kbId}-default`,
        title: "新会话",
        updatedAt: new Date(),
      },
    ];
  }
  return mockConversations[kbId];
}

// ---------------------------------------------------------------------------

interface KnowledgeChatProps {
  knowledgeBaseId: number;
  knowledgeBaseName: string;
}

const KnowledgeChatWelcome: FC<{ kbName: string }> = ({ kbName }) => (
  <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
    <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
      <Library className="size-7" strokeWidth={1.5} />
    </div>
    <div>
      <h2 className="text-lg font-semibold">{kbName}</h2>
      <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
        基于该知识库的内容进行智能问答。AI 会从知识库文档中检索相关信息来回答你的问题。
      </p>
    </div>
  </div>
);

export function KnowledgeChat({ knowledgeBaseId, knowledgeBaseName }: KnowledgeChatProps) {
  const conversations = getOrCreateConversations(knowledgeBaseId);
  const [activeConvId, setActiveConvId] = useState(conversations[0]?.id ?? "");

  const adapter = useMemo(
    () => createKnowledgeChatAdapter(knowledgeBaseId, knowledgeBaseName),
    [knowledgeBaseId, knowledgeBaseName],
  );

  const runtime = useLocalRuntime(adapter);

  const Welcome = useCallback(() => <KnowledgeChatWelcome kbName={knowledgeBaseName} />, [knowledgeBaseName]);

  const components = useMemo(() => ({ Welcome }), [Welcome]);

  const handleNewConversation = () => {
    const newConv: KbConversation = {
      id: `${knowledgeBaseId}-${Date.now()}`,
      title: "新会话",
      updatedAt: new Date(),
    };
    conversations.unshift(newConv);
    setActiveConvId(newConv.id);
  };

  return (
    <AssistantRuntimeProvider key={`${knowledgeBaseId}-${activeConvId}`} runtime={runtime}>
      <div className="flex h-full flex-col bg-background">
        {/* 头部 */}
        <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2.5">
          <Library className="size-4 text-primary" />
          <span className="flex-1 text-sm font-semibold">AI 问答</span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7">
                <History className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-xs font-medium text-muted-foreground">历史会话</span>
                <Button variant="ghost" size="icon" className="size-6" onClick={handleNewConversation}>
                  <Plus className="size-3.5" />
                </Button>
              </div>
              {conversations.map((conv) => (
                <DropdownMenuItem
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  className="flex items-center gap-2"
                >
                  <MessageSquare className="size-3.5 shrink-0" />
                  <span className="flex-1 truncate text-sm">{conv.title}</span>
                  {conv.id === activeConvId && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* 聊天区域 */}
        <div className="flex-1 overflow-hidden">
          <Thread components={components} enableMentions={false} />
        </div>
      </div>
    </AssistantRuntimeProvider>
  );
}
