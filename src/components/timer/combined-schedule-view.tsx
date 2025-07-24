/**
 * CombinedScheduleView - 予定と実績を並べて表示するコンポーネント
 */

import { useMemo, useState, useRef, useEffect } from 'react'
import { SmallTask, Project, WorkSession } from '@/types'
import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Clock, Brain, CheckCircle2, Play, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { WorkSessionEditDialog } from '@/components/timer/work-session-edit-dialog'
import { workSessionRepository } from '@/lib/db/repositories'
import { SyncService } from '@/lib/sync/sync-service'
import { useToast } from '@/hooks/use-toast'

interface CombinedScheduleViewProps {
  tasks: SmallTask[]
  sessions: WorkSession[]
  projects: Project[]
  currentTaskId?: string | null
  onTaskClick?: (task: SmallTask) => void
  date?: Date
}

export function CombinedScheduleView({
  tasks,
  sessions,
  projects,
  currentTaskId,
  onTaskClick,
  date = new Date(),
}: CombinedScheduleViewProps) {
  const { toast } = useToast()
  const [selectedSession, setSelectedSession] = useState<WorkSession | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const syncService = SyncService.getInstance()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  // 現在時刻を取得
  const now = new Date()
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()
  const isToday = date.toDateString() === now.toDateString()

  // プロジェクトの色を取得
  const getProjectColor = (projectId?: string): string => {
    if (!projectId) return 'from-gray-400 to-gray-500'
    
    const colors = [
      'from-blue-500 to-blue-600',
      'from-green-500 to-green-600',
      'from-purple-500 to-purple-600',
      'from-orange-500 to-orange-600',
    ]
    const index = projects.findIndex(p => p.id === projectId)
    return colors[index % colors.length] || colors[0]
  }

  // タスクの高さを計算（分単位）
  const getItemHeight = (minutes: number): number => {
    return Math.max(minutes * 0.8, 20) // 1分 = 0.8px, 最小20px
  }

  // タスクの開始位置を計算（分単位）
  const getItemTop = (time: string): number => {
    const startTime = parseISO(time)
    const hour = startTime.getHours()
    const minute = startTime.getMinutes()
    return (hour * 48) + (minute * 0.8) // 1時間 = 48px, 1分 = 0.8px
  }

  // セッションに紐づくタスクとプロジェクト情報を取得
  const getTaskAndProject = (session: WorkSession) => {
    if (!session.small_task_id) return null
    const task = tasks.find(t => t.id === session.small_task_id)
    if (!task) return null
    const project = projects.find(p => p.id === task.project_id)
    return { task, project }
  }

  // 集中力レベルの色を取得（背景色用）
  const getFocusGradient = (level?: number): string => {
    if (!level) return 'from-gray-400 to-gray-500'
    if (level >= 8) return 'from-purple-500 to-purple-600'  // ゾーン（最高の集中）
    if (level >= 7) return 'from-indigo-500 to-indigo-600'  // 深い集中
    if (level >= 6) return 'from-blue-500 to-blue-600'      // 集中
    if (level >= 5) return 'from-teal-500 to-teal-600'      // まあまあ
    if (level >= 4) return 'from-green-500 to-green-600'    // 普通
    if (level >= 3) return 'from-yellow-500 to-yellow-600'  // 疲れ気味
    if (level >= 2) return 'from-orange-500 to-orange-600'  // ぼんやり
    return 'from-red-500 to-red-600'                        // 眠い
  }

  // セッションの時間を計算
  const getSessionDuration = (session: WorkSession): number => {
    if (!session.end_time) {
      // 進行中のセッションは現在時刻まで
      const start = parseISO(session.start_time)
      return Math.floor((now.getTime() - start.getTime()) / (1000 * 60))
    }
    return session.duration_minutes || 0
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
  
  // 初期表示時に現在時刻の2時間前にスクロール
  useEffect(() => {
    if (scrollContainerRef.current && isToday) {
      // 現在時刻の2時間前の位置を計算（1時間 = 48px）
      const scrollHour = Math.max(0, currentHour - 2)
      const scrollPosition = scrollHour * 48
      
      // スクロール実行
      scrollContainerRef.current.scrollTop = scrollPosition
    }
  }, [date, isToday, currentHour])

  return (
    <div className="relative h-full">
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
      <div ref={scrollContainerRef} className="relative overflow-y-auto" style={{ height: 'calc(100% - 40px)' }}>
        <div className="grid grid-cols-[48px_1fr_1px_1fr] relative" style={{ height: '1152px' }}> {/* 24時間 × 48px */}
          {/* 時間軸 */}
          <div className="sticky left-0 bg-muted/30 border-r z-10">
            {Array.from({ length: 24 }, (_, hour) => (
              <div
                key={hour}
                className="h-[48px] border-b text-xs text-muted-foreground px-2 py-1 font-medium flex items-center"
              >
                {hour}:00
              </div>
            ))}
          </div>

          {/* 予定エリア */}
          <div className="relative bg-blue-50/20">
            {/* 時間帯の背景 */}
            {Array.from({ length: 24 }, (_, hour) => {
              const isPastHour = isToday && hour < currentHour
              
              return (
                <div key={hour} className="absolute w-full h-[48px] border-b" style={{ top: `${hour * 48}px` }}>
                  {/* 30分ごとの補助線 */}
                  <div className="absolute w-full h-px bg-border/50 top-[24px]" />
                  
                  {/* 過去の時間帯を薄く表示 */}
                  {isPastHour && (
                    <div className="absolute inset-0 bg-gray-100/30 pointer-events-none" />
                  )}
                </div>
              )
            })}

            {/* 現在時刻ライン（予定側） */}
            {isToday && (
              <div 
                className="absolute w-full h-0.5 bg-red-500 z-20"
                style={{ top: `${(currentHour * 48) + (currentMinute * 0.8)}px` }}
              >
                <div className="absolute -left-2 -top-1 w-2 h-2 bg-red-500 rounded-full" />
              </div>
            )}

            {/* タスク */}
            {tasks.map((task, index) => {
              const isActive = task.id === currentTaskId
              const isCompleted = task.actual_minutes && task.actual_minutes > 0
              const project = projects.find(p => p.id === task.project_id)

              return (
                <div
                  key={task.id}
                  className={cn(
                    'absolute left-2 right-2 rounded-lg p-2 cursor-pointer transition-all',
                    'hover:shadow-md hover:scale-[1.02]',
                    isActive && 'ring-2 ring-primary ring-offset-1',
                    isCompleted && 'opacity-60'
                  )}
                  style={{
                    top: `${getItemTop(task.scheduled_start)}px`,
                    height: `${getItemHeight(task.estimated_minutes)}px`,
                    zIndex: isActive ? 10 : index + 1,
                  }}
                  onClick={() => onTaskClick?.(task)}
                >
                  <div
                    className={cn(
                      'h-full rounded-md p-2 text-white overflow-hidden shadow-sm',
                      'bg-gradient-to-r',
                      getProjectColor(task.project_id)
                    )}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-[10px] leading-tight truncate">{task.name}</h4>
                        {project && task.estimated_minutes >= 30 && (
                          <p className="text-[10px] opacity-80 truncate">{project.name}</p>
                        )}
                      </div>
                      {task.is_emergency && (
                        <Badge variant="destructive" className="text-[9px] px-1 py-0 h-3">
                          緊急
                        </Badge>
                      )}
                    </div>
                    {task.estimated_minutes >= 30 && (
                      <div className="flex items-center gap-1 mt-0.5 text-[10px] opacity-80">
                        <Clock className="h-2.5 w-2.5" />
                        <span>{task.estimated_minutes}分</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* 中央の区切り線 */}
          <div className="bg-border relative">
            {/* 現在時刻マーカー */}
            {isToday && (
              <div 
                className="absolute w-full h-2 bg-red-500 -left-1 -right-1 rounded-full"
                style={{ top: `${(currentHour * 48) + (currentMinute * 0.8) - 4}px` }}
              />
            )}
          </div>

          {/* 実績エリア */}
          <div className="relative bg-green-50/20">
            {/* 時間帯の背景 */}
            {Array.from({ length: 24 }, (_, hour) => {
              const isPastHour = isToday && hour < currentHour
              
              return (
                <div key={hour} className="absolute w-full h-[48px] border-b" style={{ top: `${hour * 48}px` }}>
                  {/* 30分ごとの補助線 */}
                  <div className="absolute w-full h-px bg-border/50 top-[24px]" />
                  
                  {/* 過去の時間帯を薄く表示 */}
                  {isPastHour && (
                    <div className="absolute inset-0 bg-gray-100/30 pointer-events-none" />
                  )}
                </div>
              )
            })}

            {/* 現在時刻ライン（実績側） */}
            {isToday && (
              <div 
                className="absolute w-full h-0.5 bg-red-500 z-20"
                style={{ top: `${(currentHour * 48) + (currentMinute * 0.8)}px` }}
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
                <TooltipProvider key={session.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          'absolute left-2 right-2 rounded-lg p-2 transition-all cursor-pointer',
                          'hover:shadow-md hover:scale-[1.02]',
                          isActive && 'ring-2 ring-green-500 ring-offset-1',
                          isActive && isJustStarted && 'animate-pulse'
                        )}
                        style={{
                          top: `${getItemTop(session.start_time)}px`,
                          height: `${getItemHeight(displayDuration)}px`,
                          zIndex: isActive ? 10 : index + 1,
                        }}
                        onClick={() => handleSessionClick(session)}
                      >
                  <div
                    className={cn(
                      'h-full rounded-md p-2 text-white overflow-hidden shadow-sm',
                      'bg-gradient-to-r',
                      // 集中度が記録されていればそれに応じた色、なければプロジェクトの色
                      session.focus_level 
                        ? getFocusGradient(session.focus_level)
                        : taskInfo 
                          ? getProjectColor(taskInfo.project?.id) 
                          : 'from-gray-400 to-gray-500'
                    )}
                  >
                    {taskInfo ? (
                      <>
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-[10px] leading-tight truncate">{taskInfo.task.name}</h4>
                            {taskInfo.project && duration >= 30 && (
                              <p className="text-[10px] opacity-80 truncate">{taskInfo.project.name}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5">
                            {session.focus_level && duration >= 30 && (
                              <div className="flex items-center gap-0.5 bg-white/20 rounded px-0.5">
                                <Brain className="h-2.5 w-2.5" />
                                <span className="text-[10px] font-bold">{session.focus_level}</span>
                              </div>
                            )}
                            {isActive ? (
                              <Play className="h-2.5 w-2.5 animate-pulse" />
                            ) : (
                              <CheckCircle2 className="h-2.5 w-2.5" />
                            )}
                          </div>
                        </div>
                        {duration >= 30 && (
                          <div className="flex items-center gap-1 mt-0.5 text-[10px] opacity-80">
                            <Clock className="h-2.5 w-2.5" />
                            <span>{duration}分{isActive && ' (実行中)'}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div>
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-[10px] leading-tight truncate">
                              {session.task_description ? (
                                <span className="flex items-center gap-0.5">
                                  <Zap className="h-2.5 w-2.5" />
                                  {session.task_description}
                                </span>
                              ) : (
                                'タスクなし'
                              )}
                            </h4>
                            {session.task_description && duration >= 30 && (
                              <p className="text-[10px] opacity-80">計画外タスク</p>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5">
                            {session.focus_level && duration >= 30 && (
                              <div className="flex items-center gap-0.5 bg-white/20 rounded px-0.5">
                                <Brain className="h-2.5 w-2.5" />
                                <span className="text-[10px] font-bold">{session.focus_level}</span>
                              </div>
                            )}
                            {isActive ? (
                              <Play className="h-2.5 w-2.5 animate-pulse" />
                            ) : (
                              <CheckCircle2 className="h-2.5 w-2.5" />
                            )}
                          </div>
                        </div>
                        {duration >= 30 && (
                          <div className="flex items-center gap-1 mt-0.5 text-[10px] opacity-80">
                            <Clock className="h-2.5 w-2.5" />
                            <span>{duration}分{isActive && ' (実行中)'}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <div className="space-y-1">
                  <p className="font-semibold">
                    {taskInfo?.task.name || session.task_description || 'タスクなし'}
                  </p>
                  <div className="text-sm text-muted-foreground">
                    <p>開始: {format(parseISO(session.start_time), 'HH:mm', { locale: ja })}</p>
                    {session.end_time && (
                      <p>終了: {format(parseISO(session.end_time), 'HH:mm', { locale: ja })}</p>
                    )}
                    <p className="font-medium">
                      実際の時間: {duration}分
                      {displayDuration > duration && ' (最小表示10分)'}
                    </p>
                    {session.focus_level && (
                      <p>集中度: {session.focus_level}/9</p>
                    )}
                    {isActive && (
                      <p className="text-green-600 font-medium">実行中...</p>
                    )}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
        project={selectedSession && selectedSession.small_task_id ? 
          projects.find(p => p.id === tasks.find(t => t.id === selectedSession.small_task_id)?.project_id) : 
          undefined
        }
        onUpdate={handleSessionUpdate}
        onDelete={handleSessionDelete}
      />
    </div>
  )
}