export interface CreateKnowledgeBaseDto {
  /** 知识库名称 */
  name: string;
  /** 描述 */
  description?: string;
}

export interface UpdateKnowledgeBaseDto {
  /** 知识库名称 */
  name?: string;
  /** 描述 */
  description?: string;
}

export interface CreateDocumentDto {
  /** 所属知识库 ID（文档是独立资源，需显式指定归属） */
  knowledgeBaseId: number;
  /** 文件名 */
  fileName: string;
  /** Markdown 内容 */
  content: string;
}

export interface UpdateDocumentDto {
  /** Markdown 内容 */
  content?: string;
  /** 文件名 */
  fileName?: string;
}
