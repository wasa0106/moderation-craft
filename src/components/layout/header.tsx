'use client'

import { usePathname } from 'next/navigation'
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns'
import { ja } from 'date-fns/locale'
import { CalendarDays, ChevronLeft, ChevronRight, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HeaderProps {
  // 汎用的なprops
  title?: string
  subtitle?: string
  leftContent?: React.ReactNode
  rightContent?: React.ReactNode

  // 週次スケジュール画面用のprops（後方互換性のため維持）
  selectedWeek?: Date
  onPreviousWeek?: () => void
  onNextWeek?: () => void
  onCopyPreviousWeek?: () => void
  weekStart?: Date
  weekEnd?: Date
}

export function Header({
  title,
  subtitle,
  leftContent,
  rightContent,
  selectedWeek,
  onPreviousWeek,
  onNextWeek,
  onCopyPreviousWeek,
  weekStart,
  weekEnd,
}: HeaderProps) {
  const pathname = usePathname()

  // パスに基づいてページタイトルを設定（titleが指定されていない場合のフォールバック）
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
        return 'moderation-craft'
    }
  }

  const pageTitle = title || getPageTitle()
  const isWeeklySchedule = pathname === '/schedule' && !title // titleが指定されていない場合のみ週次スケジュール用の表示

  return (
    <header className="bg-card border-b border-border">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* 左側: カスタムコンテンツまたはページタイトル */}
          <div className="flex items-center gap-4">
            {leftContent ? (
              leftContent
            ) : (
              <>
                <h1 className="text-2xl font-bold text-foreground">{pageTitle}</h1>

                {/* サブタイトルまたは週次スケジュール画面のデフォルトサブタイトル */}
                {subtitle ? (
                  <span className="text-muted-foreground">{subtitle}</span>
                ) : isWeeklySchedule ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CalendarDays className="w-5 h-5" />
                    <span>来週の計画を立てましょう</span>
                  </div>
                ) : null}
              </>
            )}
          </div>

          {/* 右側: カスタムコンテンツまたはデフォルトアクション */}
          {rightContent ? (
            rightContent
          ) : isWeeklySchedule && weekStart && weekEnd ? (
            <div className="flex items-center gap-4">
              {/* 日付範囲表示 */}
              <div className="text-muted-foreground bg-muted px-4 py-2 rounded-lg">
                <span className="text-sm">{format(weekStart, 'yyyy年MM月', { locale: ja })}</span>
                <div className="font-semibold">
                  {format(weekStart, 'd', { locale: ja })} - {format(weekEnd, 'd', { locale: ja })}
                </div>
              </div>

              {/* 週切り替えボタン */}
              <div className="flex items-center gap-2">
                <Button
                  onClick={onPreviousWeek}
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:bg-accent"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>

                <span className="text-muted-foreground px-2">今週</span>

                <Button
                  onClick={onNextWeek}
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:bg-accent"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>

              {/* 前週コピーボタン */}
              <Button
                onClick={onCopyPreviousWeek}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Copy className="w-4 h-4 mr-2" />
                前週コピー
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
