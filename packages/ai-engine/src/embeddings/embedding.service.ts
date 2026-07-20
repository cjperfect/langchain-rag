import { OpenAIEmbeddings } from "@langchain/openai";

/**
 * Embedding 模型配置 — 使用本地 Ollama
 *
 * Ollama 提供 OpenAI 兼容的 API 端点，OpenAIEmbeddings 可直接对接。
 * 默认 baseURL: http://localhost:11434/v1
 * 默认模型: qwen3-embedding:0.6b（Ollama）
 */
const EMBEDDING_BASE_URL = process.env.EMBEDDING_BASE_URL ?? "http://localhost:11434/v1";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "qwen3-embedding:0.6b";
// Ollama 不需要 API key，但 OpenAIEmbeddings 要求非空，传占位值
const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY ?? "ollama";

const baseEmbeddingConfig = {
  apiKey: EMBEDDING_API_KEY,
  model: EMBEDDING_MODEL,
  configuration: { baseURL: EMBEDDING_BASE_URL },
  batchSize: 32,
  stripNewLines: false,
} as const;

/** 按模型名创建 OpenAIEmbeddings 实例 */
export function createEmbeddings(modelName?: string): OpenAIEmbeddings {
  return new OpenAIEmbeddings({
    ...baseEmbeddingConfig,
    model: modelName ?? EMBEDDING_MODEL,
  });
}

/** 默认 embedding 模型单例 */
export const defaultEmbeddings = createEmbeddings();
