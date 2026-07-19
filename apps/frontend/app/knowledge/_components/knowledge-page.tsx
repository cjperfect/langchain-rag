"use client";

import { useState, useEffect, useMemo, useCallback, useRef, useReducer } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Library, Search } from "lucide-react";
import { Panel, Group, Separator } from "react-resizable-panels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DocumentList } from "./document-list";
import { DocumentViewer } from "./document-viewer";
import { KnowledgeList } from "./knowledge-list";
import dynamic from "next/dynamic";
import { CreateDialog } from "./create-dialog";
import {
  getKnowledgeBases,
  getDocuments,
  getChunks,
  createKnowledgeBase,
  updateKnowledgeBase,
  deleteKnowledgeBase,
} from "@/mock/knowledge-api";
import type { KnowledgeBase, PageState } from "@/interfaces/knowledge";

const KnowledgeChat = dynamic(() => import("./knowledge-chat").then((m) => ({ default: m.KnowledgeChat })), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <Skeleton className="h-8 w-32" />
    </div>
  ),
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const initialState: PageState = {
  allKbs: [],
  kbsLoading: true,
  selectedKb: null,
  documents: [],
  docsLoading: false,
  searchQuery: "",
  selectedDoc: null,
  chunks: [],
  chunksLoading: false,
  dialogOpen: false,
  editingKb: null,
  deleteDialogOpen: false,
  deleteTarget: null,
};

