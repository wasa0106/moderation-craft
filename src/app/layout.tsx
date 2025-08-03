import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { MainLayout } from '@/components/layout/main-layout'
import { QueryProvider } from '@/components/providers/query-provider'
import { DebugProvider } from '@/components/providers/debug-provider'
import { SyncProvider } from '@/components/providers/sync-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from 'sonner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'moderation-craft',
  description: '個人創作者向けセルフケア統合型プロジェクト管理アプリ',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider defaultTheme="system" storageKey="moderation-craft-theme">
          <QueryProvider>
            <SyncProvider
              syncIntervalMs={30000} // 30秒ごとに同期
              enableAutoSync={true} // 自動同期を有効化
            >
              <DebugProvider>
                <MainLayout>{children}</MainLayout>
                <Toaster position="bottom-right" richColors />
              </DebugProvider>
            </SyncProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
