/**
 * CombinedScheduleView - 予定と実績を並べて表示するコンポーネント
 */

import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { SmallTask, Project, WorkSession } from '@/types'
import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Moon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { secondsToMinutes } from '@/lib/utils/time-utils'
import { TaskCard } from '@/components/timer/task-card'
import { WorkSessionEditDialog } from '@/components/timer/work-session-edit-dialog'
import { workSessionRepository } from '@/lib/db/repositories'
import { SyncService } from '@/lib/sync/sync-service'
import { useToast } from '@/hooks/use-toast'
import { useSleepSchedule, generateSleepBlocks } from '@/hooks/use-sleep-schedule'
import { subDays, addDays } from 'date-fns'

interface CombinedScheduleViewProps {
  tasks: SmallTask[]
  sessions: WorkSession[]
  projects: Project[]
  currentTaskId?: string | null
  onTaskClick?: (task: SmallTask) => void
  onTaskStatusChange?: () => void
  date?: Date
  userId?: string
}

export function CombinedScheduleView({
  tasks,
  sessions,
  projects,
  currentTaskId,
  onTaskClick,
  onTaskStatusChange,
  date = new Date(),
  userId = 'current-user',
}: CombinedScheduleViewProps) {
  const { toast } = useToast()
  const [selectedSession, setSelectedSession] = useState<WorkSession | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const syncService = SyncService.getInstance()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const scrollPositionKey = `schedule-scroll-${format(date, 'yyyy-MM-dd')}`

  // 現在時刻を状態として管理
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const currentHour = currentTime ? currentTime.getHours() : new Date().getHours()
  const currentMinute = currentTime ? currentTime.getMinutes() : new Date().getMinutes()

  // Initialize currentTime on client side only
  useEffect(() => {
    if (!currentTime) {
      setCurrentTime(new Date())
    }
  }, [])
  const isToday = currentTime ? date.toDateString() === currentTime.toDateString() : false

  // Get sleep schedule for the date, previous day, and next day
  const { data: sleepSchedule } = useSleepSchedule(userId, date)
  const previousDate = subDays(date, 1)
  const nextDate = addDays(date, 1)
  const { data: previousDaySleepSchedule } = useSleepSchedule(userId, previousDate)
  const { data: nextDaySleepSchedule } = useSleepSchedule(userId, nextDate)

  // Generate sleep blocks from current, previous, and next day
  const sleepBlocks = useMemo(() => {
    const blocks = []

    // Add blocks from current day's sleep schedule (wake up on this day)
    if (sleepSchedule) {
      blocks.push(...generateSleepBlocks(sleepSchedule))
    }

    // Add blocks from previous day's sleep schedule (for sleep that starts the day before)
    if (previousDaySleepSchedule) {
      blocks.push(...generateSleepBlocks(previousDaySleepSchedule))
    }

    // Add blocks from next day's sleep schedule (for sleep that starts this day)
    if (nextDaySleepSchedule) {
      blocks.push(...generateSleepBlocks(nextDaySleepSchedule))
    }

    return blocks
  }, [sleepSchedule, previousDaySleepSchedule, nextDaySleepSchedule])

  // 現在時刻を定期的に更新（今日の日付の場合のみ）
  useEffect(() => {
    if (!isToday) return

    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 300000) // 5分ごとに更新

    return () => clearInterval(timer)
  }, [isToday])

  // プロジェクトの色を取得
  const getProjectColor = (projectId?: string): string => {
    if (!projectId) return 'bg-muted text-foreground border-border'

    const project = projects.find(p => p.id === projectId)

    // プロジェクトにカラーが設定されている場合
    if (project?.color) {
      // HSLカラーをインラインスタイルで適用するためのクラスを返す
      // Note: 実際の色はstyle属性で設定するため、ここではベースクラスのみ返す
      return 'text-white border-white/20'
    }

    // フォールバック: インデックスベースの色
    const index = projects.findIndex(p => p.id === projectId)
    const colorClasses = [
      'bg-accent text-accent-foreground border-accent-foreground/20',
      'bg-muted text-muted-foreground border-muted-foreground/20',
      'bg-secondary text-secondary-foreground border-secondary-foreground/20',
      'bg-card text-card-foreground border-border',
    ]
    return colorClasses[index % colorClasses.length] || colorClasses[0]
  }

  // HSLカラーを調整する関数（彩度18%、明度82%に設定）
  const adjustHSLForBackground = (hslColor: string): string => {
    const match = hslColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)
    if (!match) return hslColor

    const [, hue] = match
    return `hsl(${hue}, 18%, 82%)`
  }

  // タスクの高さを計算（15分スロット単位）
  const getItemHeight = (minutes: number): number => {
    const slots = Math.ceil(minutes / 15) // 15分単位に切り上げ
    // 30分以下のタスクは最小2スロット（24px）を確保
    const minSlots = minutes <= 30 ? 2 : 1
    const baseHeight = Math.max(slots * 12, minSlots * 12)
    // スロット間に余白を作るため、1px減らす
    return baseHeight - 1
  }

  // タスクの開始位置を計算（15分スロット単位）
  const getItemTop = (time: string): number => {
    const startTime = parseISO(time)
    const hour = startTime.getHours()
    const minute = startTime.getMinutes()
    const slot = Math.floor(minute / 15) // 15分スロット（0-3）
    return hour * 48 + slot * 12 // 1時間 = 48px (4スロット × 12px)
  }

  // セッションに紐づくタスクとプロジェクト情報を取得
  const getTaskAndProject = (session: WorkSession) => {
    if (!session.small_task_id) return null
    const task = tasks.find(t => t.id === session.small_task_id)
    if (!task) return null
    const project =
      task.task_type !== 'routine' ? projects.find(p => p.id === task.project_id) : undefined
    return { task, project }
  }

  // 集中力レベルの色を取得（背景色用）
  const getFocusGradient = (level?: number): string => {
    if (!level) return 'bg-muted text-muted-foreground border-border'
    if (level >= 8) return 'bg-primary text-primary-foreground border-primary' // ゾーン（最高の集中）
    if (level >= 7) return 'bg-foreground text-background border-foreground' // 深い集中
    if (level >= 6) return 'bg-foreground/80 text-background border-foreground/80' // 集中
    if (level >= 5) return 'bg-muted-foreground text-background border-muted-foreground' // まあまあ
    if (level >= 4) return 'bg-muted text-muted-foreground border-border' // 普通
    if (level >= 3) return 'bg-accent text-accent-foreground border-accent' // 疲れ気味
    if (level >= 2) return 'bg-card text-card-foreground border-border' // ぼんやり
    return 'bg-background text-foreground border-border' // 眠い
  }

  // セッションの時間を計算
  const getSessionDuration = (session: WorkSession): number => {
    if (!session.end_time) {
      // 進行中のセッションは現在時刻まで
      const start = parseISO(session.start_time)
      const now = currentTime || new Date()
      return Math.floor((now.getTime() - start.getTime()) / (1000 * 60))
    }
    return secondsToMinutes(session.duration_seconds)
  }

  // 経過時間をHH:MM:SS形式でフォーマット
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  // セッションの実際の経過時間（秒）を取得
  const getSessionDurationInSeconds = (session: WorkSession): number => {
    if (!session.end_time) {
      const start = parseISO(session.start_time)
      const now = currentTime || new Date()
      return Math.floor((now.getTime() - start.getTime()) / 1000)
    }
    return session.duration_seconds
  }

  // セッションの更新
  const handleSessionUpdate = async (sessionId: string, updates: Partial<WorkSession>) => {
    try {
      const updatedSession = await workSessionRepository.update(sessionId, updates)
      await syncService.addToSyncQueue('work_session', sessionId, 'update', updatedSession)

      // 親コンポーネントのセッション一覧を更新するため、ページをリロード
      window.location.reload()
    } catch (error) {
      console.error('Failed to update session:', error)
      toast({
        title: 'エラー',
        description: 'セッションの更新に失敗しました',
        variant: 'destructive',
      })
    }
  }

  // セッションの削除
  const handleSessionDelete = async (sessionId: string) => {
    try {
      await workSessionRepository.delete(sessionId)
      await syncService.addToSyncQueue('work_session', sessionId, 'delete')

      // 親コンポーネントのセッション一覧を更新するため、ページをリロード
      window.location.reload()
    } catch (error) {
      console.error('Failed to delete session:', error)
      toast({
        title: 'エラー',
        description: 'セッションの削除に失敗しました',
        variant: 'destructive',
      })
    }
  }

  // セッションクリック時の処理
  const handleSessionClick = (session: WorkSession) => {
    setSelectedSession(session)
    setIsEditDialogOpen(true)
  }

  // スクロール位置の保存
  const saveScrollPosition = useCallback(() => {
    if (scrollContainerRef.current) {
      localStorage.setItem(scrollPositionKey, String(scrollContainerRef.current.scrollTop))
    }
  }, [scrollPositionKey])

  // 初期表示時にスクロール位置を復元、または現在時刻の2時間前にスクロール
  useEffect(() => {
    if (scrollContainerRef.current) {
      const savedPosition = localStorage.getItem(scrollPositionKey)

      if (savedPosition) {
        // 保存された位置に復元
        scrollContainerRef.current.scrollTop = parseInt(savedPosition)
      } else if (isToday) {
        // 今日の場合は現在時刻の2時間前の位置を計算（1時間 = 48px）
        const scrollHour = Math.max(0, currentHour - 2)
        const scrollPosition = scrollHour * 48
        scrollContainerRef.current.scrollTop = scrollPosition
      }
    }
  }, [date, isToday, currentHour, scrollPositionKey])

  return (
    <div className="relative h-full overflow-x-hidden">
      {/* ヘッダー */}
      <div className="sticky top-0 z-20 bg-background border-b">
        <div className="grid grid-cols-[48px_1fr_1px_1fr] h-10">
          <div className="border-r bg-muted/30" />
          <div className="flex items-center justify-center text-sm font-medium text-muted-foreground">
            予定
          </div>
          <div className="bg-border" />
          <div className="flex items-center justify-center text-sm font-medium text-muted-foreground">
            実績
          </div>
        </div>
      </div>

      {/* スケジュール本体 */}
      <div
        ref={scrollContainerRef}
        className="relative overflow-y-auto overflow-x-hidden"
        style={{
          height: 'calc(100% - 40px)',
          contain: 'layout style paint',
          willChange: 'scroll-position',
        }}
        onScroll={saveScrollPosition}
      >
        {/* 時間帯の背景（予定・実績エリアのみ） */}
        <div className="absolute" style={{ left: '48px', right: 0, top: 0, height: '1152px' }}>
          {Array.from({ length: 24 }, (_, hour) => {
            const isPastHour = isToday && hour < currentHour

            return (
              <div
                key={hour}
                className="relative h-[48px]"
                style={{ top: `${hour * 48}px`, position: 'absolute', width: '100%' }}
              >
                {/* 30分の補助線 */}
                <div className="absolute w-full h-[12px] top-0" />
                <div className="absolute w-full h-[12px] top-[12px]" />
                <div className="absolute w-full h-[12px] top-[24px]" />
                <div className="absolute w-full h-[12px] top-[36px]" />

                {/* 過去の時間帯を薄く表示 */}
                {isPastHour && <div className="absolute inset-0 bg-muted/30 pointer-events-none" />}
              </div>
            )
          })}
        </div>

        <div
          className="grid grid-cols-[48px_1fr_1px_1fr] relative max-w-full"
          style={{ height: '1152px' }}
        >
          {' '}
          {/* 24時間 × 48px */}
          {/* 時間軸 */}
          <div className="sticky -left-2 bg-muted/30 border-r z-5 relative">
            {Array.from({ length: 24 }, (_, hour) => (
              <div key={hour} className="relative h-[48px]">
                {/* 時刻表示を時間の境界に配置 */}
                {hour !== 0 && (
                  <div className="absolute -top-[13px] right-2 bg-muted/30 px-1">
                    <span className="text-xs font-medium text-muted-foreground font-mono">
                      {hour}:00
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* 予定エリア */}
          <div className="relative bg-primary/5">
            {/* 時間ごとの境界線 */}
            {Array.from({ length: 24 }, (_, hour) => (
              <div
                key={`border-${hour}`}
                className="absolute w-full h-[48px] border-b border-border pointer-events-none"
                style={{ top: `${hour * 48}px`, zIndex: 15 }}
              />
            ))}

            {/* 睡眠ブロックを背景として表示 */}
            {sleepBlocks.map((block, index) => {
              const dateStr = format(date, 'yyyy-MM-dd')
              if (block.date !== dateStr) return null

              const startSlot = Math.floor(block.startMinute / 15)
              const endSlot = Math.ceil(block.endMinute / 15) // 終了時刻は切り上げ
              const top = block.startHour * 48 + startSlot * 12
              const totalEndMinutes = block.endHour * 60 + block.endMinute
              const totalStartMinutes = block.startHour * 60 + block.startMinute
              const durationMinutes = totalEndMinutes - totalStartMinutes
              const durationSlots = Math.ceil(durationMinutes / 15)
              const height = durationSlots * 12

              return (
                <div
                  key={`sleep-${index}`}
                  className="absolute left-0.5 right-4 border-l-4"
                  style={{
                    top: `${top}px`,
                    height: `${height}px`,
                    zIndex: 20,
                    borderLeftColor: 'hsl(137, 8%, 15%)',
                  }}
                >
                  {/* 背景色と斜線パターン */}
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundColor: 'hsl(137, 5%, 82%)',
                      backgroundImage: `repeating-linear-gradient(
                        45deg,
                        transparent,
                        transparent 10px,
                        hsl(137, 6%, 65%) 10px,
                        hsl(137, 6%, 65%) 11px
                      )`,
                    }}
                  />
                  <div className="relative flex items-center gap-1 px-2 py-1 text-xs text-foreground">
                    <Moon className="h-3 w-3" />
                    <span className="font-medium">睡眠予定</span>
                  </div>
                </div>
              )
            })}

            {/* 現在時刻ライン（予定側） */}
            {isToday && (
              <div
                className="absolute w-full h-0.5 bg-red-500 z-50"
                style={{ top: `${currentHour * 48 + Math.floor(currentMinute / 15) * 12}px` }}
              >
                <div className="absolute -left-2 -top-1 w-2 h-2 bg-red-500 rounded-full" />
              </div>
            )}

            {/* タスク */}
            {tasks.map((task, index) => {
              const isActive = task.id === currentTaskId
              const project =
                task.task_type !== 'routine'
                  ? projects.find(p => p.id === task.project_id)
                  : undefined
              const taskSessions = sessions.filter(s => s.small_task_id === task.id)

              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  project={project}
                  sessions={taskSessions}
                  isActive={isActive}
                  onClick={() => onTaskClick?.(task)}
                  onStartTask={() => onTaskClick?.(task)}
                  onStatusChange={onTaskStatusChange}
                  showButtons={true}
                  compact={task.estimated_minutes <= 45}
                  style={{
                    position: 'absolute',
                    top: `${getItemTop(task.scheduled_start)}px`,
                    height: `${getItemHeight(task.estimated_minutes)}px`,
                    left: 2,
                    right: 16,
                    zIndex: isActive ? 20 : 20,
                  }}
                />
              )
            })}
          </div>
          {/* 中央の区切り線 */}
          <div className="bg-border relative" />
          {/* 実績エリア */}
          <div className="relative bg-primary/5">
            {/* 時間ごとの境界線 */}
            {Array.from({ length: 24 }, (_, hour) => (
              <div
                key={`border-${hour}`}
                className="absolute w-full h-[48px] border-b border-border pointer-events-none"
                style={{ top: `${hour * 48}px`, zIndex: 15 }}
              />
            ))}

            {/* 現在時刻ライン（実績側） */}
            {isToday && (
              <div
                className="absolute w-full h-0.5 bg-red-500 z-50"
                style={{ top: `${currentHour * 48 + Math.floor(currentMinute / 15) * 12}px` }}
              >
                <div className="absolute -right-2 -top-1 w-2 h-2 bg-red-500 rounded-full" />
              </div>
            )}

            {/* セッション */}
            {sessions.map((session, index) => {
              const taskInfo = getTaskAndProject(session)
              const isActive = !session.end_time
              const duration = getSessionDuration(session)
              // 表示用の時間（最小10分）
              const displayDuration = Math.max(duration, 10)
              const isJustStarted = duration < 5

              return (
                <div
                  key={session.id}
                  className={cn(
                    'absolute left-0.5 right-4 rounded-lg p-2 transition-all cursor-pointer',
                    'hover:shadow-md hover:scale-[1.02]',
                    isActive && 'ring-2 ring-primary ring-offset-1',
                    isActive && isJustStarted && 'animate-pulse'
                  )}
                  style={{
                    top: `${getItemTop(session.start_time)}px`,
                    height: `${getItemHeight(displayDuration)}px`,
                    zIndex: isActive ? 20 : 20,
                  }}
                  onClick={() => handleSessionClick(session)}
                >
                  <div
                    className={cn(
                      'h-full rounded-md p-2 overflow-hidden shadow-sm',
                      'border-0 border-l-4',
                      // デフォルトカラー
                      'text-foreground',
                      !taskInfo && 'border-l-border bg-muted/50'
                    )}
                    style={{
                      ...(taskInfo?.project?.color
                        ? {
                            backgroundColor: adjustHSLForBackground(taskInfo.project.color),
                            borderLeftColor: taskInfo.project.color,
                          }
                        : taskInfo
                          ? {
                              backgroundColor: 'hsl(137, 2%, 96%)',
                              borderLeftColor: 'hsl(137, 8%, 15%)',
                            }
                          : {}),
                    }}
                  >
                    {taskInfo ? (
                      <>
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-[10px] leading-tight truncate">
                              {taskInfo.task.name}
                            </h4>
                            <p className="text-[10px] opacity-80">
                              {formatDuration(getSessionDurationInSeconds(session))}
                              <span className="ml-1">
                                ({format(parseISO(session.start_time), 'HH:mm', { locale: ja })} -
                                {session.end_time
                                  ? format(parseISO(session.end_time), 'HH:mm', { locale: ja })
                                  : '実行中'}
                                )
                              </span>
                            </p>
                          </div>
                          <div className="flex items-center gap-0.5">
                            {session.focus_level && duration >= 30 && (
                              <div className="bg-background/20 rounded px-0.5">
                                <span className="text-[10px] font-bold">{session.focus_level}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div>
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-[10px] leading-tight truncate">
                              {session.mood_notes || 'タスクなし'}
                            </h4>
                            <p className="text-[10px] opacity-80">
                              {formatDuration(getSessionDurationInSeconds(session))}
                              <span className="ml-1">
                                ({format(parseISO(session.start_time), 'HH:mm', { locale: ja })} -
                                {session.end_time
                                  ? format(parseISO(session.end_time), 'HH:mm', { locale: ja })
                                  : '実行中'}
                                )
                              </span>
                            </p>
                          </div>
                          <div className="flex items-center gap-0.5">
                            {session.focus_level && duration >= 30 && (
                              <div className="bg-background/20 rounded px-0.5">
                                <span className="text-[10px] font-bold">{session.focus_level}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* セッション編集ダイアログ */}
      <WorkSessionEditDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        session={selectedSession}
        task={selectedSession ? tasks.find(t => t.id === selectedSession.small_task_id) : undefined}
        project={
          selectedSession && selectedSession.small_task_id
            ? projects.find(
                p => p.id === tasks.find(t => t.id === selectedSession.small_task_id)?.project_id
              )
            : undefined
        }
        onUpdate={handleSessionUpdate}
        onDelete={handleSessionDelete}
      />
    </div>
  )
}
