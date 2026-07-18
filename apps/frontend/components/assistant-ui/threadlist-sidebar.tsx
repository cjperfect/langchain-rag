"use client";

import type * as React from "react";
import { useRouter } from "next/navigation";
import { MessagesSquare, Library, LogOut, ChevronUp, ChevronRight } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThreadList } from "@/components/assistant-ui/thread-list";

export function ThreadListSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter();

  return (
    <Sidebar {...props}>
      <SidebarHeader className="aui-sidebar-header mb-2 border-b">
        <div className="aui-sidebar-header-content flex items-center justify-between">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <div>
                  <div className="aui-sidebar-header-icon-wrapper bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                    <MessagesSquare className="aui-sidebar-header-icon size-4" />
                  </div>
                  <div className="aui-sidebar-header-heading me-6 flex flex-col gap-0.5 leading-none">
                    <span className="aui-sidebar-header-title font-semibold">企业RAG智能体</span>
                  </div>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarHeader>
      <SidebarContent className="aui-sidebar-content px-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="sm"
              className="gap-2.5 font-medium mb-3 h-9 text-sm rounded-lg bg-white dark:bg-white/10 hover:bg-gray-50 dark:hover:bg-white/15 border shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.06)] cursor-pointer"
              onClick={() => router.push("/knowledge")}
            >
              <div className="flex aspect-square size-6 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_1px_2px_rgba(0,0,0,0.15)]">
                <Library className="size-3.5" />
              </div>
              <span className="flex-1 text-left">知识库</span>
              <ChevronRight className="size-4 opacity-40" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <ThreadList />
      </SidebarContent>
      <SidebarRail />
      <SidebarFooter className="aui-sidebar-footer border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="group/user-menu" asChild>
                  <div>
                    <div className="aui-sidebar-footer-icon-wrapper bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                      CJ
                    </div>
                    <div className="aui-sidebar-footer-heading flex flex-col gap-0.5 leading-none">
                      <span className="aui-sidebar-footer-title font-semibold">ChenJiang</span>
                      <span>已登录</span>
                    </div>
                    <ChevronUp className="ml-auto size-4 opacity-0 group-hover/user-menu:opacity-50 transition-opacity" />
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-48">
                <DropdownMenuItem onClick={() => router.push("/knowledge")}>
                  <Library className="size-4 mr-2" />
                  知识库管理
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <LogOut className="size-4 mr-2" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
