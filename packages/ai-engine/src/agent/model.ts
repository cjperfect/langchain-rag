import { ChatOllama } from "@langchain/ollama";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { DEFAULT_MODEL } from "@langchain-rag/shared/constants";
import { ChatOpenAI } from "@langchain/openai";

const baseConfig = {
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0.7,
  maxTokens: 1024,
  timeout: 60000,
  configuration: { baseURL: process.env.LLM_BASE_URL },
} as const;

/** 本地 Ollama 问答模型。qwen3.5 系列默认思考模式会把全部 token 预算吃光、返回空 content，
 *  必须 think:false 关掉才能直接出答案。 */
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen3.5:0.8b";

/**
 * 按模型名创建对话模型：
 *   - LLM_PROVIDER=ollama → ChatOllama（原生 /api/chat，think:false，本地跑 qwen3.5）
 *   - 否则 → ChatOpenAI（OpenAI 兼容接口，如 DeepSeek / 火山方舟）
 */
export function createModel(modelName?: string): BaseChatModel {
  if (process.env.LLM_PROVIDER === "ollama") {
    // 前端传的默认模型名（deepseek-v4-flash）在本地不存在，落到 OLLAMA_MODEL
    const model = modelName && modelName !== DEFAULT_MODEL ? modelName : OLLAMA_MODEL;
    return new ChatOllama({
      baseUrl: process.env.LLM_BASE_URL ?? "http://localhost:11434",
      model,
      think: false,
      temperature: 0.7,
      maxTokens: 1024,
      timeout: 60000,
    });
  }
  return new ChatOpenAI({
    ...baseConfig,
    model: modelName || process.env.LLM_MODEL || DEFAULT_MODEL,
  });
}

/** 默认模型单例 */
export const defaultModel = createModel();
