"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Library, Search } from "lucide-react";
import { Panel, Group, Separator } from "react-resizable-panels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentList } from "./document-list";
import { ChunkViewer } from "./chunk-viewer";
import { KnowledgeBaseList } from "./knowledge-base-list";
import { KnowledgeChat } from "./knowledge-chat";
import { CreateDialog } from "./create-dialog";
import { getKnowledgeBases, getDocuments, getChunks, createKnowledgeBase } from "@/mock/knowledge-api";
import type { KnowledgeBase, KnowledgeBaseDocument, DocumentChunk } from "@/mock/knowledge-api";

export function KnowledgePage() {
  const router = useRouter();

  // --- 知识库列表 ---
  const [allKbs, setAllKbs] = useState<KnowledgeBase[]>([]);
  const [kbsLoading, setKbsLoading] = useState(true);

  // --- 选中的知识库 ---
  const [selectedKb, setSelectedKb] = useState<KnowledgeBase | null>(null);

  // --- 文档 ---
  const [documents, setDocuments] = useState<KnowledgeBaseDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeBaseDocument | null>(null);
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [chunksLoading, setChunksLoading] = useState(false);

  // --- 对话框 ---
  const [dialogOpen, setDialogOpen] = useState(false);

  // 加载知识库列表
  const fetchKbList = useCallback(async () => {
    setKbsLoading(true);
    const data = await getKnowledgeBases();
    setAllKbs(data);
    setKbsLoading(false);
    return data;
  }, []);

  useEffect(() => {
    fetchKbList();
  }, [fetchKbList]);

  // 选中知识库 → 加载文档
  const handleSelectKb = useCallback(
    async (id: number) => {
      const kb = allKbs.find((k) => k.id === id) ?? null;
      setSelectedKb(kb);
      setSelectedDoc(null);
      setSearchQuery("");
      if (!kb) return;

      setDocsLoading(true);
      const docs = await getDocuments(id);
      setDocuments(docs);
      setDocsLoading(false);
    },
    [allKbs],
  );

  // 选中文档 → 加载切片
  useEffect(() => {
    if (!selectedDoc) return;
    setChunksLoading(true);
    getChunks(selectedDoc.id)
      .then(setChunks)
      .finally(() => setChunksLoading(false));
  }, [selectedDoc]);

  // 过滤文档
  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) return documents;
    const q = searchQuery.toLowerCase();
    return documents.filter((d) => d.fileName.toLowerCase().includes(q));
  }, [documents, searchQuery]);

  // 新建
  const handleCreate = async (data: { name: string; description?: string }) => {
    await createKnowledgeBase(data);
    const updated = await fetchKbList();
    // 自动选中新建的知识库
    const created = updated[0];
    if (created) {
      setSelectedKb(created);
      setDocsLoading(true);
      const docs = await getDocuments(created.id);
      setDocuments(docs);
      setDocsLoading(false);
    }
  };

  const openCreate = () => {
    setDialogOpen(true);
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
        <Group orientation="horizontal" id="knowledge-main">
          {/* 左栏：知识库列表 */}
          <Panel defaultSize={15} minSize={15}>
            <KnowledgeBaseList
              items={allKbs}
              selectedId={selectedKb?.id ?? null}
              loading={kbsLoading}
              onSelect={handleSelectKb}
              onCreateClick={openCreate}
            />
          </Panel>

          <Separator className="bg-border data-[resize-handle-active]:bg-primary/40 transition-colors" />

          {/* 中栏：文档列表 / 切片查看 */}
          <Panel defaultSize={42} minSize={28}>
            {!selectedKb ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground border-r">
                <Library className="size-12" strokeWidth={1} />
                <p className="text-sm">选择左侧知识库查看文档</p>
              </div>
            ) : selectedDoc ? (
              <div className="flex h-full flex-col border-r">
                <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2.5">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedDoc(null)}>
                    ← 返回文件列表
                  </Button>
                  <span className="text-xs text-muted-foreground">{selectedKb.name}</span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <ChunkViewer chunks={chunks} fileName={selectedDoc.fileName} loading={chunksLoading} />
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col border-r">
                <div className="flex shrink-0 items-center justify-between border-b px-4 py-2.5">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
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
                    onSelect={setSelectedDoc}
                    loading={docsLoading}
                  />
                </div>
              </div>
            )}
          </Panel>

          <Separator className="bg-border data-[resize-handle-active]:bg-primary/40 transition-colors" />

          {/* 右栏：AI 聊天 */}
          <Panel defaultSize={30} minSize={20}>
            <KnowledgeChat
              key={selectedKb?.id ?? "empty"}
              knowledgeBaseId={selectedKb?.id ?? 0}
              knowledgeBaseName={selectedKb?.name ?? ""}
            />
          </Panel>
        </Group>
      </div>

      {/* 新建对话框 */}
      <CreateDialog open={dialogOpen} onOpenChange={setDialogOpen} onSubmit={handleCreate} />
    </div>
  );
}
