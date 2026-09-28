// 探测火山方舟可用的视觉理解 Model ID（用 1x1 像素最小请求，避免浪费额度）
const fs = require("fs");
const envFile = "C:/Users/ChenJiang/Desktop/langchain-rag/apps/backend/.env";
const env = fs.readFileSync(envFile, "utf8");
const key = (env.match(/^IMAGE_VLM_API_KEY=(.+)$/m) || [])[1]?.trim();
if (!key) { console.error("无 IMAGE_VLM_API_KEY"); process.exit(1); }

// 1x1 白色 JPEG base64
const tinyJpeg = "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==";
const body = {
  model: "PLACEHOLDER",
  messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: `data:image/jpeg;base64,${tinyJpeg}` } }, { type: "text", text: "hi" }] }],
  max_tokens: 8,
};

const candidates = [
  "doubao-seed-2-1-lite-260628",
  "doubao-seed-2-1-lite-260215",
  "doubao-seed-2-0-lite-260215",
  "doubao-seed-2-1-turbo-260628",
];

(async () => {
  for (const model of candidates) {
    try {
      const res = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ ...body, model }),
        signal: AbortSignal.timeout(20000),
      });
      const text = await res.text();
      console.log(`[${res.status}] ${model} → ${text.slice(0, 120)}`);
    } catch (e) {
      console.log(`[ERR] ${model} → ${e.message.slice(0, 100)}`);
    }
  }
})();
