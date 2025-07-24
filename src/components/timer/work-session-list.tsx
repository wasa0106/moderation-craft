/**
 * WorkSessionList - 作業セッション一覧表示コンポーネント
 */

import { WorkSession, SmallTask, Project } from '@/types'
import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Clock, Brain, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface WorkSessionListProps {
  sessions: WorkSession[]
  tasks: SmallTask[]
  projects: Project[]
}

export function WorkSessionList({ sessions, tasks, projects }: WorkSessionListProps) {
  // タスク情報を取得
  const getTaskInfo = (taskId?: string) => {
    if (!taskId) return null
    const task = tasks.find(t => t.id === taskId)
    if (!task) return null
    const project = projects.find(p => p.id === task.project_id)
    return { task, project }
  }

  // セッションの時間を計算
  const getDuration = (session: WorkSession): number => {
    if (!session.end_time) return 0
    const start = parseISO(session.start_time)
    const end = parseISO(session.end_time)
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60))
  }

  // 集中力レベルの色を取得
  const getFocusColor = (level?: number): string => {
    if (!level) return 'text-gray-400'
    if (level >= 8) return 'text-purple-600'
    if (level >= 6) return 'text-blue-600'
    if (level >= 4) return 'text-green-600'
    return 'text-orange-600'
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        本日の作業実績はまだありません
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {sessions.map(session => {
        const taskInfo = getTaskInfo(session.small_task_id)
        const duration = getDuration(session)
        const isCompleted = !!session.end_time

        return (
          <div
            key={session.id}
            className={cn(
              'p-4 rounded-lg border transition-colors',
              isCompleted ? 'bg-muted/30' : 'bg-primary/5 border-primary'
            )}
          >
            {taskInfo ? (
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium">{taskInfo.task.name}</h4>
                    {taskInfo.project && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {taskInfo.project.name}
                      </p>
                    )}
                  </div>
                  {isCompleted && (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  )}
                </div>
              </div>
            ) : (
              <div>
                <h4 className="font-medium text-muted-foreground">タスクなし</h4>
              </div>
            )}

            <div className="flex items-center gap-4 mt-3 text-sm">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>
                  {format(parseISO(session.start_time), 'HH:mm')}
                  {session.end_time && ` - ${format(parseISO(session.end_time), 'HH:mm')}`}
                </span>
              </div>

              {duration > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {duration}分
                </Badge>
              )}

              {session.focus_level && (
                <div className="flex items-center gap-1">
                  <Brain className={cn('h-3 w-3', getFocusColor(session.focus_level))} />
                  <span className={cn('font-medium', getFocusColor(session.focus_level))}>
                    {session.focus_level}
                  </span>
                </div>
              )}
            </div>

            {session.mood_notes && (
              <p className="text-sm text-muted-foreground mt-2 italic">
                "{session.mood_notes}"
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}