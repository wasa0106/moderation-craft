'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

const testPages = [
  {
    title: 'データベース動作確認',
    description: 'IndexedDBの基本的な動作を確認します',
    href: '/test',
    icon: '🧪',
  },
  {
    title: 'リポジトリテスト',
    description: '各リポジトリの同期機能をテストします',
    href: '/test/repositories',
    icon: '🔄',
  },
  {
    title: 'UPDATE/DELETE同期テスト',
    description: '更新・削除操作の同期をテストします',
    href: '/test/update-delete',
    icon: '✏️',
  },
]

export default function TestIndexPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">テストページ一覧</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {testPages.map(page => (
          <Card key={page.href} className="hover:shadow-sm transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">{page.icon}</span>
                <span>{page.title}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">{page.description}</p>
              <Button asChild className="w-full" variant="outline">
                <Link href={page.href}>
                  テストを開く
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
