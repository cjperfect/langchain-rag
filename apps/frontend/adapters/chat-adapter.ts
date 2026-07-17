import { ChatModelAdapter } from "@assistant-ui/react";
import { getConversationId } from "./remote-thread-list-adapter";

// SSE done 事件中返回的 response_message_id，作为下次请求的 parent
let lastResponseMessageId: number | null = null;

export const chatAdapter: ChatModelAdapter = {
  async *run({ messages, unstable_threadId, context }) {
    const lastMessage = messages[messages.length - 1];
    const userContent = lastMessage?.content ?? [];
    const userMessage = userContent
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("\n\n");

    // parent_message_id：优先用 SSE 缓存的（当前会话），
    // 否则从已加载的历史消息中取最后一条 assistant 的 id（旧会话，HistoryProvider 写入的后端 ID）
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

    const body: Record<string, unknown> = { prompt: userMessage };
    if (conversationId) {
      body.chat_session_id = conversationId;
    }
    if (parentMessageId) {
      body.parent_message_id = parentMessageId;
    }
    if (context.config?.modelName) {
      body.model = context.config.modelName;
    }

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error("No reader available");
    }

    let buffer = "";
    let fullText = "";
    let fullReasoning = "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolParts: Record<string, any>[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buildContent = (text: string, reasoning: string, tools: Record<string, any>[]): any[] => {
      const parts: any[] = [];
      if (reasoning) parts.push({ type: "reasoning", text: reasoning } as any);
      if (text) parts.push({ type: "text", text } as any);
      parts.push(...tools);
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
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            dataStr = line.slice(6);
          }
        }

        if (!dataStr) continue;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let sseData: Record<string, any>;
        try {
          sseData = JSON.parse(dataStr);
        } catch {
          continue;
        }

        switch (eventType) {
          case "error":
            throw new Error(sseData.error ?? "未知错误");

          case "reasoning":
            if (sseData.content) {
              fullReasoning += sseData.content;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              yield { content: buildContent(fullText, fullReasoning, toolParts) } as any;
            }
            break;

          case "tool_start":
            toolParts.push({
              type: "tool-call",
              toolCallId: `tool_${toolParts.length}`,
              toolName: sseData.toolName ?? "unknown",
              args: {},
              argsText: "",
            } as any);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            yield { content: buildContent(fullText, fullReasoning, toolParts) } as any;
            break;

          case "tool_end": {
            const lastTool = toolParts[toolParts.length - 1];
            if (lastTool) lastTool.result = sseData.result;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            yield { content: buildContent(fullText, fullReasoning, toolParts) } as any;
            break;
          }

          case "message":
            if (sseData.content) {
              fullText += sseData.content;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              yield { content: buildContent(fullText, fullReasoning, toolParts) } as any;
            }
            break;

          case "done":
            if (sseData.response_message_id) {
              lastResponseMessageId = sseData.response_message_id;
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            yield {
              content: buildContent(fullText, fullReasoning, toolParts),
              metadata: {
                custom: {
                  request_message_id: sseData.request_message_id,
                  response_message_id: sseData.response_message_id,
                },
              },
            } as any;
            break;
        }
      }
    }
  },
};
