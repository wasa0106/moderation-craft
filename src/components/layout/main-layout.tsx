'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SyncStatusIndicator } from '@/components/sync/sync-status-indicator'
import {
  Timer,
  FolderOpen,
  Calendar,
  CalendarDays,
  BarChart3,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react'

const navigation = [
  { name: 'タイマー', href: '/timer', icon: Timer },
  { name: 'プロジェクト', href: '/projects', icon: FolderOpen },
  { name: 'スケジュール', href: '/schedule', icon: Calendar },
  { name: 'レポート', href: '/reports', icon: FileText },
]

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  // ページタイトルを動的に設定
  const getPageTitle = () => {
    switch (pathname) {
      case '/':
      case '/timer':
        return 'Timer'
      case '/projects':
        return 'Projects'
      case '/projects/new':
        return 'New Project'
      case '/schedule':
        return 'Weekly Schedule'
      case '/reports':
        return 'Reports'
      default:
        if (pathname.startsWith('/projects/')) return 'Project Details'
        return 'moderation-craft'
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#FCFAEC]">
      {/* サイドバーとメインコンテンツを横並びに */}
      {/* サイドバー */}
      <aside
        className={cn(
          'bg-[#2C2B2B] text-white min-h-screen transition-all duration-300 flex flex-col',
          isCollapsed ? 'w-16' : 'w-52',
          sidebarOpen ? 'block' : 'hidden md:flex'
        )}
      >
        {/* Logo/Toggle エリア */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          {!isCollapsed && <span className="text-lg font-semibold">MC</span>}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
          >
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4">
          <ul className="space-y-1">
            {navigation.map(item => {
              const isActive =
                pathname === item.href || (item.href === '/timer' && pathname === '/')
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all',
                      'hover:bg-gray-700',
                      isActive && 'bg-[#5E621B] hover:bg-[#464A02]',
                      isCollapsed && 'justify-center'
                    )}
                    title={isCollapsed ? item.name : undefined}
                  >
                    <item.icon size={20} className="shrink-0" />
                    {!isCollapsed && <span className="text-sm font-medium">{item.name}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Settings */}
        <div className="border-t border-gray-700 p-2">
          <Link
            href="/settings"
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all',
              'hover:bg-gray-700',
              pathname === '/settings' && 'bg-[#5E621B] hover:bg-[#464A02]',
              isCollapsed && 'justify-center'
            )}
            title={isCollapsed ? '設定' : undefined}
          >
            <Settings size={20} className="shrink-0" />
            {!isCollapsed && <span className="text-sm font-medium">設定</span>}
          </Link>
        </div>
      </aside>

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ヘッダー */}
        <header className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between">
            {/* モバイル用メニューボタン */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            
            {/* ページタイトル */}
            <h1 className="text-xl font-semibold text-gray-900">{getPageTitle()}</h1>
            
            {/* 同期状態インジケーター */}
            <div className="flex items-center gap-4">
              <SyncStatusIndicator />
            </div>
          </div>
        </header>
        
        {/* ページコンテンツ */}
        <main className="flex-1 overflow-auto bg-background">{children}</main>
      </div>
    </div>
  )
}
