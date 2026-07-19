// ============================================================================
// 知识库领域类型
// ============================================================================

export interface KnowledgeBase {
  id: number;
  name: string;
  description?: string;
  documentCount: number;
  status: number; // 1=正常 2=归档 3=删除
  createdAt: string;
  updatedAt: string;
}

export interface CreateKnowledgeBaseInput {
  name: string;
  description?: string;
}

export interface UpdateKnowledgeBaseInput {
  name?: string;
  description?: string;
}

export interface KnowledgeBaseDocument {
  id: number;
  knowledgeBaseId: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  chunkCount: number;
  status: number;
  createdAt: string;
}

export interface DocumentChunk {
  id: number;
  documentId: number;
  index: number;
  content: string;
  tokenCount: number;
}

export interface KbConversation {
  id: string;
  title: string;
  updatedAt: Date;
}

// ============================================================================
// 页面状态
// ============================================================================

export interface PageState {
  allKbs: KnowledgeBase[];
  kbsLoading: boolean;
  selectedKb: KnowledgeBase | null;
  documents: KnowledgeBaseDocument[];
  docsLoading: boolean;
  searchQuery: string;
  selectedDoc: KnowledgeBaseDocument | null;
  chunks: DocumentChunk[];
  chunksLoading: boolean;
  dialogOpen: boolean;
  editingKb: KnowledgeBase | null;
  deleteDialogOpen: boolean;
  deleteTarget: KnowledgeBase | null;
}

// ============================================================================
// 组件 Props
// ============================================================================

export interface KnowledgeListProps {
  items: KnowledgeBase[];
  selectedId: number | null;
  loading: boolean;
  onSelect: (id: number) => void;
  onCreateClick: () => void;
  onEdit: (kb: KnowledgeBase) => void;
  onDelete: (kb: KnowledgeBase) => void;
}

export interface DocumentListProps {
  documents: KnowledgeBaseDocument[];
  selectedId: number | null;
  onSelect: (doc: KnowledgeBaseDocument) => void;
  loading: boolean;
}

export interface DocumentViewerProps {
  chunks: DocumentChunk[];
  fileName: string | null;
  loading: boolean;
}

export interface KnowledgeChatProps {
  knowledgeBaseId: number;
  knowledgeBaseName: string;
}

export interface CreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; description?: string }) => Promise<void>;
  editingKb?: KnowledgeBase | null;
}
