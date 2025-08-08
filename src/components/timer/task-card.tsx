/**
 * TaskCard - タスクカードコンポーネント（状態管理ボタン付き）
 */

import React from 'react'
import { SmallTask, Project, WorkSession } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Check, X, Play, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getTaskDisplayInfo } from '@/lib/utils/task-session-utils'
import { smallTaskRepository } from '@/lib/db/repositories'
import { useToast } from '@/hooks/use-toast'
import { useState } from 'react'
import { format } from 'date-fns'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface TaskCardProps {
  task: SmallTask
  project?: Project | null
  sessions: WorkSession[]
  isActive?: boolean
  onClick?: () => void
  onStatusChange?: () => void
  onStartTask?: () => void
  showButtons?: boolean
  compact?: boolean
  style?: React.CSSProperties
}

function TaskCardComponent({
  task,
  project,
  sessions,
  isActive = false,
  onClick,
  onStatusChange,
  onStartTask,
  showButtons = true,
  compact = false,
  style,
}: TaskCardProps) {
  const { toast } = useToast()
  const [isUpdating, setIsUpdating] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)

  const displayInfo = getTaskDisplayInfo(task, sessions)
  const status = task.status || 'pending'

  // HSLカラーを調整する関数（彩度18%、明度82%に設定）
  const adjustHSLForBackground = (hslColor: string): string => {
    const match = hslColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)
    if (!match) return hslColor

    const [, hue] = match
    return `hsl(${hue}, 18%, 82%)`
  }

  // タスクのカードスタイルを取得
  const getCardStyle = (): { className: string; style?: React.CSSProperties } => {
    // キャンセルの場合
    if (status === 'cancelled')
      return {
        className:
          'bg-muted/10 text-muted-foreground border-0 border-l-4 border-l-muted-foreground/20',
      }

    // 作業中の場合
    if (displayInfo.hasActiveSession) {
      if (project?.color) {
        // プロジェクトカラーを使用（より鮮やかに）
        return {
          className: 'text-white border-0 border-l-4',
          style: {
            backgroundColor: project.color,
            borderLeftColor: project.color,
            filter: 'brightness(1.1) saturate(1.2)', // 明るく鮮やかにして強調
          },
        }
      }
      // プロジェクトがない場合はデフォルト
      return {
        className:
          'bg-primary text-primary-foreground border-0 border-l-4 border-l-primary-foreground',
      }
    }

    // プロジェクトカラーがある場合
    if (project?.color) {
      // 完了状態の場合は元の色を使用
      if (status === 'completed') {
        return {
          className: 'text-white border-0 border-l-4',
          style: {
            backgroundColor: project.color,
            borderLeftColor: project.color,
          },
        }
      }
      // 通常状態の場合は調整した色を使用
      return {
        className: 'text-foreground border-0 border-l-4',
        style: {
          backgroundColor: adjustHSLForBackground(project.color),
          borderLeftColor: project.color,
        },
      }
    }

    // 完了状態でプロジェクトがない場合
    if (status === 'completed') {
      return {
        className: 'text-foreground border-0 border-l-4',
        style: {
          backgroundColor: 'hsl(137, 2%, 96%)',
          borderLeftColor: 'hsl(137, 8%, 15%)',
        },
      }
    }

    // デフォルト（通常状態でプロジェクトがない）
    return {
      className: 'border-0 border-l-4',
      style: {
        backgroundColor: 'hsl(137, 2%, 96%)',
        borderLeftColor: 'hsl(137, 8%, 15%)',
      },
    }
  }

  const handleStatusChange = async (newStatus: 'completed' | 'cancelled') => {
    setIsUpdating(true)
    try {
      await smallTaskRepository.updateTaskStatus(task.id, newStatus, {
        endActiveSession: newStatus === 'completed' && displayInfo.hasActiveSession,
      })

      toast({
        title: newStatus === 'completed' ? 'タスクを完了しました' : 'タスクを不要にしました',
        description: task.name,
      })

      setPopoverOpen(false)
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
    setIsUpdating(true)
    try {
      await smallTaskRepository.updateTaskStatus(task.id, 'pending')

      toast({
        title: 'タスクを未完了に戻しました',
        description: task.name,
      })

      setPopoverOpen(false)
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

  const handleStartTask = () => {
    setPopoverOpen(false)
    onStartTask?.()
  }

  // タスクの長さに基づいてパディングとフォントサイズを調整
  // タスクの長さに基づいてパディングとフォントサイズを調整
  const getDynamicStyles = () => {
    if (compact || task.estimated_minutes <= 30) {
      return {
        padding: 'p-0.5',
        titleSize: 'text-xs',
        badgeSize: 'text-[10px]',
        timeSize: 'text-[10px]',
        buttonSize: 'h-5 px-1 text-[10px]',
        iconSize: 'h-2.5 w-2.5',
      }
    } else if (task.estimated_minutes <= 60) {
      return {
        padding: 'p-1',
        titleSize: 'text-xs',
        badgeSize: 'text-[11px]',
        timeSize: 'text-[11px]',
        buttonSize: 'h-5 px-1.5 text-[11px]',
        iconSize: 'h-3 w-3',
      }
    } else {
      return {
        padding: 'p-1.5',
        titleSize: 'text-sm',
        badgeSize: 'text-xs',
        timeSize: 'text-xs',
        buttonSize: 'h-6 px-2 text-xs',
        iconSize: 'h-3 w-3',
      }
    }
  }

  // 時刻表示をフォーマット
  const formatTimeRange = (short = false) => {
    const start = new Date(task.scheduled_start)
    const end = new Date(task.scheduled_end)
    if (short) {
      return `${format(start, 'HH:mm')}-${format(end, 'HH:mm')}`
    }
    return `${format(start, 'HH:mm')} ~ ${format(end, 'HH:mm')}`
  }

  const styles = getDynamicStyles()
  const cardStyle = getCardStyle()

  // レイアウトを決定（タスクの長さとタスク名の長さに基づく）
  const shouldShowTimeOnSecondLine = task.estimated_minutes > 45
  const shouldShowTime = task.name.length <= 20 || shouldShowTimeOnSecondLine

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Card
          className={cn(
            'relative transition-all rounded-sm box-border',
            styles.padding,
            'hover:shadow-sm hover:bg-surface-2',
            isActive && 'ring-2 ring-offset-1',
            status === 'completed' && 'opacity-80',
            status === 'cancelled' && 'opacity-60',
            'cursor-pointer',
            cardStyle.className
          )}
          style={{ 
            ...cardStyle.style, 
            ...style,
            ...(isActive && project?.color ? { 
              boxShadow: `0 0 0 2px ${project.color}, 0 0 0 3px white` 
            } : {})
          }}
          onClick={e => {
            if (!showButtons) {
              e.stopPropagation()
              onClick?.()
            }
          }}
        >
          {shouldShowTimeOnSecondLine ? (
            // 2行表示パターン（高さが十分な場合）
            <div className="flex flex-col gap-0.5">
              <div className="flex items-start justify-between gap-1">
                <div className="flex-1 min-w-0">
                  <h4 className={cn('font-medium truncate', styles.titleSize)}>{task.name}</h4>
                </div>
                <div className="flex items-center gap-0.5">
                  {task.is_emergency && (
                    <Badge variant="destructive" className={styles.badgeSize}>
                      緊急
                    </Badge>
                  )}
                </div>
              </div>
              <div
                className={cn(
                  status === 'completed' && project?.color ? 'text-white' : 'text-muted-foreground',
                  styles.timeSize
                )}
              >
                {formatTimeRange()}
              </div>
            </div>
          ) : (
            // 1行表示パターン（高さが不足の場合）
            <div className="flex items-center justify-between gap-1">
              <div className="flex-1 min-w-0 flex items-center gap-1">
                <h4 className={cn('font-medium truncate', styles.titleSize)}>{task.name}</h4>
                {shouldShowTime && (
                  <span
                    className={cn(
                      status === 'completed' && project?.color
                        ? 'text-white'
                        : 'text-muted-foreground',
                      'whitespace-nowrap',
                      styles.timeSize
                    )}
                  >
                    {formatTimeRange(true)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-0.5">
                {task.is_emergency && (
                  <Badge variant="destructive" className={styles.badgeSize}>
                    緊急
                  </Badge>
                )}
              </div>
            </div>
          )}
        </Card>
      </PopoverTrigger>
      {showButtons && (
        <PopoverContent className="w-56" align="start" onClick={e => e.stopPropagation()}>
          <div className="flex flex-col gap-2">
            {status === 'pending' && (
              <>
                {onStartTask && !displayInfo.hasActiveSession && (
                  <Button
                    variant="default"
                    className="w-full justify-start"
                    onClick={handleStartTask}
                    disabled={isUpdating}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    タスクを開始
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleStatusChange('completed')}
                  disabled={isUpdating}
                >
                  <Check className="mr-2 h-4 w-4" />
                  完了にする
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleStatusChange('cancelled')}
                  disabled={isUpdating}
                >
                  <X className="mr-2 h-4 w-4" />
                  不要にする
                </Button>
              </>
            )}
            {(status === 'completed' || status === 'cancelled') && (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleRevertStatus}
                disabled={isUpdating}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                元に戻す
              </Button>
            )}
          </div>
        </PopoverContent>
      )}
    </Popover>
  )
}

export const TaskCard = React.memo(TaskCardComponent)
