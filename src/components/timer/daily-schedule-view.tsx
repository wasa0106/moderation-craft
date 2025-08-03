/**
 * DailyScheduleView - 1日のスケジュール表示コンポーネント
 */

import { useMemo } from 'react'
import { SmallTask, Project } from '@/types'
import { format, parseISO, isToday } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface DailyScheduleViewProps {
  tasks: SmallTask[]
  projects: Project[]
  currentTaskId?: string | null
  onTaskClick?: (task: SmallTask) => void
  date?: Date
  scrollTop?: number
  onScroll?: (scrollTop: number) => void
}

export function DailyScheduleView({
  tasks,
  projects,
  currentTaskId,
  onTaskClick,
  date = new Date(),
  scrollTop = 0,
  onScroll,
}: DailyScheduleViewProps) {
  // 時間帯ごとのタスクを取得
  const hourlyTasks = useMemo(() => {
    const tasksByHour: Record<number, SmallTask[]> = {}

    // 0-23時まで初期化
    for (let hour = 0; hour < 24; hour++) {
      tasksByHour[hour] = []
    }

    // タスクを時間帯ごとに分類
    tasks.forEach(task => {
      if (task.scheduled_start) {
        const startTime = parseISO(task.scheduled_start)
        const hour = startTime.getHours()
        tasksByHour[hour].push(task)
      }
    })

    return tasksByHour
  }, [tasks])

  // 現在時刻を取得
  const now = new Date()
  const currentHour = now.getHours()
  const isToday = date.toDateString() === now.toDateString()

  // プロジェクトの色を取得
  const getProjectColor = (projectId?: string): string => {
    if (!projectId) return 'bg-muted text-muted-foreground border-muted-foreground/20'

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

  // タスクの高さを計算（分単位）
  const getTaskHeight = (task: SmallTask): number => {
    return Math.max(task.estimated_minutes * 2, 40) // 1分 = 2px, 最小40px
  }

  // タスクの開始位置を計算（分単位）
  const getTaskTop = (task: SmallTask): number => {
    const startTime = parseISO(task.scheduled_start)
    return startTime.getMinutes() * 2 // 1分 = 2px
  }

  return (
    <div className="relative h-full">
      {/* 時間軸 */}
      <div className="absolute left-0 top-0 w-12 h-full bg-muted/30 border-r">
        {Array.from({ length: 24 }, (_, hour) => (
          <div key={hour} className="h-[120px] border-b text-xs text-muted-foreground px-2 py-1">
            {hour}:00
          </div>
        ))}
      </div>

      {/* タスク表示エリア */}
      <div
        className="ml-12 relative overflow-y-auto h-full"
        onScroll={e => onScroll?.(e.currentTarget.scrollTop)}
      >
        <div className="relative" style={{ height: '2880px' }}>
          {' '}
          {/* 24時間 × 120px */}
          {/* 時間帯ごとの背景 */}
          {Array.from({ length: 24 }, (_, hour) => {
            const isPastHour = isToday && hour < currentHour
            const hourTasks = hourlyTasks[hour] || []

            return (
              <div
                key={hour}
                className="absolute w-full h-[120px] border-b"
                style={{ top: `${hour * 120}px` }}
              >
                {/* 現在時刻ライン */}
                {isToday && hour === currentHour && (
                  <div
                    className="absolute w-full h-0.5 bg-destructive z-20"
                    style={{ top: `${(now.getMinutes() / 60) * 120}px` }}
                  >
                    <div className="absolute -left-2 -top-1 w-2 h-2 bg-destructive rounded-full" />
                  </div>
                )}

                {/* 過去の時間帯を薄く表示 */}
                {isPastHour && <div className="absolute inset-0 bg-muted/50 pointer-events-none" />}

                {/* 30分ごとの補助線 */}
                <div className="absolute w-full h-px bg-border top-[60px]" />
              </div>
            )
          })}
          {/* タスク */}
          {tasks.map((task, index) => {
            const startTime = parseISO(task.scheduled_start)
            const taskHour = startTime.getHours()
            const isActive = task.id === currentTaskId
            const isCompleted = task.actual_minutes && task.actual_minutes > 0
            const project = projects.find(p => p.id === task.project_id)

            return (
              <div
                key={task.id}
                className={cn(
                  'absolute left-2 right-2 rounded-lg p-2 cursor-pointer transition-all',
                  'hover:shadow-sm hover:scale-[1.02]',
                  isActive && 'ring-2 ring-primary ring-offset-2',
                  isCompleted && 'opacity-60'
                )}
                style={{
                  top: `${getTaskTop(task)}px`,
                  height: `${getTaskHeight(task)}px`,
                  zIndex: isActive ? 10 : index + 1,
                }}
                onClick={() => onTaskClick?.(task)}
              >
                <div
                  className={cn(
                    'h-full rounded-md p-2 overflow-hidden',
                    'border',
                    project?.color
                      ? 'text-white border-white/20'
                      : getProjectColor(task.project_id || '')
                  )}
                  style={{
                    ...(project?.color ? { backgroundColor: project.color } : {}),
                  }}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-xs truncate">{task.name}</h4>
                      {project && <p className="text-xs opacity-80 truncate">{project.name}</p>}
                    </div>
                    {task.is_emergency && (
                      <Badge variant="destructive" className="text-xs px-1 py-0">
                        緊急
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-xs opacity-80">
                    <Clock className="h-3 w-3" />
                    <span>
                      {format(parseISO(task.scheduled_start), 'HH:mm')} -
                      {format(parseISO(task.scheduled_end), 'HH:mm')}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
