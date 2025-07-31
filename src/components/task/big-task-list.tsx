/**
 * BigTaskList - Big tasks list component (placeholder)
 * Displays list of big tasks with actions
 */

import { BigTask } from '@/types'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

interface BigTaskListProps {
  bigTasks: BigTask[]
  onEdit: (task: BigTask) => void
  onDelete: (taskId: string) => void
  onCreateSmallTask: (bigTaskId: string) => void
  isLoading: boolean
}

export function BigTaskList({
  bigTasks,
  onEdit,
  onDelete,
  onCreateSmallTask,
  isLoading,
}: BigTaskListProps) {
  if (isLoading) {
    return <div className="text-center py-8">読み込み中...</div>
  }

  if (bigTasks.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">大タスクがありません</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {bigTasks.map(task => (
        <div key={task.id} className="border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">{task.name}</h3>
              <p className="text-sm text-muted-foreground">{task.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => onEdit(task)}>
                編集
              </Button>
              <Button size="sm" variant="outline" onClick={() => onCreateSmallTask(task.id)}>
                <Plus className="h-4 w-4 mr-1" />
                小タスク
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
