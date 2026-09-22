"use client";

import { useState, useRef, type DragEvent } from "react";
import { Loader2, Upload, File, X, Check, CircleX, Play, Clock, WifiOff, Radio } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TaskEventName, useTaskEventStream } from "@/lib/use-task-event-stream";
import type { TaskStreamMessage, TaskStreamPayload } from "@/lib/use-task-event-stream";

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

/** 弹窗阶段：选文件 → 处理中 → 成功 / 失败 */
type Phase = "select" | "running" | "done" | "failed";

interface TimelineItem {
  id: string;
  name: string;
  payload: TaskStreamPayload;
}

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (file: File) => Promise<void>;
}

/** 各阶段文案 */
const COPY: Record<Phase, { title: string; description: string }> = {
  select: { title: "上传文档", description: "支持 PDF、Markdown、Word、TXT、CSV、代码文件等格式，单个文件最大 50MB" },
  running: { title: "正在处理", description: "文档切片与向量化进行中，请勿关闭窗口" },
  done: { title: "处理完成", description: "文档已完成切片与向量化，可以开始检索了" },
  failed: { title: "处理失败", description: "文档处理过程中出现异常，请检查后重试" },
};

/** 时间线图标 */
function EventIcon({ name }: { name: string }) {
  switch (name) {
    case TaskEventName.STARTED:
      return <Play className="size-3.5 text-primary" />;
    case TaskEventName.PROGRESS:
      return <Clock className="size-3.5 text-muted-foreground" />;
    case TaskEventName.COMPLETED:
      return <Check className="size-3.5 text-emerald-600" />;
    case TaskEventName.FAILED:
      return <CircleX className="size-3.5 text-destructive" />;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// 组件
// ---------------------------------------------------------------------------

export function UploadDocumentDialog({ open, onOpenChange, onUpload }: UploadDocumentDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>("select");
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // ref 镜像：SSE 回调读取最新值，避免闭包捕获旧 state
  const phaseRef = useRef<Phase>("select");
  const taskIdRef = useRef<string | null>(null);
  const sawEventRef = useRef(false);

  /** 同步更新 state 与 ref */
  const setPhaseAll = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  const reset = () => {
    setFile(null);
    setDragging(false);
    setError("");
    setItems([]);
    setPhaseAll("select");
    taskIdRef.current = null;
    sawEventRef.current = false;
  };

  /** SSE 事件处理：锚定本次任务的 taskId，之后只接收它的事件 */
  const handleMessage = (message: TaskStreamMessage) => {
    const payload = message.payload;
    if (!payload) return;
    // 仅在处理中接收事件，避免弹窗刚打开时被其他任务的事件污染
    if (phaseRef.current !== "running") return;

    if (!taskIdRef.current) {
      // 本次任务尚未锚定：拿第一个 started 事件的 taskId 作为锚点
      if (message.name !== TaskEventName.STARTED) return;
      taskIdRef.current = payload.taskId;
    } else if (payload.taskId !== taskIdRef.current) {
      return; // 属于其他任务的事件
    }

    sawEventRef.current = true;
    setItems((prev) => [...prev, { id: `${message.name}-${prev.length}`, name: message.name, payload }]);

    if (message.name === TaskEventName.COMPLETED) setPhaseAll("done");
    if (message.name === TaskEventName.FAILED) {
      setError(payload.error ?? "任务执行失败");
      setPhaseAll("failed");
    }
  };

  // 弹窗打开即建立 SSE 连接：上传接口是同步等索引完成的，
  // 若等点击上传后再连，开头的事件会丢失。
  const stream = useTaskEventStream({ types: ["document_index"], enabled: open, onMessage: handleMessage });

  const handleFile = (f: File | null) => {
    setError("");
    if (!f) return;
    setFile(f);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async () => {
    if (!file) {
      setError("请先选择文件");
      return;
    }

    setError("");
    setItems([]);
    taskIdRef.current = null;
    sawEventRef.current = false;
    setPhaseAll("running");

    try {
      await onUpload(file);

      // 后端同步完成索引，HTTP 成功即任务成功。留一点时间让末尾的
      // SSE 事件渲染出来；只有完全没收到事件（SSE 未连通）时才用 HTTP 结果兜底。
      await new Promise((resolve) => setTimeout(resolve, 600));
      if (phaseRef.current === "running" && !sawEventRef.current) setPhaseAll("done");
    } catch (e) {
      // SSE 的 task.failed 带着具体原因（如向量库扩展缺失），比 HTTP 层笼统的
      // “服务器内部错误” 有用得多，已经收到就保留它，不要覆盖。
      if (phaseRef.current !== "failed") {
        setError(e instanceof Error ? e.message : "上传失败，请重试");
        setPhaseAll("failed");
      }
    }
  };

  const completedItem = items.findLast((item) => item.name === TaskEventName.COMPLETED);
  const chunkCount = Array.isArray(completedItem?.payload.result) ? completedItem.payload.result.length : null;
  const durationText =
    completedItem?.payload.durationMs != null ? `${(completedItem.payload.durationMs / 1000).toFixed(1)}s` : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && phase === "running") return; // 处理中不允许关闭
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton={phase !== "running"}>
        <DialogHeader>
          <DialogTitle>{COPY[phase].title}</DialogTitle>
          <DialogDescription>{COPY[phase].description}</DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {phase === "select" ? (
            file ? (
              /* 已选择文件 */
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <File className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
                <Button variant="ghost" size="icon" className="size-7 shrink-0" title="移除文件" onClick={() => setFile(null)}>
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              /* 拖拽上传区域 */
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 transition-colors ${
                  dragging ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50 hover:bg-muted/20"
                }`}
              >
                <Upload className="size-10 text-muted-foreground" strokeWidth={1.5} />
                <div className="text-center">
                  <p className="text-sm font-medium">拖拽文件到此处或点击选择</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF · MD · DOCX · TXT · CSV · 代码文件</p>
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.md,.docx,.txt,.csv,.ts,.tsx,.js,.jsx,.py,.sql,.json,.yml,.yaml,.pptx"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
              </div>
            )
          ) : (
            /* 处理中 / 结果：文件信息 + 任务事件时间线 */
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <File className="size-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file?.name ?? "文档"}</p>
                  <p className="text-xs text-muted-foreground">
                    {file ? `${(file.size / 1024).toFixed(0)} KB` : ""}
                  </p>
                </div>
                {phase === "running" ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" /> : null}
              </div>

              {/* 事件流连接状态：绿点表示进度会实时推送 */}
              {phase === "running" && stream.connected && !stream.error ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Radio className="size-3.5 text-emerald-600" />
                  事件流已连接，进度实时推送
                </div>
              ) : null}

              <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border bg-muted/20 p-3">
                {items.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    正在上传文件…
                  </div>
                ) : (
                  items.map((item) => (
                    <div key={item.id} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 shrink-0">
                        <EventIcon name={item.name} />
                      </span>
                      <span className="min-w-0 flex-1 break-words">
                        {item.payload.message ?? item.name}
                        {item.payload.step != null ? (
                          <span className="ml-1.5 text-xs text-muted-foreground">步骤 {item.payload.step}</span>
                        ) : null}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {phase === "done" ? (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                  <Check className="size-4 shrink-0" />
                  <span>
                    索引完成
                    {chunkCount != null ? ` · ${chunkCount} 个切片` : ""}
                    {durationText ? ` · 耗时 ${durationText}` : ""}
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* 事件流连不上时明确告警，避免「点了上传什么都不发生」这种无从下手的体验 */}
        {stream.error ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-800">
            <WifiOff className="mt-0.5 size-3.5 shrink-0" />
            <span className="min-w-0 flex-1 break-words">{stream.error}</span>
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter className="gap-2 sm:gap-0">
          {phase === "select" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button onClick={handleSubmit} disabled={!file} className="gap-2 ml-2">
                上传
              </Button>
            </>
          ) : null}

          {phase === "running" ? (
            <Button disabled className="gap-2">
              <Loader2 className="size-4 animate-spin" />
              处理中…
            </Button>
          ) : null}

          {phase === "done" ? (
            <Button onClick={() => onOpenChange(false)} className="ml-2">
              完成
            </Button>
          ) : null}

          {phase === "failed" ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setError("");
                  setItems([]);
                  setPhaseAll("select");
                }}
              >
                重试
              </Button>
              <Button onClick={() => onOpenChange(false)} className="ml-2">
                关闭
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
