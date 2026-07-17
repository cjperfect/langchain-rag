import { ChatModelAdapter } from "@assistant-ui/react";
import { getConversationId, registerThreadConversation } from "./remote-thread-list-adapter";

export const chatAdapter: ChatModelAdapter = {
  async *run({ messages, unstable_threadId }) {
    const lastMessage = messages[messages.length - 1];
    const userContent = lastMessage?.content ?? [];
    const userMessage = userContent
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("\n\n");

    // 查找当前线程对应的后端会话 ID
    const conversationId = unstable_threadId ? getConversationId(unstable_threadId) : null;

    const body: Record<string, unknown> = { prompt: userMessage };
    if (conversationId) {
      body.chat_session_id = conversationId;
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

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() || "";

      for (const block of blocks) {
        let eventType = "message"; // SSE 规范：缺省事件类型为 message
        let dataStr = "";

        for (const line of block.split("\n")) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            dataStr = line.slice(6);
          }
        }

        if (!dataStr) continue;

        let data: {
          session_id?: number;
          content?: string;
          error?: string;
          request_message_id?: number;
          response_message_id?: number;
        };
        try {
          data = JSON.parse(dataStr);
        } catch {
          continue;
        }

        switch (eventType) {
          case "session":
            // 后端返回的会话 ID：注册到当前线程的映射中（用于后续的多轮对话）
            if (data.session_id && unstable_threadId) {
              registerThreadConversation(unstable_threadId, data.session_id);
            }
            break;

          case "error":
            throw new Error(data.error ?? "未知错误");

          case "message":
            if (data.content) {
              fullText += data.content;
              yield { content: [{ type: "text", text: fullText }] };
            }
            break;

          case "done":
            yield {
              content: [{ type: "text", text: fullText }],
              metadata: {
                custom: {
                  request_message_id: data.request_message_id,
                  response_message_id: data.response_message_id,
                },
              },
            };
            break;
        }
      }
    }
  },
};
