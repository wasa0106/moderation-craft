/**
 * ProjectProgressCard - プロジェクトごとの作業予定と実績を表示するカード
 */

'use client'

import { Card, CardContent } from '@/components/ui/card'
import { SmallTask, WorkSession, Project } from '@/types'
import { useTodayTotal } from '@/hooks/use-today-total'
import { isToday } from 'date-fns'
import { getProjectBorderColor, getProjectAccentColor } from '@/lib/utils/project-colors'
import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProjectProgressCardProps {
  dayTasks: SmallTask[]
  todaySessions: WorkSession[]
  projects: Project[]
  selectedDate?: Date
}

export function ProjectProgressCard({
  dayTasks,
  todaySessions,
  projects,
  selectedDate,
}: ProjectProgressCardProps) {
  // 予定時間の計算（分単位）
  const plannedMinutes = dayTasks.reduce((sum, task) => sum + task.estimated_minutes, 0)

  // 今日の実績時間（リアルタイム更新）
  const { todayTotalFormatted } = useTodayTotal('current-user', todaySessions)

  // 選択日が今日かどうか
  const isTodaySelected = selectedDate ? isToday(selectedDate) : true

  // 実績時間の計算（分単位、今日以外の日付用）
  const actualSeconds = todaySessions.reduce((sum, session) => sum + session.duration_seconds, 0)
  const actualMinutes = Math.floor(actualSeconds / 60)

  // 分をhh:mm形式にフォーマット（予定時間用）
  const formatTime = (totalMinutes: number) => {
    const hours = Math.floor(totalMinutes / 60)
    const minutes = Math.floor(totalMinutes % 60)

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }

  // プロジェクトごとの集計（タスク詳細付き）
  const projectStats = projects
    .map(project => {
      // プロジェクトに属するタスクの予定時間
      const projectTasks = dayTasks.filter(task => task.project_id === project.id)
      const plannedMinutes = projectTasks.reduce((sum, task) => sum + task.estimated_minutes, 0)

      // タスクごとの実績時間を計算
      const taskStats = projectTasks.map(task => {
        const taskSessions = todaySessions.filter(session => session.small_task_id === task.id)
        const taskActualSeconds = taskSessions.reduce(
          (sum, session) => sum + session.duration_seconds,
          0
        )
        const taskActualMinutes = Math.floor(taskActualSeconds / 60)

        return {
          task,
          plannedMinutes: task.estimated_minutes,
          actualMinutes: taskActualMinutes,
        }
      })

      // プロジェクト全体の実績時間
      const actualMinutes = taskStats.reduce((sum, stat) => sum + stat.actualMinutes, 0)

      return {
        project,
        plannedMinutes,
        actualMinutes,
        tasks: taskStats,
      }
    })
    .filter(stat => stat.plannedMinutes > 0 || stat.actualMinutes > 0) // 予定または実績がある場合のみ表示

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-lg font-medium font-mono">
          {isTodaySelected ? todayTotalFormatted : formatTime(actualMinutes)} /{' '}
          {formatTime(plannedMinutes)}
        </div>
      </div>

      {projectStats.length > 0 && (
        <div className="space-y-6 pt-2 border-t border-border">
          {projectStats.map(({ project, actualMinutes, plannedMinutes, tasks }) => {
            const allTasksCompleted =
              tasks.length > 0 && tasks.every(({ task }) => task.status === 'completed')

            return (
              <div
                key={project.id}
                className="space-y-1 pl-2 border-l-4"
                style={{ borderLeftColor: project.color ? getProjectBorderColor(project.color) : 'var(--accent)' }}
              >
                {/* プロジェクトヘッダー */}
                <div className="flex items-center justify-between text-base font-medium">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{ backgroundColor: project.color ? getProjectAccentColor(project.color) : 'var(--accent)' }}
                    />
                    <span className="truncate">{project.name}</span>
                  </div>
                  <span className="font-mono text-base tabular-nums min-w-[11ch] text-right">
                    {formatTime(actualMinutes)} / {formatTime(plannedMinutes)}
                  </span>
                </div>

                {/* タスクリスト */}
                {tasks.length > 0 && (
                  <div className="ml-3 space-y-2">
                    {tasks.map(({ task, actualMinutes, plannedMinutes }) => (
                      <div key={task.id} className="flex items-center justify-between text-sm">
                        <span
                          className={cn(
                            'truncate mr-2 flex items-center gap-1',
                            task.status === 'completed' && 'line-through'
                          )}
                        >
                          <span className="w-4 h-4 shrink-0">
                            {task.status === 'completed' && (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            )}
                          </span>
                          <span
                            className={cn(
                              task.status === 'completed'
                                ? 'text-muted-foreground/60'
                                : 'text-foreground'
                            )}
                          >
                            {task.name}
                          </span>
                        </span>
                        <span
                          className={cn(
                            'font-mono text-sm tabular-nums min-w-[11ch] text-right',
                            task.status === 'completed'
                              ? 'text-muted-foreground/60'
                              : 'text-muted-foreground font-semibold'
                          )}
                        >
                          {formatTime(actualMinutes)} / {formatTime(plannedMinutes)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}