import { OllamaEmbeddings } from "@langchain/ollama";

const EMBEDDING_BASE_URL = process.env.EMBEDDING_BASE_URL ?? "http://localhost:11434";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "qwen3-embedding:0.6b";

const baseEmbeddingConfig = {
  model: EMBEDDING_MODEL,
  baseUrl: EMBEDDING_BASE_URL,
  batchSize: 32,
  stripNewLines: false,
} as const;

/** 按模型名创建 OllamaEmbeddings 实例 */
export function createEmbeddings(modelName?: string): OllamaEmbeddings {
  return new OllamaEmbeddings({
    ...baseEmbeddingConfig,
    model: modelName ?? EMBEDDING_MODEL,
  });
}

/** 默认 embedding 模型单例 */
export const defaultEmbeddings = createEmbeddings();
