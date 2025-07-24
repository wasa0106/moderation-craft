/**
 * SmallTaskList - Small tasks list component (placeholder)
 * Displays list of small tasks with actions
 */

import { SmallTask, BigTask } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'

interface SmallTaskListProps {
  smallTasks: SmallTask[]
  bigTasks: BigTask[]
  onEdit: (task: SmallTask) => void
  onDelete: (taskId: string) => void
  isLoading: boolean
}

export function SmallTaskList({
  smallTasks,
  bigTasks,
  onEdit,
  onDelete,
  isLoading,
}: SmallTaskListProps) {
  if (isLoading) {
    return <div className="text-center py-8">読み込み中...</div>
  }

  if (smallTasks.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">小タスクがありません</p>
      </div>
    )
  }

  const getBigTaskName = (bigTaskId: string) => {
    const bigTask = bigTasks.find(task => task.id === bigTaskId)
    return bigTask?.name || '不明なタスク'
  }

  return (
    <div className="space-y-4">
      {smallTasks.map(task => (
        <div key={task.id} className="border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium">{task.name}</h3>
                <Badge
                  variant={task.actual_minutes && task.actual_minutes > 0 ? 'default' : 'outline'}
                >
                  {task.actual_minutes && task.actual_minutes > 0 ? '完了' : '未完了'}
                </Badge>
                {task.is_emergency && <Badge variant="destructive">緊急</Badge>}
              </div>
              <p className="text-sm text-gray-500">{getBigTaskName(task.big_task_id)}</p>
              <p className="text-sm text-gray-500">
                {format(parseISO(task.scheduled_start), 'MM/dd HH:mm', { locale: ja })} -
                {format(parseISO(task.scheduled_end), 'HH:mm', { locale: ja })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => onEdit(task)}>
                編集
              </Button>
              <Button size="sm" variant="destructive" onClick={() => onDelete(task.id)}>
                削除
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
