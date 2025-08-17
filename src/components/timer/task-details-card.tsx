/**
 * TaskDetailsCard - タスク詳細を表示・編集するカードのラッパー
 */

'use client'

import { SmallTask } from '@/types'
import { TaskDetailsForm } from './task-details-form'
import { useTimerStore } from '@/stores/timer-store'

interface TaskDetailsCardProps {
  dayTasks: SmallTask[]
  currentTask?: SmallTask | null
  onTaskUpdate?: (task: SmallTask) => void
}

export function TaskDetailsCard({
  dayTasks,
  currentTask,
  onTaskUpdate,
}: TaskDetailsCardProps) {
  // タイマーストアから実行中のタスクを取得
  const { activeSession } = useTimerStore()
  
  // currentTaskを優先的に使用し、ない場合のみactiveSessionから検索
  // これにより、編集中にタスクが消えることを防ぐ
  const activeTask = currentTask || 
    (activeSession?.small_task_id && !currentTask ? 
      dayTasks.find(t => t.id === activeSession.small_task_id) : null)

  return (
    <TaskDetailsForm 
      task={activeTask || null}
      onUpdate={onTaskUpdate}
      className="border-0 shadow-none p-0"
    />
  )
}