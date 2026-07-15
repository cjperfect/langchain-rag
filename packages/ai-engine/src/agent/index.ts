import { systemPrompt } from "../prompts";
import { activitySqlTool } from "../tools/activity-sql";
import { model } from "./model";
import { createAgent } from "langchain";

const tools = [activitySqlTool];

const messages: any[] = [];

const agent = createAgent({
  model,
  tools,
  systemPrompt: systemPrompt,
});

export async function runAgentStreamEvents(input: string) {
  let fullText = "";

  messages.push({ role: "user", content: input });

  try {
    const stream = await agent.streamEvents({ messages }, { version: "v2" });

    for await (const event of stream) {
      // LLM 输出 token
      if (event.event === "on_chat_model_stream") {
        const content = event.data.chunk.content;

        if (typeof content === "string") {
          fullText += content;
        }
      }

      // Tool 开始执行
      if (event.event === "on_tool_start") {
        console.log("调用工具:", event.name);
      }

      // Tool 执行结束
      if (event.event === "on_tool_end") {
        console.log("工具完成:", event.name);
      }
    }

    return fullText;
  } catch (err) {
    console.error(err);
  }
}

export async function runAgentStream(input: string) {
  let fullText = "";
  messages.push({ role: "user", content: input });

  try {
    const stream = await agent.stream({ messages }, { streamMode: "messages" });
    for await (const [chunk] of stream) {
      fullText += chunk.content;
    }
    return fullText;
  } catch (err) {
    console.log(err);
  }
}

export async function runAgent(input: string) {
  messages.push({ role: "user", content: input });
  const res = await agent.invoke({ messages });
  // 保存 AI 回复
  const lastMessage = res.messages[res.messages.length - 1];
  messages.push(lastMessage);
  return lastMessage.content;
}
