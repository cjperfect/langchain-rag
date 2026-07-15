import { ChatOpenAI } from "@langchain/openai";

export const model = new ChatOpenAI({
  model: "deepseek-v4-flash",
  apiKey: process.env.DEEPSEEK_API_KEY,
  temperature: 0.7,
  maxTokens: 1024,
  timeout: 60000,
  configuration: {
    baseURL: "https://api.deepseek.com",
  },
});

export default model;
