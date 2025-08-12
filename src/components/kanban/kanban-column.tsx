'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { KanbanCard } from './kanban-card'
import { MoreVertical, EyeOff, EyeIcon, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { KanbanCardComposer } from './kanban-card-composer'
import { Project, BigTask, SmallTask } from '@/types'
import { cn } from '@/lib/utils'
import { getProjectBackgroundColor, getProjectBorderColor, getProjectTextColor } from '@/lib/utils/project-colors'

interface KanbanColumnProps {
  bigTask: BigTask
  project?: Project
  tasks: SmallTask[]
  onCreateTask: (title: string) => Promise<void>
  onEditTask: (task: SmallTask) => void
  onDeleteTask: (task: SmallTask) => void
  onCompleteBigTask?: (bigTaskId: string) => void
}

export function KanbanColumn({
  bigTask,
  project,
  tasks,
  onCreateTask,
  onEditTask,
  onDeleteTask,
  onCompleteBigTask,
}: KanbanColumnProps) {
  // 完了タスクの表示/非表示を管理
  const [showCompleted, setShowCompleted] = useState(true)
  
  // 完了タスクの表示/非表示に基づいてタスクをフィルタリング
  const filteredTasks = showCompleted 
    ? tasks 
    : tasks.filter(task => task.status !== 'completed')
  // カラムのドラッグ用（外枠）
  const {
    attributes,
    listeners,
    setNodeRef: setSortableNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: bigTask.id,
    data: {
      type: 'column',
      bigTask,
    },
  })

  // カードのドロップ用（内側のカードリスト部分）
  const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({
    id: bigTask.id,
    data: {
      bigTaskId: bigTask.id,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // タスクの統計情報（将来的に使用する可能性があるため残す）
  // const completedCount = tasks.filter(task => task.status === 'completed').length
  // const pendingCount = tasks.filter(task => task.status === 'pending').length

  // プロジェクトカラーベースのスタイル
  const projectStyles = project?.color ? {
    backgroundColor: getProjectBackgroundColor(project.color),
    borderColor: getProjectBorderColor(project.color),
  } : undefined

  const projectHeaderColor = project?.color ? getProjectTextColor(project.color) : undefined

  return (
    <div
      ref={setSortableNodeRef}
      style={{ ...style, ...projectStyles }}
      className={cn(
        'flex w-[272px] flex-shrink-0 flex-col rounded-lg bg-muted/30 transition-colors h-fit',
        isDragging && 'cursor-grabbing'
      )}
    >
      <div className="px-3 py-2 relative">
        <div className="flex items-start justify-between">
          <div 
            className="flex-1 cursor-grab"
            {...attributes}
            {...listeners}
          >
            <div>
              <h3 
                className="text-sm font-semibold text-foreground"
                style={projectHeaderColor ? { color: projectHeaderColor } : undefined}
              >
                {bigTask.name}
              </h3>
              {project && (
                <div className="mt-1">
                  <span className="text-xs text-muted-foreground">{project.name}</span>
                </div>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-50 hover:opacity-100"
                aria-label="メニューを開く"
              >
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onCompleteBigTask && (
                <DropdownMenuItem onClick={() => onCompleteBigTask(bigTask.id)}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  大タスクを完了にする
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setShowCompleted(!showCompleted)}>
                {showCompleted ? (
                  <>
                    <EyeOff className="mr-2 h-4 w-4" />
                    完了タスクを非表示にする
                  </>
                ) : (
                  <>
                    <EyeIcon className="mr-2 h-4 w-4" />
                    完了タスクを表示する
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      <div 
        ref={setDroppableNodeRef}
        className={cn(
          "px-3 pb-2",
          isOver && 'bg-muted/10 rounded-lg'
        )}
      >
        <SortableContext
          items={filteredTasks.map(t => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
              {filteredTasks.map(task => (
                <KanbanCard
                  key={task.id}
                  task={task}
                  projectColor={project?.color}
                  onEdit={() => onEditTask(task)}
                  onDelete={() => onDeleteTask(task)}
                />
              ))}
            </div>
          </SortableContext>
        <div className="mt-2">
          <KanbanCardComposer
            bigTaskId={bigTask.id}
            projectId={project?.id}
            onCreateTask={onCreateTask}
          />
        </div>
      </div>
    </div>
  )
}