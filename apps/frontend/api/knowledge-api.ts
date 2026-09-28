/**
 * 知识库 API 封装 — 真实后端请求
 */

import { get, post, patch, del } from "@/lib/api";

// ============================================================================
// 类型定义（从 interfaces 统一导出）
// ============================================================================

import type { KnowledgeBase, CreateKnowledgeBaseInput, UpdateKnowledgeBaseInput, KnowledgeBaseDocument, CreateDocumentInput, DocumentChunk } from "@/interfaces/knowledge";

export type { KnowledgeBase, CreateKnowledgeBaseInput, UpdateKnowledgeBaseInput, KnowledgeBaseDocument, CreateDocumentInput, DocumentChunk };

// ============================================================================
// 知识库 CRUD
// ============================================================================

export async function getKnowledgeBases(): Promise<KnowledgeBase[]> {
  return get<KnowledgeBase[]>("/knowledge");
}

export async function getKnowledgeBase(id: number): Promise<KnowledgeBase> {
  return get<KnowledgeBase>(`/knowledge/${id}`);
}

export async function createKnowledgeBase(input: CreateKnowledgeBaseInput): Promise<KnowledgeBase> {
  return post<KnowledgeBase>("/knowledge", input);
}

export async function updateKnowledgeBase(id: number, input: UpdateKnowledgeBaseInput): Promise<KnowledgeBase> {
  return patch<KnowledgeBase>(`/knowledge/${id}`, input);
}

export async function deleteKnowledgeBase(id: number): Promise<void> {
  return del<void>(`/knowledge/${id}`);
}

// ============================================================================
// 文档 CRUD（独立资源，路由在 /api/documents；列表仍从知识库聚合查询）
// ============================================================================

export async function getDocuments(knowledgeBaseId: number): Promise<KnowledgeBaseDocument[]> {
  return get<KnowledgeBaseDocument[]>(`/knowledge/${knowledgeBaseId}/documents`);
}

export async function getDocumentContent(documentId: number): Promise<{ content: string }> {
  return get<{ content: string }>(`/documents/${documentId}/content`);
}

export async function getDocumentChunks(documentId: number): Promise<DocumentChunk[]> {
  return get<DocumentChunk[]>(`/documents/${documentId}/chunks`);
}



export async function createDocument(kbId: number, input: CreateDocumentInput): Promise<KnowledgeBaseDocument> {
  return post<KnowledgeBaseDocument>("/documents", { ...input, knowledgeBaseId: kbId });
}

export async function uploadDocument(kbId: number, file: File): Promise<KnowledgeBaseDocument> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`/api/documents/upload?kbId=${kbId}`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "上传失败" }));
    throw new Error(err.message ?? "上传失败");
  }

  const json = await res.json();
  return json.data;
}

/** 解析结果（只解析不上库时返回） */
export interface ParseResult {
  fileName: string;
  fileType: string;
  content: string;
  parseMeta?: { mode?: string; pages?: number; ocrPages?: number };
}

/**
 * 只解析不上库：POST /api/documents/parse
 * 返回解析文本 + 元数据，供前端预览/编辑，用户确认后再调 createDocument 真正入库。
 */
export async function parseDocumentApi(kbId: number, file: File): Promise<ParseResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`/api/documents/parse?kbId=${kbId}`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "解析失败" }));
    throw new Error(err.message ?? "解析失败");
  }

  const json = await res.json();
  return json.data;
}

export async function updateDocument(docId: number, input: { content?: string; fileName?: string }): Promise<KnowledgeBaseDocument> {
  return patch<KnowledgeBaseDocument>(`/documents/${docId}`, input);
}

export async function deleteDocument(docId: number): Promise<void> {
  return del<void>(`/documents/${docId}`);
}
