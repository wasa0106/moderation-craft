/**
 * ProjectCard - Displays project information in a card format
 * Shows project details, progress, and quick actions
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Calendar, Clock, Target, MoreHorizontal, Play, Edit, Trash2, Copy } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Project } from '@/types'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

interface ProjectCardProps {
  project: Project
  onEdit?: (project: Project) => void
  onDelete?: (project: Project) => void
  onDuplicate?: (project: Project) => void
  onViewTasks?: (project: Project) => void
  className?: string
}

export function ProjectCard({
  project,
  onEdit,
  onDelete,
  onDuplicate,
  onViewTasks,
  className,
}: ProjectCardProps) {
  const getStatusColor = (status: Project['status']) => {
    switch (status) {
      case 'active':
        return 'bg-primary text-primary-foreground'
      case 'completed':
        return 'bg-muted text-muted-foreground'
      default:
        return 'bg-secondary text-secondary-foreground'
    }
  }

  const getStatusLabel = (status: Project['status']) => {
    switch (status) {
      case 'active':
        return 'アクティブ'
      case 'completed':
        return '完了'
      default:
        return status
    }
  }

  const isOverdue = () => {
    if (!project.deadline) return false
    return new Date(project.deadline) < new Date() && project.status !== 'completed'
  }

  const getDaysUntilDeadline = () => {
    if (!project.deadline) return null
    const deadline = new Date(project.deadline)
    const now = new Date()
    const diffTime = deadline.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const daysUntilDeadline = getDaysUntilDeadline()
  const isDeadlineClose =
    daysUntilDeadline !== null && daysUntilDeadline <= 7 && daysUntilDeadline > 0

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Card
          className={cn(
            'hover:shadow-sm transition-shadow duration-200',
            isOverdue() && 'border-destructive/50',
            isDeadlineClose && 'border-warning/50',
            className
          )}
        >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold line-clamp-1">{project.name}</CardTitle>
            <Badge className={cn('mt-2', getStatusColor(project.status))}>
              {getStatusLabel(project.status)}
            </Badge>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onViewTasks && (
                <DropdownMenuItem onClick={() => onViewTasks(project)}>
                  <Play className="h-4 w-4 mr-2" />
                  詳細を見る
                </DropdownMenuItem>
              )}
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(project)}>
                  <Edit className="h-4 w-4 mr-2" />
                  編集
                </DropdownMenuItem>
              )}
              {onDuplicate && (
                <DropdownMenuItem onClick={() => onDuplicate(project)}>
                  <Copy className="h-4 w-4 mr-2" />
                  複製
                </DropdownMenuItem>
              )}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(project)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    削除
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Goal */}
        <div className="flex items-start gap-2">
          <Target className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground line-clamp-2">{project.goal}</p>
        </div>

        {/* Deadline */}
        {project.deadline && (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span
              className={cn(
                'text-sm',
                isOverdue() && 'text-destructive font-medium',
                isDeadlineClose && '[color:hsl(var(--warning))] font-medium'
              )}
            >
              {format(new Date(project.deadline), 'yyyy/MM/dd')}
              {daysUntilDeadline !== null && (
                <span className="ml-1">
                  {daysUntilDeadline > 0
                    ? `(あと${daysUntilDeadline}日)`
                    : daysUntilDeadline === 0
                      ? '(今日)'
                      : `(${Math.abs(daysUntilDeadline)}日超過)`}
                </span>
              )}
            </span>
          </div>
        )}

        {/* Progress (placeholder - would be calculated from tasks) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">進捗</span>
            <span className="text-muted-foreground">0%</span>
          </div>
          <Progress value={0} className="h-2" />
        </div>

        {/* Created date */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>作成日: {format(new Date(project.created_at), 'yyyy/MM/dd')}</span>
        </div>

        {/* Quick action button */}
        {onViewTasks && (
          <Button onClick={() => onViewTasks(project)} className="w-full" size="sm">
            <Play className="h-4 w-4 mr-2" />
            詳細を見る
          </Button>
        )}
      </CardContent>
        </Card>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {onViewTasks && (
          <ContextMenuItem onClick={() => onViewTasks(project)}>
            <Play className="h-4 w-4 mr-2" />
            詳細を見る
          </ContextMenuItem>
        )}
        {onEdit && (
          <ContextMenuItem onClick={() => onEdit(project)}>
            <Edit className="h-4 w-4 mr-2" />
            編集
          </ContextMenuItem>
        )}
        {onDuplicate && (
          <ContextMenuItem onClick={() => onDuplicate(project)}>
            <Copy className="h-4 w-4 mr-2" />
            複製
          </ContextMenuItem>
        )}
        {onDelete && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => onDelete(project)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              削除
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
