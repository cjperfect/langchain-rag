/**
 * 知识库 API 封装 — 真实后端请求
 */

import { get, post, patch, del } from "@/lib/api";

// ============================================================================
// 类型定义（从 interfaces 统一导出）
// ============================================================================

import type {
  KnowledgeBase,
  CreateKnowledgeBaseInput,
  UpdateKnowledgeBaseInput,
  KnowledgeBaseDocument,
  CreateDocumentInput,
  DocumentChunk,
} from "@/interfaces/knowledge";

export type {
  KnowledgeBase,
  CreateKnowledgeBaseInput,
  UpdateKnowledgeBaseInput,
  KnowledgeBaseDocument,
  CreateDocumentInput,
  DocumentChunk,
};

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

export async function updateKnowledgeBase(
  id: number,
  input: UpdateKnowledgeBaseInput,
): Promise<KnowledgeBase> {
  return patch<KnowledgeBase>(`/knowledge/${id}`, input);
}

export async function deleteKnowledgeBase(id: number): Promise<void> {
  return del<void>(`/knowledge/${id}`);
}

// ============================================================================
// 文档 CRUD
// ============================================================================

export async function getDocuments(knowledgeBaseId: number): Promise<KnowledgeBaseDocument[]> {
  return get<KnowledgeBaseDocument[]>(`/knowledge/${knowledgeBaseId}/documents`);
}

export async function getDocumentContent(
  knowledgeBaseId: number,
  documentId: number,
): Promise<{ content: string }> {
  return get<{ content: string }>(`/knowledge/${knowledgeBaseId}/documents/${documentId}/content`);
}

export async function getDocumentChunks(
  knowledgeBaseId: number,
  documentId: number,
): Promise<DocumentChunk[]> {
  return get<DocumentChunk[]>(`/knowledge/${knowledgeBaseId}/documents/${documentId}/chunks`);
}

export async function createDocument(
  kbId: number,
  input: CreateDocumentInput,
): Promise<KnowledgeBaseDocument> {
  return post<KnowledgeBaseDocument>(`/knowledge/${kbId}/documents`, input);
}

export async function uploadDocument(
  kbId: number,
  file: File,
): Promise<KnowledgeBaseDocument> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`/api/knowledge/${kbId}/upload`, {
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

export async function updateDocument(
  kbId: number,
  docId: number,
  input: { content?: string; fileName?: string },
): Promise<KnowledgeBaseDocument> {
  return patch<KnowledgeBaseDocument>(`/knowledge/${kbId}/documents/${docId}`, input);
}

export async function deleteDocument(kbId: number, docId: number): Promise<void> {
  return del<void>(`/knowledge/${kbId}/documents/${docId}`);
}
