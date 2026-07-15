import { createOpenAI } from "@ai-sdk/openai";
import { frontendTools } from "@assistant-ui/react-ai-sdk";
import {
  type JSONSchema7,
  streamText,
  convertToModelMessages,
  type UIMessage,
} from "ai";

export async function POST(req: Request) {
  const {
    messages,
    system,
    tools,
  }: {
    messages: UIMessage[];
    system?: string;
    tools?: Record<string, { description?: string; parameters: JSONSchema7 }>;
  } = await req.json();

  const deepseek = createOpenAI({
    baseURL: process.env.DEEPSEEK_API_BASE_URL,
    apiKey: process.env.DEEPSEEK_API_KEY,
  });

  const result = streamText({
    model: deepseek.chat("deepseek-v4-flash"),
    messages: await convertToModelMessages(messages),
    system,
    tools: {
      ...frontendTools(tools ?? {}),
    },
  });

  return result.toUIMessageStreamResponse({
    messageMetadata: ({ part }) => {
      if (part.type === "finish") {
        return {
          usage: part.totalUsage,
        };
      }
      if (part.type === "finish-step") {
        return {
          modelId: part.response.modelId,
        };
      }
      return undefined;
    },
  });
}
