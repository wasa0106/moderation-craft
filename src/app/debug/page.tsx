'use client'

import { useProjects } from '@/hooks/use-projects'
import { useBigTasks } from '@/hooks/use-big-tasks'
import { useSmallTasks, useSmallTasksByDateRange } from '@/hooks/use-small-tasks'
import { useState, useEffect } from 'react'
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns'
import { ja } from 'date-fns/locale'

export default function DebugPage() {
  const userId = 'current-user'
  const { projects } = useProjects(userId)
  const { bigTasks } = useBigTasks(userId)
  const { smallTasks: allSmallTasks } = useSmallTasks(userId)
  const [currentWeek, setCurrentWeek] = useState<Date | null>(null)

  // Initialize currentWeek on client side
  useEffect(() => {
    if (!currentWeek) {
      setCurrentWeek(new Date())
    }
  }, [])

  const weekStart = currentWeek ? startOfWeek(currentWeek, { weekStartsOn: 1 }) : new Date()
  const weekEnd = currentWeek ? endOfWeek(currentWeek, { weekStartsOn: 1 }) : new Date()
  const weekStartStr = format(weekStart, 'yyyy-MM-dd')
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd')

  const { smallTasks: weekSmallTasks } = useSmallTasksByDateRange(userId, weekStartStr, weekEndStr)

  const filteredTasks = bigTasks.filter(task => {
    const taskStart = new Date(task.start_date)
    const taskEnd = new Date(task.end_date)

    return (
      (taskStart >= weekStart && taskStart <= weekEnd) ||
      (taskEnd >= weekStart && taskEnd <= weekEnd) ||
      (taskStart <= weekStart && taskEnd >= weekEnd)
    )
  })

  return (
    <div className="p-8 bg-background min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-foreground">デバッグ情報</h1>

      <div className="mb-6 p-4 bg-card rounded-lg border border-border">
        <h2 className="text-xl font-semibold mb-2">現在の週</h2>
        <div className="flex items-center gap-4 mb-2">
          <button
            onClick={() =>
              currentWeek && setCurrentWeek(prev => (prev ? subWeeks(prev, 1) : new Date()))
            }
            className="px-3 py-1 bg-primary text-primary-foreground rounded"
          >
            前週
          </button>
          <span>
            {format(weekStart, 'yyyy年M月d日', { locale: ja })} -{' '}
            {format(weekEnd, 'M月d日', { locale: ja })}
          </span>
          <button
            onClick={() =>
              currentWeek && setCurrentWeek(prev => (prev ? addWeeks(prev, 1) : new Date()))
            }
            className="px-3 py-1 bg-primary text-primary-foreground rounded"
          >
            次週
          </button>
        </div>
        <p>フィルタリング結果: {filteredTasks.length}件</p>
      </div>

      <div className="mb-6 p-4 bg-card rounded-lg border border-border">
        <h2 className="text-xl font-semibold mb-2">プロジェクト ({projects.length}件)</h2>
        {projects.map(project => (
          <div key={project.id} className="mb-2 p-2 bg-muted">
            <p>
              <strong>{project.name}</strong>
            </p>
            <p className="text-sm">ID: {project.id}</p>
            <p className="text-sm">作成日: {project.created_at}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 p-4 bg-card rounded-lg border border-border">
        <h2 className="text-xl font-semibold mb-2">BigTasks ({bigTasks.length}件)</h2>
        {bigTasks.map((task, index) => (
          <div key={task.id} className="mb-3 p-3 bg-muted rounded">
            <p className="font-semibold">
              {index + 1}. {task.name}
            </p>
            <div className="text-sm mt-1">
              <p>プロジェクトID: {task.project_id}</p>
              <p>
                期間: {task.start_date} 〜 {task.end_date}
              </p>
              <p>予定開始日: {task.start_date}</p>
              <p>予定終了日: {task.end_date}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-6 p-4 bg-card rounded-lg border border-border">
        <h2 className="text-xl font-semibold mb-2">
          SmallTasks - すべて ({allSmallTasks.length}件)
        </h2>
        <div className="max-h-60 overflow-y-auto">
          {allSmallTasks.map((task, index) => (
            <div key={task.id} className="mb-2 p-2 bg-muted text-sm">
              <p className="font-semibold">
                {index + 1}. {task.name}
              </p>
              <div className="text-xs mt-1">
                <p>ID: {task.id}</p>
                <p>プロジェクトID: {task.project_id}</p>
                <p>BigTaskID: {task.big_task_id}</p>
                <p>推定時間: {task.estimated_minutes}分</p>
                <p className={task.scheduled_start ? 'text-primary' : 'text-destructive'}>
                  開始時刻: {task.scheduled_start || '未スケジュール'}
                </p>
                <p className={task.scheduled_end ? 'text-primary' : 'text-destructive'}>
                  終了時刻: {task.scheduled_end || '未スケジュール'}
                </p>
                {task.scheduled_start && (
                  <p>
                    開始日時:{' '}
                    {format(new Date(task.scheduled_start), 'yyyy-MM-dd HH:mm', { locale: ja })}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6 p-4 bg-card rounded-lg border border-border">
        <h2 className="text-xl font-semibold mb-2">
          SmallTasks - 今週 ({weekSmallTasks.length}件)
        </h2>
        <p className="text-sm text-muted-foreground mb-2">
          期間: {weekStartStr} ~ {weekEndStr}
        </p>
        <div className="max-h-60 overflow-y-auto">
          {weekSmallTasks.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">今週のSmallTaskはありません</p>
          ) : (
            weekSmallTasks.map((task, index) => {
              const project = projects.find(p => p.id === task.project_id)
              const bigTask = bigTasks.find(bt => bt.id === task.big_task_id)
              return (
                <div key={task.id} className="mb-2 p-2 bg-muted text-sm">
                  <p className="font-semibold">
                    {index + 1}. {task.name}
                  </p>
                  <div className="text-xs mt-1">
                    <p>プロジェクト: {project?.name || '不明'}</p>
                    <p>BigTask: {bigTask?.name || '不明'}</p>
                    <p>推定時間: {task.estimated_minutes}分</p>
                    {task.scheduled_start && (
                      <p className="text-primary">
                        スケジュール: {format(new Date(task.scheduled_start), 'M/d HH:mm')} -
                        {format(new Date(task.scheduled_end!), 'HH:mm')}
                      </p>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
