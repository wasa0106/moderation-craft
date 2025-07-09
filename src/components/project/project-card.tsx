/**
 * ProjectCard - Displays project information in a card format
 * Shows project details, progress, and quick actions
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { 
  Calendar, 
  Clock, 
  Target, 
  MoreHorizontal, 
  Play, 
  Edit, 
  Trash2,
  Copy
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
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
  className 
}: ProjectCardProps) {
  const getStatusColor = (status: Project['status']) => {
    switch (status) {
      case 'planning':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'completed':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'paused':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusLabel = (status: Project['status']) => {
    switch (status) {
      case 'planning':
        return '計画中'
      case 'active':
        return 'アクティブ'
      case 'completed':
        return '完了'
      case 'paused':
        return '一時停止'
      case 'cancelled':
        return 'キャンセル'
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
  const isDeadlineClose = daysUntilDeadline !== null && daysUntilDeadline <= 7 && daysUntilDeadline > 0

  return (
    <Card className={cn(
      'hover:shadow-md transition-shadow duration-200',
      isOverdue() && 'border-red-200 bg-red-50',
      isDeadlineClose && 'border-yellow-200 bg-yellow-50',
      className
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold line-clamp-1">
              {project.name}
            </CardTitle>
            <Badge 
              variant="secondary" 
              className={cn('mt-2', getStatusColor(project.status))}
            >
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
                  タスク管理
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
                    className="text-red-600 focus:text-red-600"
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
          <p className="text-sm text-muted-foreground line-clamp-2">
            {project.goal}
          </p>
        </div>

        {/* Deadline */}
        {project.deadline && (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className={cn(
              'text-sm',
              isOverdue() && 'text-red-600 font-medium',
              isDeadlineClose && 'text-yellow-600 font-medium'
            )}>
              {format(new Date(project.deadline), 'yyyy/MM/dd')}
              {daysUntilDeadline !== null && (
                <span className="ml-1">
                  {daysUntilDeadline > 0 
                    ? `(あと${daysUntilDeadline}日)`
                    : daysUntilDeadline === 0 
                    ? '(今日)'
                    : `(${Math.abs(daysUntilDeadline)}日超過)`
                  }
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
        {onViewTasks && project.status === 'active' && (
          <Button 
            onClick={() => onViewTasks(project)}
            className="w-full"
            size="sm"
          >
            <Play className="h-4 w-4 mr-2" />
            タスク管理を開く
          </Button>
        )}
      </CardContent>
    </Card>
  )
}