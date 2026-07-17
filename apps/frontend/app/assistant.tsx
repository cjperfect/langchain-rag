"use client";

import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  useRemoteThreadListRuntime,
  WebSpeechDictationAdapter,
} from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/thread";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThreadListSidebar } from "@/components/assistant-ui/threadlist-sidebar";
import { Separator } from "@/components/ui/separator";
import { DevToolsModal } from "@assistant-ui/react-devtools";
import { chatAdapter } from "@/adapters/chat-adapter";
import { remoteThreadListAdapter } from "@/adapters/remote-thread-list-adapter";

// 避免每次 render 重建
const speechAdapter = new WebSpeechDictationAdapter();

export const Assistant = () => {
  const runtime = useRemoteThreadListRuntime({
    adapter: remoteThreadListAdapter,
    runtimeHook: () =>
      useLocalRuntime(chatAdapter, {
        adapters: { dictation: speechAdapter },
      }),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <DevToolsModal />
      <SidebarProvider>
        <div className="flex h-dvh w-full pr-0.5">
          <ThreadListSidebar />
          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger />
              <Separator orientation="vertical" className="mr-2 h-4" />
            </header>
            <div className="flex-1 overflow-hidden">
              <Thread />
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </AssistantRuntimeProvider>
  );
};
