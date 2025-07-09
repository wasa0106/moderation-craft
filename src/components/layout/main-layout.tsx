'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Home,
  FolderOpen,
  Calendar,
  BarChart3,
  Menu,
  X
} from 'lucide-react'

const navigation = [
  { name: 'ダッシュボード', href: '/', icon: Home },
  { name: 'プロジェクト', href: '/projects', icon: FolderOpen },
  { name: 'スケジュール', href: '/schedule', icon: Calendar },
  { name: 'レポート', href: '/reports', icon: BarChart3 },
]

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
              <h1 className="ml-4 text-xl font-semibold text-gray-900">
                moderation-craft
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                オフライン対応 · セルフケア統合
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* サイドバー */}
        <nav className={`${
          sidebarOpen ? 'block' : 'hidden'
        } md:block w-64 bg-white shadow-sm border-r min-h-screen`}>
          <div className="p-4">
            <div className="space-y-2">
              {navigation.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                )
              })}
            </div>
          </div>
        </nav>

        {/* メインコンテンツ */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
