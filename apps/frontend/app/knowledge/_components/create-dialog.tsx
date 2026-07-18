"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { KnowledgeBase } from "@/mock/knowledge-api";

interface CreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; description?: string }) => Promise<void>;
  editingKb?: KnowledgeBase | null;
}

export function CreateDialog({ open, onOpenChange, onSubmit, editingKb }: CreateDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isEditing = !!editingKb;

  // 编辑时回填表单
  useEffect(() => {
    if (editingKb) {
      setName(editingKb.name);
      setDescription(editingKb.description ?? "");
    } else {
      setName("");
      setDescription("");
    }
    setError("");
  }, [editingKb, open]);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("请输入知识库名称");
      return;
    }
    if (trimmed.length > 100) {
      setError("名称不能超过 100 个字符");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await onSubmit({ name: trimmed, description: description.trim() || undefined });
      onOpenChange(false);
    } catch {
      setError("保存失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "编辑知识库" : "新建知识库"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "修改知识库的名称和描述信息" : "创建一个新的知识库，后续可上传文档进行管理"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="kb-name">名称</Label>
            <Input
              id="kb-name"
              placeholder="输入知识库名称"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError("");
              }}
              disabled={loading}
              autoFocus
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kb-description">描述（可选）</Label>
            <Textarea
              id="kb-description"
              placeholder="简要描述知识库的内容和用途"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
              }}
              disabled={loading}
              rows={3}
              maxLength={500}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="gap-2 ml-2">
            {loading && <Loader2 className="size-4 animate-spin" />}
            {isEditing ? "保存" : "创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
