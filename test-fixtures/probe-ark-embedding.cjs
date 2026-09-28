// 探测豆包 embedding 直连可用性（OpenAI 兼容 /api/v3/embeddings）
const fs = require("fs");
const envFile = "C:/Users/ChenJiang/Desktop/langchain-rag/apps/backend/.env";
const env = fs.readFileSync(envFile, "utf8");
const key = (env.match(/^IMAGE_VLM_API_KEY=(.+)$/m) || [])[1]?.trim();
if (!key) { console.error("无 API KEY"); process.exit(1); }

(async () => {
  for (const model of ["doubao-embedding-vision-251215", "doubao-embedding-vision-250615"]) {
    try {
      const res = await fetch("https://ark.cn-beijing.volces.com/api/v3/embeddings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, input: ["倍轻松N6mini 颈部按摩仪"], dimensions: 1024 }),
        signal: AbortSignal.timeout(20000),
      });
      const text = await res.text();
      if (res.ok) {
        const data = JSON.parse(text);
        const dim = data.data?.[0]?.embedding?.length;
        console.log(`[200] ${model} → 向量维度 ${dim}，前3值: ${data.data[0].embedding.slice(0, 3).map((n) => n.toFixed(4)).join(", ")}`);
      } else {
        console.log(`[${res.status}] ${model} → ${text.slice(0, 150)}`);
      }
    } catch (e) {
      console.log(`[ERR] ${model} → ${e.message.slice(0, 100)}`);
    }
  }
})();
