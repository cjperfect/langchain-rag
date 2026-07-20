"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  AuiIf,
  ThreadListItemMorePrimitive,
  ThreadListItemPrimitive,
  ThreadListPrimitive,
  useAuiState,
  useThreadListItemRuntime,
} from "@assistant-ui/react";
import { MoreHorizontalIcon, PencilIcon, PlusIcon, SearchIcon, TrashIcon } from "lucide-react";
import {
  forwardRef,
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type FC,
} from "react";

export const ThreadList: FC = () => {
  const [search, setSearch] = useState("");
  const hasThreads = useAuiState((s) => s.threads.threadIds.length > 0);

  return (
    <ThreadListRoot>
      <ThreadListNew />
      {hasThreads && <ThreadListSearch value={search} onValueChange={setSearch} />}
      <ThreadListItems searchQuery={hasThreads ? search : ""} />
    </ThreadListRoot>
  );
};

export const ThreadListSearch = forwardRef<
  HTMLInputElement,
  Omit<ComponentPropsWithoutRef<typeof Input>, "value" | "onChange"> & {
    value: string;
    onValueChange: (value: string) => void;
  }
>(({ className, value, onValueChange, ...props }, ref) => {
  return (
    <div data-slot="aui_thread-list-search" className="relative px-0.5 py-1">
      <SearchIcon
        data-slot="aui_thread-list-search-icon"
        className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2"
      />
      <Input
        ref={ref}
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        aria-label="搜索会话"
        placeholder="搜索会话"
        className={cn("h-8 ps-8 text-sm", className)}
        {...props}
      />
    </div>
  );
});

ThreadListSearch.displayName = "ThreadListSearch";

export const ThreadListRoot: FC<ComponentPropsWithoutRef<typeof ThreadListPrimitive.Root>> = ({
  className,
  ...props
}) => {
  return (
    <ThreadListPrimitive.Root
      data-slot="aui_thread-list-root"
      className={cn("flex flex-col gap-0.5", className)}
      {...props}
    />
  );
};

export const ThreadListItems: FC<ComponentPropsWithoutRef<"div"> & { searchQuery?: string }> = ({
  className,
  searchQuery = "",
  ...props
}) => {
  return (
    <div
      data-slot="aui_thread-list-items"
      className={cn("flex flex-col gap-0.5", className)}
      {...props}
    >
      <AuiIf condition={(s) => s.threads.isLoading}>
        <ThreadListSkeleton />
      </AuiIf>
      <AuiIf condition={(s) => !s.threads.isLoading}>
        <ThreadListItemGroups searchQuery={searchQuery} />
      </AuiIf>
    </div>
  );
};

type ThreadListGroup = { label: string; sortKey?: number; indices: number[] };

