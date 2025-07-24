/**
 * DailySessionsView - 1日の作業実績表示コンポーネント（カレンダー形式）
 */

import { useMemo } from 'react'
import { WorkSession, SmallTask, Project } from '@/types'
import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Clock, Brain } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DailySessionsViewProps {
  sessions: WorkSession[]
  tasks: SmallTask[]
  projects: Project[]
  date?: Date
  scrollTop?: number
  onScroll?: (scrollTop: number) => void
}

export function DailySessionsView({
  sessions,
  tasks,
  projects,
  date = new Date(),
  scrollTop = 0,
  onScroll,
}: DailySessionsViewProps) {
  // セッションに紐づくタスクとプロジェクト情報を取得
  const getTaskAndProject = (session: WorkSession) => {
    if (!session.small_task_id) return null
    const task = tasks.find(t => t.id === session.small_task_id)
    if (!task) return null
    const project = projects.find(p => p.id === task.project_id)
    return { task, project }
  }

  // プロジェクトの色を取得
  const getProjectColor = (projectId?: string): string => {
    if (!projectId) return 'from-gray-400 to-gray-500'
    
    const colors = [
      'from-[#3C6659] to-[#244E42]',
      'from-[#5E621B] to-[#464A02]',
      'from-[#8C4332] to-[#68342A]',
      'from-[#5F6044] to-[#47492E]',
    ]
    const index = projects.findIndex(p => p.id === projectId)
    return colors[index % colors.length] || colors[0]
  }

  // セッションの高さを計算（分単位）
  const getSessionHeight = (session: WorkSession): number => {
    if (!session.end_time) {
      // 進行中のセッションは現在時刻まで
      const now = new Date()
      const start = parseISO(session.start_time)
      const minutes = Math.floor((now.getTime() - start.getTime()) / (1000 * 60))
      return Math.max(minutes * 2, 40) // 1分 = 2px, 最小40px
    }
    return Math.max((session.duration_minutes || 0) * 2, 40)
  }

  // セッションの開始位置を計算（分単位）
  const getSessionTop = (session: WorkSession): number => {
    const startTime = parseISO(session.start_time)
    const hour = startTime.getHours()
    const minute = startTime.getMinutes()
    return (hour * 120) + (minute * 2) // 1時間 = 120px, 1分 = 2px
  }

  // 時間帯ごとのセッションをグループ化
  const sessionsByHour = useMemo(() => {
    const grouped: Record<number, WorkSession[]> = {}
    
    // 0-23時まで初期化
    for (let hour = 0; hour < 24; hour++) {
      grouped[hour] = []
    }

    // セッションを時間帯ごとに分類
    sessions.forEach(session => {
      const startTime = parseISO(session.start_time)
      const hour = startTime.getHours()
      grouped[hour].push(session)
    })

    return grouped
  }, [sessions])

  // 現在時刻を取得
  const now = new Date()
  const currentHour = now.getHours()
  const isToday = date.toDateString() === now.toDateString()

  // 集中力レベルの色を取得
  const getFocusColor = (level?: number): string => {
    if (!level) return 'text-gray-400'
    if (level >= 8) return 'text-purple-600'
    if (level >= 6) return 'text-blue-600'
    if (level >= 4) return 'text-green-600'
    return 'text-orange-600'
  }

  return (
    <div className="relative h-full">
      {/* 時間軸 */}
      <div className="absolute left-0 top-0 w-12 h-full bg-muted/30 border-r">
        {Array.from({ length: 24 }, (_, hour) => (
          <div
            key={hour}
            className="h-[120px] border-b text-xs text-muted-foreground px-2 py-1"
          >
            {hour}:00
          </div>
        ))}
      </div>

      {/* セッション表示エリア */}
      <div 
        className="ml-12 relative overflow-y-auto h-full"
        onScroll={(e) => onScroll?.(e.currentTarget.scrollTop)}
      >
        <div className="relative" style={{ height: '2880px' }}> {/* 24時間 × 120px */}
          {/* 時間帯ごとの背景 */}
          {Array.from({ length: 24 }, (_, hour) => {
            const isPastHour = isToday && hour < currentHour
            
            return (
              <div key={hour} className="absolute w-full h-[120px] border-b" style={{ top: `${hour * 120}px` }}>
                {/* 現在時刻ライン */}
                {isToday && hour === currentHour && (
                  <div 
                    className="absolute w-full h-0.5 bg-red-500 z-20"
                    style={{ top: `${(now.getMinutes() / 60) * 120}px` }}
                  >
                    <div className="absolute -left-2 -top-1 w-2 h-2 bg-red-500 rounded-full" />
                  </div>
                )}
                
                {/* 過去の時間帯を薄く表示 */}
                {isPastHour && (
                  <div className="absolute inset-0 bg-gray-100/50 pointer-events-none" />
                )}
                
                {/* 30分ごとの補助線 */}
                <div className="absolute w-full h-px bg-border top-[60px]" />
              </div>
            )
          })}

          {/* セッション */}
          {sessions.map((session, index) => {
            const taskInfo = getTaskAndProject(session)
            const isActive = !session.end_time

            return (
              <div
                key={session.id}
                className={cn(
                  'absolute left-2 right-2 rounded-lg p-2 transition-all',
                  'hover:shadow-lg',
                  isActive && 'ring-2 ring-primary ring-offset-2 animate-pulse'
                )}
                style={{
                  top: `${getSessionTop(session)}px`,
                  height: `${getSessionHeight(session)}px`,
                  zIndex: isActive ? 10 : index + 1,
                }}
              >
                <div
                  className={cn(
                    'h-full rounded-md p-2 text-white overflow-hidden',
                    'bg-gradient-to-r',
                    taskInfo ? getProjectColor(taskInfo.project?.id) : 'from-gray-400 to-gray-500'
                  )}
                >
                  {taskInfo ? (
                    <>
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-xs truncate">{taskInfo.task.name}</h4>
                          {taskInfo.project && (
                            <p className="text-xs opacity-80 truncate">{taskInfo.project.name}</p>
                          )}
                        </div>
                        {session.focus_level && (
                          <div className="flex items-center gap-0.5">
                            <Brain className={cn('h-3 w-3', getFocusColor(session.focus_level))} />
                            <span className="text-xs font-bold">{session.focus_level}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-xs opacity-80">
                        <Clock className="h-3 w-3" />
                        <span>
                          {format(parseISO(session.start_time), 'HH:mm')}
                          {session.end_time && ` - ${format(parseISO(session.end_time), 'HH:mm')}`}
                          {isActive && ' (実行中)'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div>
                      <h4 className="font-medium text-xs">タスクなし</h4>
                      <div className="flex items-center gap-1 mt-1 text-xs opacity-80">
                        <Clock className="h-3 w-3" />
                        <span>
                          {format(parseISO(session.start_time), 'HH:mm')}
                          {session.end_time && ` - ${format(parseISO(session.end_time), 'HH:mm')}`}
                        </span>
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
  )
}