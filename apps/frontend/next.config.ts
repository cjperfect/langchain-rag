import { withAui } from "@assistant-ui/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // 上传文档的请求体会经 rewrite 代理转发到后端。
    // Next 默认只透传前 10MB，超出部分被丢弃并告警「Request body exceeded 10MB」，
    // 表现为文件看似上传成功、实际内容被截断。这里与上传弹窗的 50MB 提示对齐。
    // 注意选项名：middlewareClientMaxBodySize 已废弃，现名 proxyClientMaxBodySize。
    proxyClientMaxBodySize: "50mb",
    // rewrite 代理默认 30s 超时：解析 PDF（Unstructured 云 + 图片语义化）实测约 30s+，
    // 会触发代理超时导致前端收到 500。调大到 120s，覆盖慢解析场景。
    proxyTimeout: 120_000,
  },

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3001/api/:path*",
      },
    ];
  },
};

export default withAui(nextConfig);
