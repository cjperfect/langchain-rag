import { DEFAULT_MODEL } from "@langchain-rag/shared/constants";
import { ChatOpenAI } from "@langchain/openai";

const baseConfig = {
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0.7,
  maxTokens: 1024,
  timeout: 60000,
  configuration: { baseURL: process.env.LLM_BASE_URL },
} as const;

/** 按模型名创建 ChatOpenAI 实例 */
export function createModel(modelName?: string): ChatOpenAI {
  return new ChatOpenAI({
    ...baseConfig,
    model: modelName || DEFAULT_MODEL,
  });
}

/** 默认模型单例 */
export const defaultModel = createModel();