export function KnowledgePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useReducer(
    (prev: PageState, next: Partial<PageState>) => ({ ...prev, ...next }),
    initialState,
  );

  const {
    allKbs,
    kbsLoading,
    selectedKb,
    documents,
    docsLoading,
    searchQuery,
    selectedDoc,
    chunks,
    chunksLoading,
    dialogOpen,
    editingKb,
    deleteDialogOpen,
    deleteTarget,
  } = state;

  const allKbsRef = useRef(allKbs);
  allKbsRef.current = allKbs;

  // 加载知识库列表
  const fetchKbList = useCallback(async () => {
    setState({ kbsLoading: true });
    const data = await getKnowledgeBases();
    setState({ allKbs: data, kbsLoading: false });
    return data;
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fetchKbList().then((data) => {
      if (data.length === 0) return;
      const first = data[0];
      setState({ selectedKb: first, selectedDoc: null, searchQuery: "", docsLoading: true });
      getDocuments(first.id).then((docs) => {
        setState({ documents: docs, docsLoading: false });
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKbList]);

  // 选中知识库 → 加载文档
  const handleSelectKb = useCallback(async (id: number) => {
    const kb = allKbsRef.current.find((k) => k.id === id) ?? null;
    setState({ selectedKb: kb, selectedDoc: null, searchQuery: "" });
    if (!kb) return;

    setState({ docsLoading: true });
    const docs = await getDocuments(id);
    setState({ documents: docs, docsLoading: false });
  }, []);

  // 选中文档 → 加载切片
  useEffect(() => {
    const docId = selectedDoc?.id;
    if (!docId) return;
    setState({ chunksLoading: true });
    getChunks(docId)
      .then((chunks) => setState({ chunks }))
      .finally(() => setState({ chunksLoading: false }));
  }, [selectedDoc?.id]);

  // 过滤文档
  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) return documents;
    const q = searchQuery.toLowerCase();
    return documents.filter((d) => d.fileName.toLowerCase().includes(q));
  }, [documents, searchQuery]);

  // 新建 / 编辑
  const handleSave = async (data: { name: string; description?: string }) => {
    if (editingKb) {
      await updateKnowledgeBase(editingKb.id, data);
    } else {
      await createKnowledgeBase(data);
    }
    const updated = await fetchKbList();
    const target = editingKb ? (updated.find((k) => k.id === editingKb.id) ?? updated[0]) : updated[0];
    if (target) {
      setState({ selectedKb: target, docsLoading: true });
      const docs = await getDocuments(target.id);
      setState({ documents: docs, docsLoading: false });
    }
    setState({ editingKb: null });
  };

  const openCreate = () => setState({ editingKb: null, dialogOpen: true });
  const handleEdit = (kb: KnowledgeBase) => setState({ editingKb: kb, dialogOpen: true });

  // 删除
  const handleDeleteClick = (kb: KnowledgeBase) => setState({ deleteTarget: kb, deleteDialogOpen: true });

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteKnowledgeBase(deleteTarget.id);
    // 如果删除的是当前选中的知识库，清除选中
    if (selectedKb?.id === deleteTarget.id) {
      setState({
        selectedKb: null,
        documents: [],
        selectedDoc: null,
        deleteDialogOpen: false,
        deleteTarget: null,
      });
    } else {
      setState({ deleteDialogOpen: false, deleteTarget: null });
    }
    await fetchKbList();
  };

  return (
    <div className="h-dvh flex flex-col bg-background">
      {/* 顶栏 */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <Button variant="ghost" size="icon" className="size-8" onClick={() => router.push("/")}>
          <ArrowLeft className="size-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Library className="size-4 text-primary" strokeWidth={2} />
          <h1 className="font-semibold">知识库</h1>
        </div>
      </header>

      {/* 三栏主体 */}
      <div className="flex-1 overflow-hidden">
        {mounted ? (
          <Group orientation="horizontal" id="knowledge-main" autoSave="knowledge-main">
            {/* 左栏：知识库列表 */}
            <Panel defaultSize={15} minSize={15}>
              <KnowledgeList
                items={allKbs}
                selectedId={selectedKb?.id ?? null}
                loading={kbsLoading}
                onSelect={handleSelectKb}
                onCreateClick={openCreate}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
              />
            </Panel>

            <Separator className="bg-border data-[resize-handle-active]:bg-primary/40 transition-colors" />

            {/* 中栏：文档列表 / 文档查看 */}
            <Panel defaultSize={42} minSize={20}>
              {!selectedKb ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground border-r">
                  <Library className="size-12" strokeWidth={1} />
                  <p className="text-sm">选择左侧知识库查看文档</p>
                </div>
              ) : selectedDoc ? (
                <div className="flex h-full flex-col border-r">
                  <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setState({ selectedDoc: null })}
                    >
                      ← 返回文件列表
                    </Button>
                    <span className="text-xs text-muted-foreground">{selectedKb.name}</span>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <DocumentViewer chunks={chunks} fileName={selectedDoc.fileName} loading={chunksLoading} />
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col border-r">
                  <div className="flex shrink-0 items-center justify-between border-b px-4 py-2.5">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => setState({ searchQuery: e.target.value })}
                        placeholder="搜索文件…"
                        className="h-7.5 border-0 bg-transparent pl-8 text-sm shadow-none focus-visible:ring-0"
                      />
                    </div>
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                      {docsLoading ? <Skeleton className="inline-block h-3 w-8" /> : `${documents.length} 个文件`}
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <DocumentList
                      documents={filteredDocuments}
                      selectedId={null}
                      onSelect={(doc) => setState({ selectedDoc: doc })}
                      loading={docsLoading}
                    />
                  </div>
                </div>
              )}
            </Panel>

            <Separator className="bg-border data-[resize-handle-active]:bg-primary/40 transition-colors" />

            {/* 右栏：AI 聊天 */}
            <Panel defaultSize={30} minSize={15}>
              <KnowledgeChat
                key={selectedKb?.id ?? "empty"}
                knowledgeBaseId={selectedKb?.id ?? 0}
                knowledgeBaseName={selectedKb?.name ?? ""}
              />
            </Panel>
          </Group>
        ) : (
          <div className="flex h-full items-center justify-center">
            <Skeleton className="h-8 w-64" />
          </div>
        )}
      </div>

      {/* 新建/编辑对话框 */}
      <CreateDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setState({ dialogOpen: open, ...(open ? {} : { editingKb: null }) });
        }}
        onSubmit={handleSave}
        editingKb={editingKb}
      />

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => setState({ deleteDialogOpen: open })}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除知识库「{deleteTarget?.name}」吗？此操作不可撤销，知识库内的所有文档将被一并删除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setState({ deleteDialogOpen: false })}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} className="gap-2 ml-2">
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
