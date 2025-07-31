// app/sitemap/page.tsx
'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'

export default function SitemapPage() {
  const [pages, setPages] = useState<
    Array<{ name: string; path: string; status: 'checking' | 'ok' | 'error' }>
  >([])

  // あなたのプロジェクトのページリスト
  const expectedPages = [
    { name: 'ホーム', path: '/' },
    { name: 'ダッシュボード', path: '/dashboard' },
    { name: 'プロジェクト一覧', path: '/projects' },
    { name: '新規プロジェクト', path: '/projects/new' },
    { name: 'レポート', path: '/reports' },
    { name: 'スケジュール', path: '/schedule' },
    { name: '週次スケジュール', path: '/schedule/weekly' },
    { name: 'サイトマップ', path: '/sitemap' },
    { name: 'テスト', path: '/test' },
    { name: 'リポジトリ', path: '/test/repositories' },
    // 動的ルート（例として）
    { name: 'プロジェクト詳細 (例)', path: '/projects/1' },
  ]

  useEffect(() => {
    // 各ページの存在確認
    const checkPages = async () => {
      const pagesWithStatus = await Promise.all(
        expectedPages.map(async page => {
          try {
            const response = await fetch(page.path, { method: 'HEAD' })
            return {
              ...page,
              status: response.ok ? ('ok' as const) : ('error' as const),
            }
          } catch {
            return {
              ...page,
              status: 'error' as const,
            }
          }
        })
      )
      setPages(pagesWithStatus)
    }

    // 初期状態をセット
    setPages(expectedPages.map(page => ({ ...page, status: 'checking' as const })))

    // ページ確認を実行
    checkPages()
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'checking':
        return '🔄'
      case 'ok':
        return '✅'
      case 'error':
        return '❌'
      default:
        return '❓'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'checking':
        return 'text-warning bg-warning/10'
      case 'ok':
        return 'text-primary bg-primary/10'
      case 'error':
        return 'text-destructive bg-destructive/10'
      default:
        return 'text-muted-foreground bg-muted'
    }
  }

  const okPages = pages.filter(p => p.status === 'ok')
  const errorPages = pages.filter(p => p.status === 'error')

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-foreground mb-8 text-center">
          🗺️ サイトマップ（動的確認）
        </h1>

        {/* 統計情報 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-card rounded-lg shadow p-6 text-center">
            <div className="text-2xl font-bold text-primary">{pages.length}</div>
            <div className="text-muted-foreground">総ページ数</div>
          </div>
          <div className="bg-card rounded-lg shadow p-6 text-center">
            <div className="text-2xl font-bold text-primary">{okPages.length}</div>
            <div className="text-muted-foreground">正常ページ</div>
          </div>
          <div className="bg-card rounded-lg shadow p-6 text-center">
            <div className="text-2xl font-bold text-destructive">{errorPages.length}</div>
            <div className="text-muted-foreground">エラーページ</div>
          </div>
        </div>

        {/* ページリスト */}
        <div className="bg-card rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 bg-muted border-b">
            <h2 className="text-lg font-semibold text-foreground">ページ一覧</h2>
            <p className="text-sm text-muted-foreground mt-1">
              各ページの存在確認とアクセステストを行っています
            </p>
          </div>

          <div className="divide-y divide-border">
            {pages.map((page, index) => (
              <div key={page.path} className="px-6 py-4 hover:bg-accent">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">{getStatusIcon(page.status)}</span>
                    <div>
                      <h3 className="text-sm font-medium text-foreground">{page.name}</h3>
                      <p className="text-sm text-muted-foreground">{page.path}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${getStatusColor(page.status)}`}
                    >
                      {page.status === 'checking'
                        ? '確認中...'
                        : page.status === 'ok'
                          ? '正常'
                          : 'エラー'}
                    </span>

                    {page.status === 'ok' && (
                      <Link
                        href={page.path}
                        className="inline-flex items-center px-3 py-1 text-xs font-medium text-primary bg-primary/10 rounded-full hover:bg-primary/20 transition-colors"
                      >
                        確認 →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* エラーページがある場合の注意 */}
        {errorPages.length > 0 && (
          <div className="mt-8 bg-destructive/10 border border-destructive/20 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-destructive mb-3">⚠️ 確認が必要なページ</h3>
            <ul className="space-y-1 text-destructive/90">
              {errorPages.map(page => (
                <li key={page.path}>
                  • {page.name} ({page.path})
                </li>
              ))}
            </ul>
            <p className="text-sm text-destructive/80 mt-3">
              これらのページが存在しない場合は、expectedPages配列から削除してください。
            </p>
          </div>
        )}

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-md hover:bg-accent transition-colors"
          >
            ← ホームに戻る
          </Link>
        </div>
      </div>
    </div>
  )
}
