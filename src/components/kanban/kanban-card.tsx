'use client'

import { memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreVertical, Edit, Trash2, Clock, CheckCircle2, Circle } from 'lucide-react'
import { SmallTask } from '@/types'
import { cn } from '@/lib/utils'
import { getProjectBorderColor, getProjectOverlayColor } from '@/lib/utils/project-colors'

interface KanbanCardProps {
  task: SmallTask
  projectColor?: string
  onEdit?: () => void
  onDelete?: () => void
  isDragging?: boolean
}

export const KanbanCard = memo(function KanbanCard({
  task,
  projectColor,
  onEdit,
  onDelete,
  isDragging = false,
}: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: task.id,
    data: {
      task,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || isSortableDragging ? 0.5 : 1,
  }

  // ステータスアイコンの取得
  const getStatusIcon = () => {
    switch (task.status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-primary" />
      case 'cancelled':
        return <Circle className="h-4 w-4 text-muted-foreground line-through" />
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />
    }
  }

  // 時間表示のフォーマット
  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return mins > 0 ? `${hours}時間${mins}分` : `${hours}時間`
    }
    return `${mins}分`
  }

  // プロジェクトカラーベースのスタイル
  const cardStyles = projectColor ? {
    borderLeft: `3px solid ${getProjectBorderColor(projectColor)}`,
  } : undefined

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, ...cardStyles }}
      className={cn(
        'mb-2 cursor-move rounded-lg bg-background border border-border py-2 px-2.5 shadow-sm transition-all hover:shadow',
        task.status === 'completed' && 'opacity-60',
        task.is_emergency && 'ring-1 ring-destructive'
      )}
      {...attributes}
      {...listeners}
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 space-y-1">
            <div className="flex items-start gap-2">
              {getStatusIcon()}
              <p className={cn(
                'text-sm font-medium leading-tight text-foreground',
                task.status === 'completed' && 'line-through'
              )}>
                {task.name}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
              {task.estimated_minutes > 0 && (
                <Badge variant="secondary" className="h-5 gap-1 px-1.5 text-[10px] bg-muted/60">
                  <Clock className="h-3 w-3" />
                  {formatMinutes(task.estimated_minutes)}
                </Badge>
              )}
              
              {task.is_emergency && (
                <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                  緊急
                </Badge>
              )}
            </div>
          </div>

          {(onEdit || onDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-3 w-3" />
                  <span className="sr-only">メニューを開く</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && (
                  <DropdownMenuItem onClick={onEdit}>
                    <Edit className="mr-2 h-4 w-4" />
                    編集
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem 
                    onClick={onDelete}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    削除
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  )
})