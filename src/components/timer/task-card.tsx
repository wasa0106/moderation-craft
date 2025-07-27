/**
 * TaskCard - タスクカードコンポーネント（状態管理ボタン付き）
 */

import { SmallTask, Project, WorkSession } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getTaskDisplayInfo } from '@/lib/utils/task-session-utils'
import { smallTaskRepository } from '@/lib/db/repositories'
import { useToast } from '@/hooks/use-toast'
import { useState } from 'react'

interface TaskCardProps {
  task: SmallTask
  project?: Project | null
  sessions: WorkSession[]
  isActive?: boolean
  onClick?: () => void
  onStatusChange?: () => void
  showButtons?: boolean
}

export function TaskCard({
  task,
  project,
  sessions,
  isActive = false,
  onClick,
  onStatusChange,
  showButtons = true,
}: TaskCardProps) {
  const { toast } = useToast()
  const [isUpdating, setIsUpdating] = useState(false)
  
  const displayInfo = getTaskDisplayInfo(task, sessions)
  const status = task.status || 'pending'
  
  // プロジェクトの色を取得
  const getProjectGradient = (): string => {
    if (status === 'completed') return 'from-blue-900 to-blue-950'
    if (status === 'cancelled') return 'from-gray-400 to-gray-500'
    
    // pending状態の色分け
    if (!project?.id) return 'from-gray-400 to-gray-500'
    
    const colors = [
      'from-blue-500 to-blue-600',
      'from-green-500 to-green-600',
      'from-purple-500 to-purple-600',
      'from-orange-500 to-orange-600',
    ]
    const index = Math.abs(project.id.charCodeAt(0)) % colors.length
    return colors[index]
  }
  
  const handleStatusChange = async (newStatus: 'completed' | 'cancelled') => {
    const confirmMessages = {
      completed: `「${task.name}」を完了にしますか？`,
      cancelled: `「${task.name}」を不要にしますか？\n作業履歴は保持されます。`,
    }
    
    if (!confirm(confirmMessages[newStatus])) return
    
    setIsUpdating(true)
    try {
      await smallTaskRepository.updateTaskStatus(
        task.id,
        newStatus,
        { endActiveSession: newStatus === 'completed' && displayInfo.hasActiveSession }
      )
      
      toast({
        title: newStatus === 'completed' ? 'タスクを完了しました' : 'タスクを不要にしました',
        description: task.name,
      })
      
      onStatusChange?.()
    } catch (error) {
      console.error('Failed to update task status:', error)
      toast({
        title: 'エラー',
        description: '状態の更新に失敗しました',
        variant: 'destructive',
      })
    } finally {
      setIsUpdating(false)
    }
  }
  
  const handleRevertStatus = async () => {
    if (!confirm(`「${task.name}」を未完了に戻しますか？`)) return
    
    setIsUpdating(true)
    try {
      await smallTaskRepository.updateTaskStatus(task.id, 'pending')
      
      toast({
        title: 'タスクを未完了に戻しました',
        description: task.name,
      })
      
      onStatusChange?.()
    } catch (error) {
      console.error('Failed to revert task status:', error)
      toast({
        title: 'エラー',
        description: '状態の更新に失敗しました',
        variant: 'destructive',
      })
    } finally {
      setIsUpdating(false)
    }
  }
  
  return (
    <div
      className={cn(
        'relative rounded-lg transition-all',
        'hover:shadow-md',
        isActive && 'ring-2 ring-primary ring-offset-1',
        status === 'completed' && 'opacity-80',
        status === 'cancelled' && 'opacity-60',
        onClick && 'cursor-pointer'
      )}
      onClick={onClick}
    >
      <div
        className={cn(
          'h-full rounded-md p-3 text-white overflow-hidden shadow-sm',
          'bg-gradient-to-r',
          getProjectGradient()
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate">{task.name}</h4>
            {project && (
              <p className="text-xs opacity-80 truncate">{project.name}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {task.is_emergency && (
              <Badge variant="destructive" className="text-xs">
                緊急
              </Badge>
            )}
            <Badge 
              variant="secondary" 
              className={cn(
                "text-xs",
                displayInfo.hasActiveSession && "bg-blue-200 text-blue-800"
              )}
            >
              {displayInfo.statusText}
            </Badge>
          </div>
        </div>
        
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2 text-xs opacity-80">
            <Clock className="h-3 w-3" />
            <span>{task.estimated_minutes}分</span>
            {displayInfo.progressText && (
              <>
                <span>•</span>
                <span>{displayInfo.progressText}</span>
              </>
            )}
          </div>
          
          {showButtons && status === 'pending' && (
            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs bg-white/20 hover:bg-white/30 text-white"
                onClick={() => handleStatusChange('completed')}
                disabled={isUpdating}
              >
                <Check className="h-3 w-3 mr-1" />
                完了
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs bg-white/20 hover:bg-white/30 text-white"
                onClick={() => handleStatusChange('cancelled')}
                disabled={isUpdating}
              >
                <X className="h-3 w-3 mr-1" />
                不要
              </Button>
            </div>
          )}
          
          {showButtons && (status === 'completed' || status === 'cancelled') && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs bg-white/20 hover:bg-white/30 text-white"
              onClick={handleRevertStatus}
              disabled={isUpdating}
            >
              元に戻す
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}