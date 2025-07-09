import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { MainLayout } from '@/components/layout/main-layout'
import { QueryProvider } from '@/components/providers/query-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'moderation-craft',
  description: '個人創作者向けセルフケア統合型プロジェクト管理アプリ',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <QueryProvider>
          <MainLayout>
            {children}
          </MainLayout>
        </QueryProvider>
      </body>
    </html>
  )
}
