/**
 * CombinedScheduleView - 予定と実績を並べて表示するコンポーネント
 */

import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { SmallTask, Project, WorkSession, TimeEntry } from '@/types'
import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Moon, Sparkles, Brain, Edit2, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { secondsToMinutes } from '@/lib/utils/time-utils'
import { WorkSessionEditDialog } from '@/components/timer/work-session-edit-dialog'
import { RecordDetailDialog } from '@/components/timer/record-detail-dialog'
import { TimeEntryCreateDialog } from '@/components/timer/time-entry-create-dialog'
import { workSessionRepository, dopamineEntryRepository, moodEntryRepository } from '@/lib/db/repositories'
import { timeEntryRepository } from '@/lib/db/repositories/time-entry-repository'
import { SyncService } from '@/lib/sync/sync-service'
import { useToast } from '@/hooks/use-toast'
import { useSleepSchedule, generateSleepBlocks } from '@/hooks/use-sleep-schedule'
import { subDays, addDays } from 'date-fns'
import { DopamineEntry, MoodEntry } from '@/types'
import { useTimeEntries, useCreateTimeEntry } from '@/hooks/use-time-entries'
import { Button } from '@/components/ui/button'
import { Clock } from 'lucide-react'

interface CombinedScheduleViewProps {
  tasks: SmallTask[]
  sessions: WorkSession[]
  projects: Project[]
  currentTaskId?: string | null
  onTaskClick?: (task: SmallTask) => void
  onTaskStatusChange?: () => void
  date?: Date
  userId?: string
  dopamineEntries?: DopamineEntry[]
  moodEntries?: MoodEntry[]
  onRecordsUpdate?: () => void
  onSessionsUpdate?: () => void
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
  dopamineEntries = [],
  moodEntries = [],
  onRecordsUpdate,
  onSessionsUpdate,
}: CombinedScheduleViewProps) {
  const { toast } = useToast()
  const [selectedSession, setSelectedSession] = useState<WorkSession | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<{ type: 'dopamine' | 'mood', data: DopamineEntry | MoodEntry } | null>(null)
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false)
  const syncService = SyncService.getInstance()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const scrollPositionKey = `schedule-scroll-${format(date, 'yyyy-MM-dd')}`
  
  // TimeEntry作成用フック
  const { mutate: createTimeEntry } = useCreateTimeEntry(userId)
  
  // クリック&ドラッグ選択の状態管理
  const [selection, setSelection] = useState<{
    isSelecting: boolean
    startHour: number
    startMinute: number
    endHour: number
    endMinute: number
  } | null>(null)
  const [showTaskDialog, setShowTaskDialog] = useState(false)
  const [selectedTimeRange, setSelectedTimeRange] = useState<{
    startTime: Date
    endTime: Date
  } | null>(null)

  // 現在時刻を状態として管理
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const currentHour = currentTime ? currentTime.getHours() : new Date().getHours()
  const currentMinute = currentTime ? currentTime.getMinutes() : new Date().getMinutes()

  // Initialize currentTime on client side only
  useEffect(() => {
    if (!currentTime) {
      setCurrentTime(new Date())
    }
  }, [currentTime])
  const isToday = currentTime ? date.toDateString() === currentTime.toDateString() : false

  // Get TimeEntries for the date
  const { data: timeEntries = [], refetch } = useTimeEntries(userId, date)

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


  // HSLカラーを調整する関数（彩度18%、明度82%に設定）
  const adjustHSLForBackground = (hslColor: string): string => {
    const match = hslColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)
    if (!match) return hslColor

    const [, hue] = match
    return `hsl(${hue}, 18%, 82%)`
  }

  // タスクの高さを計算（分単位）
  const getItemHeight = (minutes: number): number => {
    // 最小高さは20pxを確保
    const baseHeight = Math.max(minutes, 20)
    // 余白を作るため、2px減らす
    return baseHeight - 2
  }

  // タスクの開始位置を計算（分単位）
  const getItemTop = (time: string): number => {
    const startTime = parseISO(time)
    const hour = startTime.getHours()
    const minute = startTime.getMinutes()
    return hour * 60 + minute // 1時間 = 60px, 1分 = 1px
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

      // 親コンポーネントにセッション更新を通知
      if (onSessionsUpdate) {
        onSessionsUpdate()
      }

      toast({
        title: '更新しました',
        description: 'セッション情報を更新しました',
      })
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

      // 親コンポーネントにセッション更新を通知
      if (onSessionsUpdate) {
        onSessionsUpdate()
      }

      toast({
        title: '削除しました',
        description: 'セッションを削除しました',
      })
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

  // 記録の更新
  const handleRecordUpdate = async (type: 'dopamine' | 'mood', id: string, data: Partial<DopamineEntry | MoodEntry>) => {
    try {
      if (type === 'dopamine') {
        await dopamineEntryRepository.update(id, data)
        await syncService.addToSyncQueue('dopamine_entry', id, 'update', data)
      } else {
        await moodEntryRepository.update(id, data)
        await syncService.addToSyncQueue('mood_entry', id, 'update', data)
      }
      
      // データ更新を親コンポーネントに通知
      if (onRecordsUpdate) {
        onRecordsUpdate()
      }
      
      // 選択中のレコードも更新
      if (selectedRecord) {
        setSelectedRecord({
          ...selectedRecord,
          data: { ...selectedRecord.data, ...data }
        })
      }
    } catch (error) {
      console.error('Failed to update record:', error)
      throw error
    }
  }

  // 記録の削除
  const handleRecordDelete = async (type: 'dopamine' | 'mood', id: string) => {
    try {
      if (type === 'dopamine') {
        await dopamineEntryRepository.delete(id)
        await syncService.addToSyncQueue('dopamine_entry', id, 'delete')
      } else {
        await moodEntryRepository.delete(id)
        await syncService.addToSyncQueue('mood_entry', id, 'delete')
      }
      
      // データ更新を親コンポーネントに通知
      if (onRecordsUpdate) {
        onRecordsUpdate()
      }
    } catch (error) {
      console.error('Failed to delete record:', error)
      throw error
    }
  }


  // マウスイベントハンドラー（クリック&ドラッグ用）
  const handleMouseDown = useCallback((hour: number, minute: number) => {
    console.log('Mouse down at:', hour, ':', minute) // 動作確認用
    setSelection({
      isSelecting: true,
      startHour: hour,
      startMinute: minute,
      endHour: hour,
      endMinute: minute,
    })
  }, [])

  const handleMouseMove = useCallback((hour: number, minute: number) => {
    if (selection?.isSelecting) {
      console.log('Mouse move at:', hour, ':', minute) // 動作確認用
      setSelection(prev => ({
        ...prev!,
        endHour: hour,
        endMinute: minute,
      }))
    }
  }, [selection?.isSelecting])

  const handleMouseUp = useCallback(() => {
    console.log('Mouse up, selection:', selection) // 動作確認用
    if (selection?.isSelecting) {
      console.log('Creating time range from selection') // 動作確認用
      // 選択範囲から開始・終了時刻を計算
      const startHour = Math.min(selection.startHour, selection.endHour)
      const startMinute = selection.startHour < selection.endHour ? selection.startMinute : 
                           selection.startHour > selection.endHour ? selection.endMinute :
                           Math.min(selection.startMinute, selection.endMinute)
      
      const endHour = Math.max(selection.startHour, selection.endHour)
      const endMinute = selection.startHour < selection.endHour ? selection.endMinute :
                         selection.startHour > selection.endHour ? selection.startMinute :
                         Math.max(selection.startMinute, selection.endMinute)
      
      const startTime = new Date(date)
      startTime.setHours(startHour, startMinute, 0, 0)
      
      const endTime = new Date(date)
      endTime.setHours(endHour, endMinute, 0, 0)
      
      // 最小15分の選択を保証
      if (endTime.getTime() - startTime.getTime() < 15 * 60 * 1000) {
        endTime.setTime(startTime.getTime() + 15 * 60 * 1000)
      }
      
      console.log('Setting time range:', { startTime, endTime }) // 動作確認用
      setSelectedTimeRange({ startTime, endTime })
      setShowTaskDialog(true)
      setSelection(null)
      console.log('Dialog should open now') // 動作確認用
    }
  }, [selection, date])

  // TimeEntry作成処理
  const handleCreateTimeEntry = useCallback((taskId: string) => {
    if (!selectedTimeRange) return

    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    console.log('Creating TimeEntry for task:', task.name) // デバッグログ

    createTimeEntry({
      user_id: userId,
      small_task_id: taskId,
      project_id: task.project_id,
      date: format(date, 'yyyy-MM-dd'),
      start_time: selectedTimeRange.startTime.toISOString(),
      end_time: selectedTimeRange.endTime.toISOString(),
      duration_minutes: Math.round(
        (selectedTimeRange.endTime.getTime() - selectedTimeRange.startTime.getTime()) / (1000 * 60)
      ),
      description: task.name,
    }, {
      onSuccess: () => {
        console.log('TimeEntry created successfully, refetching data...') // デバッグログ
        // 明示的にrefetchを実行
        refetch()
      },
      onError: (error) => {
        console.error('Failed to create TimeEntry:', error) // エラーログ
      }
    })

    toast({
      title: '実績を記録しました',
      description: `${task.name} (${format(selectedTimeRange.startTime, 'HH:mm')} - ${format(selectedTimeRange.endTime, 'HH:mm')})`,
    })

    setShowTaskDialog(false)
    setSelectedTimeRange(null)
  }, [selectedTimeRange, tasks, createTimeEntry, userId, date, toast, refetch])

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
        // 今日の場合は現在時刻の2時間前の位置を計算（1時間 = 60px）
        const scrollHour = Math.max(0, currentHour - 2)
        const scrollPosition = scrollHour * 60
        scrollContainerRef.current.scrollTop = scrollPosition
      }
    }
  }, [date, isToday, currentHour, scrollPositionKey])

  // 編集モード時のコンテンツをDndContextでラップ
  const scheduleContent = (
    <>
      {/* ヘッダー */}
      <div className="sticky top-0 z-20 bg-background border-b">
        <div className="grid grid-cols-[48px_1fr_1px_1fr_1px_32px] h-10">
          <div className="border-r bg-muted/30" />
          <div className="flex items-center justify-center text-sm font-medium text-muted-foreground">
            予定
          </div>
          <div className="bg-border" />
          <div className="flex items-center justify-center text-sm font-medium text-muted-foreground">
            実績
          </div>
          <div className="bg-border" />
          <div className="flex items-center justify-center text-sm font-medium text-muted-foreground">
            記録
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
        <div className="absolute" style={{ left: '48px', right: 0, top: 0, height: '1440px' }}>
          {Array.from({ length: 24 }, (_, hour) => {
            const isPastHour = isToday && hour < currentHour

            return (
              <div
                key={hour}
                className="relative h-[60px]"
                style={{ top: `${hour * 60}px`, position: 'absolute', width: '100%' }}
              >
                {/* 30分の補助線 */}
                <div className="absolute w-full h-[15px] top-0" />
                <div className="absolute w-full h-[15px] top-[15px]" />
                <div className="absolute w-full h-[15px] top-[30px]" />
                <div className="absolute w-full h-[15px] top-[45px]" />

                {/* 過去の時間帯を薄く表示 */}
                {isPastHour && <div className="absolute inset-0 bg-muted/30 pointer-events-none" />}
              </div>
            )
          })}
        </div>

        <div
          className="grid grid-cols-[48px_1fr_1px_1fr_1px_32px] relative max-w-full"
          style={{ height: '1440px' }}
        >
          {' '}
          {/* 24時間 × 60px */}
          {/* 時間軸 */}
          <div className="sticky -left-2 bg-muted/30 border-r z-5 relative">
            {Array.from({ length: 24 }, (_, hour) => (
              <div key={hour} className="relative h-[60px]">
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
                className="absolute w-full h-[60px] border-b border-border pointer-events-none"
                style={{ top: `${hour * 60}px`, zIndex: 15 }}
              />
            ))}

            {/* 睡眠ブロックを背景として表示 */}
            {sleepBlocks.map((block, index) => {
              const dateStr = format(date, 'yyyy-MM-dd')
              if (block.date !== dateStr) return null

              const top = block.startHour * 60 + block.startMinute
              const totalEndMinutes = block.endHour * 60 + block.endMinute
              const totalStartMinutes = block.startHour * 60 + block.startMinute
              const durationMinutes = totalEndMinutes - totalStartMinutes
              const height = durationMinutes

              return (
                <div
                  key={`sleep-${index}`}
                  className="absolute left-0.5 right-4 border-l-4"
                  style={{
                    top: `${top}px`,
                    height: `${height}px`,
                    zIndex: 18,  // クリックスロット(25)より低くする
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
                style={{ top: `${currentHour * 60 + currentMinute}px` }}
              >
                <div className="absolute -left-2 -top-1 w-2 h-2 bg-red-500 rounded-full" />
              </div>
            )}

            {/* タスク */}
            {tasks
              .filter(task => {
                // 緊急タスクは予定エリアに表示しない
                if (task.is_emergency) return false
                // 表示日のタスクのみ表示
                if (!task.scheduled_start || !date) return false
                const taskDate = new Date(task.scheduled_start)
                return (
                  taskDate.getDate() === date.getDate() &&
                  taskDate.getMonth() === date.getMonth() &&
                  taskDate.getFullYear() === date.getFullYear()
                )
              })
              .map((task) => {
              const isActive = task.id === currentTaskId
              const project =
                task.task_type !== 'routine'
                  ? projects.find(p => p.id === task.project_id)
                  : undefined
              const taskSessions = sessions.filter(s => s.small_task_id === task.id)

              // タスクを表示
              return (
                <div
                  key={task.id}
                  className={cn(
                    'absolute left-0.5 right-4 rounded-sm transition-all cursor-pointer box-border',
                    'hover:shadow-sm hover:bg-surface-2',
                    'border-0 border-l-4 overflow-hidden p-1.5',
                    'text-foreground',
                    isActive && 'ring-2 ring-primary ring-offset-1'
                  )}
                  style={{
                    top: `${getItemTop(task.scheduled_start!)}px`,
                    height: `${getItemHeight(task.estimated_minutes)}px`,
                    zIndex: isActive ? 19 : 18,  // クリックスロット(25)より低くする
                    ...(project?.color
                      ? {
                          backgroundColor: adjustHSLForBackground(project.color),
                          borderLeftColor: project.color,
                        }
                      : {
                          backgroundColor: 'hsl(137, 2%, 96%)',
                          borderLeftColor: 'hsl(137, 8%, 15%)',
                        }),
                  }}
                  onClick={() => onTaskClick?.(task)}
                >
                  <div className="flex flex-col gap-0.5">
                    <h4 className="text-sm font-medium truncate">{task.name}</h4>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{task.estimated_minutes}分</span>
                      {project && (
                        <>
                          <span>•</span>
                          <span className="truncate">{project.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {/* 中央の区切り線 */}
          <div className="bg-border relative" />
          {/* 実績エリア */}
          <div 
            className="relative bg-primary/5"
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* 時間ごとの境界線 */}
            {Array.from({ length: 24 }, (_, hour) => (
              <div
                key={`border-${hour}`}
                className="absolute w-full h-[60px] border-b border-border pointer-events-none"
                style={{ top: `${hour * 60}px`, zIndex: 15 }}
              />
            ))}

            {/* クリック可能な時間スロット */}
            {Array.from({ length: 24 * 4 }, (_, index) => {
              const hour = Math.floor(index / 4)
              const minute = (index % 4) * 15
              
              return (
                <div
                  key={`slot-${hour}-${minute}`}
                  className="absolute left-0 right-0 h-[15px] cursor-crosshair hover:bg-primary/10"
                  style={{ 
                    top: `${hour * 60 + minute}px`,
                    zIndex: 25  // WorkSession(20)やTimeEntry(20)より高くする
                  }}
                  onMouseDown={() => handleMouseDown(hour, minute)}
                  onMouseEnter={() => handleMouseMove(hour, minute)}
                />
              )
            })}

            {/* 選択範囲の視覚的フィードバック */}
            {selection && (
              <div
                className="absolute left-0 right-0 bg-primary/30 border-2 border-primary pointer-events-none"
                style={{
                  top: `${Math.min(selection.startHour * 60 + selection.startMinute, selection.endHour * 60 + selection.endMinute)}px`,
                  height: `${Math.abs((selection.endHour * 60 + selection.endMinute) - (selection.startHour * 60 + selection.startMinute))}px`,
                  zIndex: 20,
                }}
              >
                <div className="absolute top-0 left-2 text-xs font-medium text-primary">
                  {format(new Date(date).setHours(
                    Math.min(selection.startHour, selection.endHour),
                    selection.startHour < selection.endHour ? selection.startMinute : selection.endMinute
                  ), 'HH:mm')}
                </div>
                <div className="absolute bottom-0 left-2 text-xs font-medium text-primary">
                  {format(new Date(date).setHours(
                    Math.max(selection.startHour, selection.endHour),
                    selection.startHour < selection.endHour ? selection.endMinute : selection.startMinute
                  ), 'HH:mm')}
                </div>
              </div>
            )}

            {/* 現在時刻ライン（実績側） */}
            {isToday && (
              <div
                className="absolute w-full h-0.5 bg-red-500 z-50"
                style={{ top: `${currentHour * 60 + currentMinute}px` }}
              >
                <div className="absolute -right-2 -top-1 w-2 h-2 bg-red-500 rounded-full" />
              </div>
            )}

            {/* セッション（WorkSessionとTimeEntryの統合表示） */}
            {sessions.map((session) => {
              const taskInfo = getTaskAndProject(session)
              const isActive = !session.end_time
              const duration = getSessionDuration(session)
              // 表示用の時間（最小10分）
              const displayDuration = Math.max(duration, 10)
              const isJustStarted = duration < 5

              // 動的なスタイルを計算（予定エリアと同じロジック）
              const getDynamicStyles = () => {
                // 15分以内は最小サイズ
                if (displayDuration <= 15) {
                  return {
                    padding: 'p-0.5',
                    titleSize: 'text-[10px]',
                    timeSize: 'text-[9px]',
                    focusSize: 'text-[9px]',
                  }
                } else if (displayDuration <= 30) {
                  return {
                    padding: 'p-0.5',
                    titleSize: 'text-xs',
                    timeSize: 'text-[10px]',
                    focusSize: 'text-[10px]',
                  }
                } else if (displayDuration <= 60) {
                  return {
                    padding: 'p-1',
                    titleSize: 'text-xs',
                    timeSize: 'text-[11px]',
                    focusSize: 'text-[11px]',
                  }
                } else {
                  return {
                    padding: 'p-1.5',
                    titleSize: 'text-sm',
                    timeSize: 'text-xs',
                    focusSize: 'text-xs',
                  }
                }
              }

              const styles = getDynamicStyles()
              
              // 15分以内は特別な表示
              const isVeryShort = displayDuration <= 15
              
              // レイアウトを決定（セッションの長さに基づく）
              const shouldShowTimeOnSecondLine = displayDuration > 45 && !isVeryShort

              return (
                <div
                  key={session.id}
                  className={cn(
                    'absolute left-0.5 right-4 rounded-sm transition-all cursor-pointer box-border',
                    'hover:shadow-sm hover:bg-surface-2',
                    'border-0 border-l-4 overflow-hidden',
                    styles.padding,
                    'text-foreground',
                    isActive && 'ring-2 ring-primary ring-offset-1',
                    isActive && isJustStarted && 'animate-pulse',
                    !taskInfo && 'border-l-border bg-muted/50'
                  )}
                  style={{
                    top: `${getItemTop(session.start_time)}px`,
                    height: `${getItemHeight(displayDuration)}px`,
                    zIndex: isActive ? 31 : 30,  // クリックスロット(25)より高くする
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
                  onClick={() => handleSessionClick(session)}  // クリックで編集
                >
                  {taskInfo ? (
                    shouldShowTimeOnSecondLine ? (
                      // 2行表示パターン（高さが十分な場合）
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex-1 min-w-0">
                            <h4 className={cn('font-medium truncate', styles.titleSize)}>
                              {taskInfo.task.name}
                            </h4>
                          </div>
                          <div className="flex items-center gap-0.5">
                            {session.focus_level && duration >= 15 && (
                              <div className="bg-background/20 rounded px-0.5">
                                <span className={cn('font-bold', styles.focusSize)}>{session.focus_level}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className={cn('opacity-80', styles.timeSize)}>
                          {formatDuration(getSessionDurationInSeconds(session))} ({format(parseISO(session.start_time), 'HH:mm', { locale: ja })} - {session.end_time
                            ? format(parseISO(session.end_time), 'HH:mm', { locale: ja })
                            : '実行中'})
                        </div>
                      </div>
                    ) : (
                      // 1行表示パターン（高さが不足の場合）
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <h4 className={cn('font-medium truncate', styles.titleSize)}>
                            {taskInfo.task.name}
                          </h4>
                          <span className={cn('opacity-80 whitespace-nowrap', styles.timeSize)}>
                            {isVeryShort ? (
                              duration < 60 ? `${duration}分` : formatDuration(getSessionDurationInSeconds(session))
                            ) : (
                              <>
                                {formatDuration(getSessionDurationInSeconds(session))} ({format(parseISO(session.start_time), 'HH:mm', { locale: ja })} - {session.end_time
                                  ? format(parseISO(session.end_time), 'HH:mm', { locale: ja })
                                  : '実行中'})
                              </>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {session.focus_level && duration >= 15 && (
                            <div className="bg-background/20 rounded px-0.5">
                              <span className={cn('font-bold', styles.focusSize)}>{session.focus_level}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  ) : (
                    shouldShowTimeOnSecondLine ? (
                      // 2行表示パターン（タスクなし、高さが十分な場合）
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex-1 min-w-0">
                            <h4 className={cn('font-medium truncate', styles.titleSize)}>
                              {session.mood_notes || 'タスクなし'}
                            </h4>
                          </div>
                          <div className="flex items-center gap-0.5">
                            {session.focus_level && duration >= 15 && (
                              <div className="bg-background/20 rounded px-0.5">
                                <span className={cn('font-bold', styles.focusSize)}>{session.focus_level}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className={cn('opacity-80', styles.timeSize)}>
                          {formatDuration(getSessionDurationInSeconds(session))} ({format(parseISO(session.start_time), 'HH:mm', { locale: ja })} - {session.end_time
                            ? format(parseISO(session.end_time), 'HH:mm', { locale: ja })
                            : '実行中'})
                        </div>
                      </div>
                    ) : (
                      // 1行表示パターン（タスクなし、高さが不足の場合）
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <h4 className={cn('font-medium truncate', styles.titleSize)}>
                            {session.mood_notes || 'タスクなし'}
                          </h4>
                          <span className={cn('opacity-80 whitespace-nowrap', styles.timeSize)}>
                            {isVeryShort ? (
                              duration < 60 ? `${duration}分` : formatDuration(getSessionDurationInSeconds(session))
                            ) : (
                              <>
                                {formatDuration(getSessionDurationInSeconds(session))} ({format(parseISO(session.start_time), 'HH:mm', { locale: ja })} - {session.end_time
                                  ? format(parseISO(session.end_time), 'HH:mm', { locale: ja })
                                  : '実行中'})
                              </>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {session.focus_level && duration >= 15 && (
                            <div className="bg-background/20 rounded px-0.5">
                              <span className={cn('font-bold', styles.focusSize)}>{session.focus_level}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )
            })}

            {/* TimeEntry（手動入力の実績） */}
            {timeEntries.map((entry) => {
              const task = tasks.find(t => t.id === entry.small_task_id)
              const project = entry.project_id 
                ? projects.find(p => p.id === entry.project_id)
                : task?.project_id 
                  ? projects.find(p => p.id === task.project_id)
                  : undefined
              
              const duration = entry.duration_minutes
              const displayDuration = Math.max(duration, 10)

              // 動的なスタイルを計算（WorkSessionと同じロジック）
              const getDynamicStyles = () => {
                if (displayDuration <= 15) {
                  return {
                    padding: 'p-0.5',
                    titleSize: 'text-[10px]',
                    timeSize: 'text-[9px]',
                  }
                } else if (displayDuration <= 30) {
                  return {
                    padding: 'p-0.5',
                    titleSize: 'text-xs',
                    timeSize: 'text-[10px]',
                  }
                } else if (displayDuration <= 60) {
                  return {
                    padding: 'p-1',
                    titleSize: 'text-xs',
                    timeSize: 'text-[11px]',
                  }
                } else {
                  return {
                    padding: 'p-1.5',
                    titleSize: 'text-sm',
                    timeSize: 'text-xs',
                  }
                }
              }

              const styles = getDynamicStyles()
              const isVeryShort = displayDuration <= 15
              const shouldShowTimeOnSecondLine = displayDuration > 45 && !isVeryShort

              return (
                <div
                  key={`timeentry-${entry.id}`}
                  className={cn(
                    'absolute left-0.5 right-4 rounded-sm transition-all cursor-pointer box-border',
                    'hover:shadow-sm hover:bg-surface-2',
                    'border-0 border-l-4 overflow-hidden',
                    styles.padding,
                    'text-foreground',
                    !task && !entry.description && 'border-l-border bg-muted/50'
                  )}
                  style={{
                    top: `${getItemTop(entry.start_time)}px`,
                    height: `${getItemHeight(displayDuration)}px`,
                    zIndex: 30,  // クリックスロット(25)より高くする
                    ...(project?.color
                      ? {
                          backgroundColor: adjustHSLForBackground(project.color),
                          borderLeftColor: project.color,
                        }
                      : task || entry.description
                        ? {
                            backgroundColor: 'hsl(137, 2%, 96%)',
                            borderLeftColor: 'hsl(137, 8%, 15%)',
                          }
                        : {}),
                  }}
                  onClick={() => {  // クリックで編集
                    handleSessionClick({
                      id: entry.id,
                      user_id: entry.user_id,
                      small_task_id: entry.small_task_id || null,
                      project_id: entry.project_id || null,
                      start_time: entry.start_time,
                      end_time: entry.end_time,
                      duration_seconds: entry.duration_minutes * 60,
                      focus_level: entry.focus_level || null,
                      mood_notes: entry.description || null,
                      work_notes: entry.notes || null,
                      created_at: entry.created_at,
                      updated_at: entry.updated_at,
                      completed_task_ids: null,
                    } as WorkSession)
                  }}
                >
                  {shouldShowTimeOnSecondLine ? (
                    // 2行表示パターン
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex-1 min-w-0">
                          <h4 className={cn('font-medium truncate', styles.titleSize)}>
                            {task?.name || entry.description || 'タスクなし'}
                          </h4>
                        </div>
                        {entry.focus_level && duration >= 15 && (
                          <div className="bg-background/20 rounded px-0.5">
                            <span className={cn('font-bold text-[10px]')}>{entry.focus_level}</span>
                          </div>
                        )}
                      </div>
                      <div className={cn('opacity-80', styles.timeSize)}>
                        {duration}分 ({format(parseISO(entry.start_time), 'HH:mm', { locale: ja })} - {format(parseISO(entry.end_time), 'HH:mm', { locale: ja })})
                      </div>
                    </div>
                  ) : (
                    // 1行表示パターン
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <h4 className={cn('font-medium truncate', styles.titleSize)}>
                          {task?.name || entry.description || 'タスクなし'}
                        </h4>
                        <span className={cn('opacity-80 whitespace-nowrap', styles.timeSize)}>
                          {isVeryShort ? (
                            `${duration}分`
                          ) : (
                            <>
                              {duration}分 ({format(parseISO(entry.start_time), 'HH:mm', { locale: ja })} - {format(parseISO(entry.end_time), 'HH:mm', { locale: ja })})
                            </>
                          )}
                        </span>
                      </div>
                      {entry.focus_level && duration >= 15 && (
                        <div className="bg-background/20 rounded px-0.5">
                          <span className={cn('font-bold text-[10px]')}>{entry.focus_level}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {/* 中央の区切り線（実績と記録の間） */}
          <div className="bg-border relative" />
          {/* 記録エリア */}
          <div className="relative bg-primary/5">
            {/* 時間ごとの境界線 */}
            {Array.from({ length: 24 }, (_, hour) => (
              <div
                key={`border-${hour}`}
                className="absolute w-full h-[60px] border-b border-border pointer-events-none"
                style={{ top: `${hour * 60}px`, zIndex: 15 }}
              />
            ))}

            {/* 現在時刻ライン（記録側） */}
            {isToday && (
              <div
                className="absolute w-full h-0.5 bg-red-500 z-50"
                style={{ top: `${currentHour * 60 + currentMinute}px` }}
              />
            )}

            {/* 記録アイコンの配置 */}
            {(() => {
              const allRecords = [
                ...dopamineEntries.map(entry => ({ type: 'dopamine' as const, data: entry, timestamp: entry.timestamp })),
                ...moodEntries.map(entry => ({ 
                  type: 'mood' as const, 
                  data: entry, 
                  timestamp: entry.timestamp 
                }))
              ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

              // スロットごとの記録を管理（重複回避のため）
              const slotOccupancy: { [key: number]: number } = {}

              return allRecords.map((record, index) => {
                const recordTime = new Date(record.timestamp)
                const hour = recordTime.getHours()
                const minute = recordTime.getMinutes()
                const baseSlot = Math.floor(minute / 15)
                const baseTop = hour * 60 + baseSlot * 15

                // このスロットでの使用済み位置を取得
                const slotKey = baseTop
                const offsetCount = slotOccupancy[slotKey] || 0
                slotOccupancy[slotKey] = offsetCount + 1

                // 縦方向のオフセット（アイコンの高さ16px + 余白4px = 20pxずつずらす）
                const verticalOffset = offsetCount * 20
                const finalTop = baseTop + verticalOffset

                const Icon = record.type === 'dopamine' ? Sparkles : Brain
                const iconColor = record.type === 'dopamine' ? 'text-yellow-500' : 'text-blue-500'
                const hoverColor = record.type === 'dopamine' ? 'hover:bg-yellow-100' : 'hover:bg-blue-100'

                return (
                  <div
                    key={`${record.type}-${index}`}
                    className={cn(
                      'absolute left-2 w-6 h-6 flex items-center justify-center rounded cursor-pointer transition-all',
                      'hover:scale-110',
                      hoverColor
                    )}
                    style={{
                      top: `${finalTop}px`,
                      zIndex: 25,
                    }}
                    onClick={() => {
                      setSelectedRecord({ type: record.type, data: record.data })
                      setIsRecordDialogOpen(true)
                    }}
                    title={`${format(recordTime, 'HH:mm')} - ${
                      record.type === 'dopamine' 
                        ? (record.data as DopamineEntry).event_description.substring(0, 20) + '...'
                        : `気分レベル: ${(record.data as MoodEntry).mood_level}`
                    }`}
                  >
                    <Icon className={cn('h-4 w-4', iconColor)} />
                  </div>
                )
              })
            })()}
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

      {/* 記録詳細ダイアログ */}
      <RecordDetailDialog
        open={isRecordDialogOpen}
        onOpenChange={setIsRecordDialogOpen}
        record={selectedRecord}
        onUpdate={handleRecordUpdate}
        onDelete={handleRecordDelete}
      />

      {/* タスク選択ダイアログ */}
      <TimeEntryCreateDialog
        open={showTaskDialog}
        onOpenChange={setShowTaskDialog}
        startTime={selectedTimeRange?.startTime || null}
        endTime={selectedTimeRange?.endTime || null}
        tasks={tasks}
        projects={projects}
        onCreateEntry={handleCreateTimeEntry}
      />
    </>
  )

  return (
    <div className="relative h-full overflow-x-hidden">
      {scheduleContent}
    </div>
  )
}
