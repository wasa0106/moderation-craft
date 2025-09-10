'use client'

import * as React from 'react'
import { Timer, FolderOpen, Calendar, FileText, Home, Columns3 } from 'lucide-react'
import type { NavItem, User } from './types'

import { NavMain } from '@/components/layout/sidebar/nav-main'
import { NavUser } from '@/components/layout/sidebar/nav-user'
import { SyncStatusIndicator } from '@/components/sync/sync-status-indicator'
import { cn } from '@/lib/utils'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'

// ナビゲーションアイテムの定義
const navMain: NavItem[] = [
  {
    title: 'タイマー',
    url: '/timer',
    icon: Timer,
  },
  {
    title: 'スケジュール',
    url: '/schedule',
    icon: Calendar,
  },
  {
    title: 'カンバン',
    url: '/kanban',
    icon: Columns3,
  },
  {
    title: 'プロジェクト',
    url: '/projects',
    icon: FolderOpen,
  },
  {
    title: 'レポート',
    url: '/reports',
    icon: FileText,
  },
]

// デフォルトユーザー情報（後で認証システムから取得）
const defaultUser: User = {
  name: 'ユーザー',
  email: 'user@example.com',
  avatar: 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y',
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { isMobile, state } = useSidebar()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex items-center justify-between px-2 py-1.5 group-data-[collapsible=icon]:px-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shrink-0">
              <Home className="size-4" />
            </div>
            <div
              className={cn(
                'flex flex-col gap-0.5 leading-none overflow-hidden transition-all duration-200',
                state === 'collapsed' ? 'w-0 opacity-0' : 'w-auto opacity-100'
              )}
            >
              <span className="font-semibold truncate">ModerationCraft</span>
              <span className="text-xs text-muted-foreground truncate">v1.0</span>
            </div>
          </div>
          {isMobile && (
            <SidebarTrigger
              className={cn(
                '-mr-1 transition-opacity duration-200',
                state === 'collapsed' ? 'opacity-0 pointer-events-none' : 'opacity-100'
              )}
            />
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 py-2 border-t border-sidebar-border">
          <SyncStatusIndicator />
        </div>
        <NavUser user={defaultUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
