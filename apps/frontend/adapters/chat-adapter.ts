import { ChatModelAdapter } from "@assistant-ui/react";
import { post } from "@/lib/api";
import { getConversationId } from "./remote-thread-list-adapter";
import { knowledgeBaseRegistry } from "@/lib/knowledge-base-registry";
import { atMentionFormatter } from "@/lib/directive-formatter";

async function* streamChat(body: Record<string, unknown>) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No reader available");

  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let fullReasoning = "";
  const toolParts: any[] = [];

  const buildParts = (): any[] => {
    const parts: any[] = [];
    if (fullReasoning) parts.push({ type: "reasoning", text: fullReasoning });
    if (fullText) parts.push({ type: "text", text: fullText });
    parts.push(...toolParts);
    return parts;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() || "";

    for (const block of blocks) {
      let eventType = "message";
      let dataStr = "";

      for (const line of block.split("\n")) {
        if (line.startsWith("event: ")) eventType = line.slice(7).trim();
        else if (line.startsWith("data: ")) dataStr = line.slice(6);
      }

      if (!dataStr) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = JSON.parse(dataStr) as any;

      switch (eventType) {
        case "error":
          throw new Error(d.error ?? "未知错误");
        case "reasoning":
          if (d.content) {
            fullReasoning += d.content;
            yield { content: buildParts() };
          }
          break;
        case "tool_start":
          toolParts.push({
            type: "tool-call",
            toolCallId: `tool_${toolParts.length}`,
            toolName: d.toolName ?? "unknown",
            args: {},
            argsText: "",
          });
          yield { content: buildParts() };
          break;
        case "tool_end": {
          const last = toolParts[toolParts.length - 1];
          if (last) last.result = d.result;
          yield { content: buildParts() };
          break;
        }
        case "message":
          if (d.content) {
            fullText += d.content;
            yield { content: buildParts() };
          }
          break;
        case "done":
          yield {
            content: buildParts(),
            metadata: {
              custom: {
                request_message_id: d.request_message_id,
                response_message_id: d.response_message_id,
              },
            },
          };
          break;
      }
    }
  }
}

let lastResponseMessageId: number | null = null;

export const chatAdapter: ChatModelAdapter = {
  async *run({ messages, context, unstable_threadId }) {
    const lastMessage = messages[messages.length - 1];
    const userMessage =
      lastMessage?.content
        ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("\n") ?? "";

    let parentMessageId = lastResponseMessageId;
    if (!parentMessageId) {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "assistant") {
          parentMessageId = parseInt(messages[i].id, 10) || null;
          break;
        }
      }
    }

    const conversationId = getConversationId(unstable_threadId);

    // Extract @mention labels and look up their KB IDs
    const mentions = atMentionFormatter
      .parse(userMessage)
      .filter((seg) => seg.kind === "mention")
      .map((seg) => seg.label);
    const kbIds = knowledgeBaseRegistry.getIds(mentions);

    const body: Record<string, unknown> = { prompt: userMessage };
    if (conversationId) body.chat_session_id = conversationId;
    if (parentMessageId) body.parent_message_id = parentMessageId;
    if (kbIds.length > 0) body.knowledge_ids = kbIds;
    if (context.config?.modelName) body.model = context.config.modelName;

    for await (const chunk of streamChat(body)) {
      if (chunk.metadata?.custom?.response_message_id) {
        lastResponseMessageId = chunk.metadata.custom.response_message_id;
      }
      yield chunk;
    }
  },
};

export function createKnowledgeChatAdapter(knowledgeBaseId: number, knowledgeBaseName: string): ChatModelAdapter {
  let conversationId: number | null = null;
  let initPromise: Promise<void> | null = null;

  const ensureConversation = async () => {
    if (conversationId) return;
    if (initPromise) {
      await initPromise;
      return;
    }
    initPromise = (async () => {
      const conv = await post<{ id: number }>("/conversations", {
        title: `知识库 - ${knowledgeBaseName}`,
      });
      conversationId = conv.id;
    })();
    await initPromise;
  };

  return {
    async *run({ messages, context }) {
      await ensureConversation();

      const lastMessage = messages[messages.length - 1];
      const userMessage =
        lastMessage?.content
          ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text)
          .join("\n") ?? "";

      const body: Record<string, unknown> = {
        prompt: userMessage,
        chat_session_id: conversationId,
        knowledge_id: knowledgeBaseId,
      };
      if (context.config?.modelName) body.model = context.config.modelName;

      yield* streamChat(body);
    },
  };
}
