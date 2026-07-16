import { ChatModelAdapter } from "@assistant-ui/react";

export const chatAdapter: ChatModelAdapter = {
  async *run({ messages }) {
    const lastMessage = messages[messages.length - 1];
    // content 是 part 对象数组，需提取 text 类型的文本
    const userContent = lastMessage?.content ?? [];
    const userMessage = userContent
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("\n\n");

    const response = await fetch("http://localhost:3001/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: userMessage }),
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
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || !trimmedLine.startsWith("data: ")) continue;

        const dataStr = trimmedLine.slice(6);

        if (dataStr === "[DONE]") {
          return;
        }

        try {
          const parsed = JSON.parse(dataStr);

          // 后端 SSE 每个 chunk 是 JSON-stringified string
          // 例如: data: "hello"\n\n → parsed 就是字符串 "hello"
          const text =
            typeof parsed === "string"
              ? parsed
              : parsed.content || parsed.text || parsed.message || JSON.stringify(parsed);

          fullText += text;

          yield {
            content: [{ type: "text", text: fullText }],
          };
        } catch {
          console.warn("Failed to parse SSE data:", dataStr);
        }
      }
    }
  },
};
