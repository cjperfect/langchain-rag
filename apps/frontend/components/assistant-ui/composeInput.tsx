import { ComposerPrimitive } from "@assistant-ui/react";
import { unstable_useMentionAdapter, unstable_useSlashCommandAdapter } from "@assistant-ui/react";
import { ComposerTriggerPopover } from "@/components/assistant-ui/composer-trigger-popover";
import { FileTextIcon, GlobeIcon, LanguagesIcon, SlashIcon, WrenchIcon } from "lucide-react";

export function ComposerInput() {
  // @ 提及配置
  const mention = unstable_useMentionAdapter({
    items: [
      { id: "1", type: "1", label: "陈江", metadata: { email: "123456@qq.com" } },
      { id: "2", type: "2", label: "测试人员", metadata: { email: "test@qq.com" } },
    ],
  });

  const slash = unstable_useSlashCommandAdapter({
    commands: [
      {
        id: "summarize",
        description: "总结当前的会话",
        icon: "FileText",
        execute: () => {},
      },
      {
        id: "search",
        description: "搜索互联网",
        icon: "Globe",
        execute: () => {},
      },
    ],
  });

  // 2. 渲染UI
  return (
    <ComposerPrimitive.Unstable_TriggerPopoverRoot>
      <ComposerPrimitive.Input
        placeholder="发送消息，输入@提及，输入/可以执行命令"
        className="aui-composer-input caret-primary placeholder:text-muted-foreground/80 max-h-32 min-h-10 w-full resize-none bg-transparent px-2.5 py-1 text-base outline-none"
        rows={1}
        autoFocus
        enterKeyHint="send"
        aria-label="消息输入框"
      />

      <ComposerTriggerPopover
        char="@"
        {...mention}
        emptyItemsLabel="暂无人员"
        fallbackIcon={WrenchIcon}
      />

      <ComposerTriggerPopover
        char="/"
        {...slash}
        action={{
          ...slash.action,
          onExecute: (command) => {
            console.log(command);
          },
        }}
        iconMap={{
          FileText: FileTextIcon,
          Languages: LanguagesIcon,
          Globe: GlobeIcon,
        }}
        fallbackIcon={SlashIcon}
        emptyItemsLabel="暂无命令"
      />
    </ComposerPrimitive.Unstable_TriggerPopoverRoot>
  );
}