/** 获取线程所属的分类标签和排序键 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const categoryOf = (item: any): { label: string; sortKey: number } => {
  const custom = item?.custom as { knowledgeId?: number | null; knowledgeName?: string | null } | undefined;
  if (custom?.knowledgeId != null) {
    // 知识库会话按名称分组，sortKey 用知识库 ID 保证同知识库的在一起
    return { label: `📚 ${custom.knowledgeName ?? "知识库"}`, sortKey: custom.knowledgeId };
  }
  // 首页会话
  return { label: "🏠 首页会话", sortKey: -1 };
};

const ThreadListItemGroups: FC<{ searchQuery?: string }> = ({ searchQuery = "" }) => {
  const threadIds = useAuiState((s) => s.threads.threadIds);
  const threadItems = useAuiState((s) => s.threads.threadItems);

  const query = searchQuery.trim().toLowerCase();

  const { filteredIndices, groups } = useMemo(() => {
    const itemsById = new Map(threadItems.map((item) => [item.id, item]));
    const filteredIndices = threadIds
      .map((id, index) => ({ id, index }))
      .filter(
        ({ id }) => !query || (itemsById.get(id)?.title ?? "新会话").toLowerCase().includes(query),
      )
      .map(({ index }) => index);

    if (filteredIndices.length === 0) return { filteredIndices, groups: [] };

    // 按 knowledgeId + lastMessageAt 排序
    const sorted = [...filteredIndices].sort((a, b) => {
      const itemA = itemsById.get(threadIds[a]);
      const itemB = itemsById.get(threadIds[b]);
      const catA = categoryOf(itemA);
      const catB = categoryOf(itemB);
      // 先按分类排序（首页在前，然后按知识库 ID）
      if (catA.sortKey !== catB.sortKey) return catA.sortKey - catB.sortKey;
      // 同类内按时间倒序
      const timeA = itemA?.lastMessageAt?.getTime() ?? 0;
      const timeB = itemB?.lastMessageAt?.getTime() ?? 0;
      return timeB - timeA;
    });

    // 按分类标签分组
    const result: ThreadListGroup[] = [];
    for (const index of sorted) {
      const cat = categoryOf(itemsById.get(threadIds[index]));
      const lastGroup = result[result.length - 1];
      if (lastGroup?.label === cat.label) {
        lastGroup.indices.push(index);
      } else {
        result.push({ label: cat.label, sortKey: cat.sortKey, indices: [index] });
      }
    }
    return { filteredIndices, groups: result };
  }, [threadIds, threadItems, query]);

  if (query && filteredIndices.length === 0) {
    return (
      <div data-slot="aui_thread-list-empty" className="text-muted-foreground px-2.5 py-4 text-sm">
        未找到会话
      </div>
    );
  }

  return groups.map((group) => (
    <Fragment key={group.label}>
      <div
        data-slot="aui_thread-list-group-label"
        className="text-muted-foreground px-2.5 pt-3 pb-1 text-xs font-medium"
      >
        {group.label}
      </div>
      {group.indices.map((index) => (
        <ThreadListPrimitive.ItemByIndex
          key={threadIds[index]}
          index={index}
          components={{ ThreadListItem }}
        />
      ))}
    </Fragment>
  ));
};

export const ThreadListNew = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<typeof Button> & { labelClassName?: string }
>(({ className, labelClassName, children, ...props }, ref) => {
  return (
    <ThreadListPrimitive.New asChild>
      <Button
        ref={ref}
        variant="ghost"
        data-slot="aui_thread-list-new"
        className={cn(
          "hover:bg-muted data-active:bg-muted h-8 justify-start gap-2 rounded-md px-2.5 text-sm font-normal",
          className,
        )}
        {...props}
      >
        {children ?? (
          <>
            <PlusIcon data-slot="aui_thread-list-new-icon" className="size-4 shrink-0" />
            <span
              data-slot="aui_thread-list-new-label"
              className={cn("whitespace-nowrap", labelClassName)}
            >
              新会话
            </span>
          </>
        )}
      </Button>
    </ThreadListPrimitive.New>
  );
});

ThreadListNew.displayName = "ThreadListNew";

const ThreadListSkeleton: FC = () => {
  return (
    <div className="flex flex-col gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          role="status"
          aria-label="加载会话列表"
          data-slot="aui_thread-list-skeleton-wrapper"
          className="flex h-8 items-center px-2.5"
        >
          <Skeleton data-slot="aui_thread-list-skeleton" className="h-3.5 w-full" />
        </div>
      ))}
    </div>
  );
};

export const ThreadListItem: FC = () => {
  const runtime = useThreadListItemRuntime();
  const [isRenaming, setIsRenaming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const startRename = useCallback(() => {
    setIsRenaming(true);
  }, []);

  const commitRename = useCallback(() => {
    const newTitle = inputRef.current?.value.trim();
    if (newTitle && newTitle !== (runtime.getState().title ?? "")) {
      runtime.rename(newTitle);
    }
    setIsRenaming(false);
  }, [runtime]);

  useEffect(() => {
    if (isRenaming) {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.select();
      }
    }
  }, [isRenaming]);

  return (
    <ThreadListItemPrimitive.Root
      data-slot="aui_thread-list-item"
      className="group hover:bg-muted focus-visible:bg-muted data-active:bg-muted has-focus-visible:bg-muted has-data-[state=open]:bg-muted relative flex h-8 items-center rounded-md transition-colors focus-visible:outline-none"
    >
      <ThreadListItemPrimitive.Trigger
        data-slot="aui_thread-list-item-trigger"
        className="focus-visible:ring-ring/50 flex h-full min-w-0 flex-1 items-center rounded-md px-2.5 text-start text-sm outline-none group-hover:pe-9 group-has-focus-visible:pe-9 group-has-data-[state=open]:pe-9 group-data-active:pe-9 focus-visible:ring-[3px]"
      >
        {isRenaming ? (
          <input
            ref={inputRef}
            data-slot="aui_thread-list-item-rename-input"
            defaultValue={runtime.getState().title ?? ""}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setIsRenaming(false);
            }}
            className="bg-background ring-ring/50 h-5 w-full rounded-sm px-0.5 text-sm outline-none ring-[3px]"
          />
        ) : (
          <span data-slot="aui_thread-list-item-title" className="min-w-0 flex-1 truncate">
            <ThreadListItemPrimitive.Title fallback="新会话" />
          </span>
        )}
      </ThreadListItemPrimitive.Trigger>
      <ThreadListItemMore onRequestRename={startRename} />
    </ThreadListItemPrimitive.Root>
  );
};

const ThreadListItemMore: FC<{ onRequestRename: () => void }> = ({ onRequestRename }) => {
  const runtime = useThreadListItemRuntime();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleDelete = useCallback(() => {
    setDeleteDialogOpen(false);
    runtime.delete();
  }, [runtime]);

  return (
    <>
      <ThreadListItemMorePrimitive.Root sharedFocusGroup>
        <ThreadListItemMorePrimitive.Trigger asChild>
          <Button
            variant="ghost"
            size="icon"
            data-slot="aui_thread-list-item-more"
            className="data-[state=open]:bg-accent absolute end-1.5 top-1/2 size-6 -translate-y-1/2 p-0 opacity-0 group-hover:opacity-100 group-has-focus-visible:opacity-100 group-data-active:opacity-100 data-[state=open]:opacity-100"
          >
            <MoreHorizontalIcon className="size-3.5" />
            <span className="sr-only">更多选项</span>
          </Button>
        </ThreadListItemMorePrimitive.Trigger>
        <ThreadListItemMorePrimitive.Content
          side="right"
          align="start"
          sideOffset={6}
          data-slot="aui_thread-list-item-more-content"
          className="bg-popover/95 text-popover-foreground data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:animate-out data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-32 overflow-hidden rounded-xl border p-1.5 shadow-lg backdrop-blur-sm"
        >
          <ThreadListItemMorePrimitive.Item
            data-slot="aui_thread-list-item-more-item"
            className="hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none"
            onClick={onRequestRename}
          >
            <PencilIcon className="size-4" />
            重命名
          </ThreadListItemMorePrimitive.Item>

          <ThreadListItemMorePrimitive.Item
            data-slot="aui_thread-list-item-more-item"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <TrashIcon className="size-4" />
            删除
          </ThreadListItemMorePrimitive.Item>
        </ThreadListItemMorePrimitive.Content>
      </ThreadListItemMorePrimitive.Root>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              此操作不可撤销。确定要删除这个会话吗？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
