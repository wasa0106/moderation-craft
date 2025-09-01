/**
 * BigTaskList - Big tasks list component with table format
 * Displays list of big tasks in a table with inline editing via popover
 */

'use client'

import { useState } from 'react'
import { BigTask, UpdateBigTaskData } from '@/types'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { BigTaskEditPopover } from './big-task-edit-popover'
import { Edit2, Trash2, CheckCircle2, XCircle } from 'lucide-react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface BigTaskListProps {
  bigTasks: BigTask[]
  onUpdate: (params: { id: string; data: UpdateBigTaskData }) => Promise<BigTask>
  onDelete: (taskId: string) => void
  onStatusChange?: (taskId: string, status: 'completed' | 'active') => Promise<void>
  isLoading: boolean
}

export function BigTaskList({
  bigTasks,
  onUpdate,
  onDelete,
  onStatusChange,
  isLoading,
}: BigTaskListProps) {
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null)

  if (isLoading) {
    return <div className="text-center py-8">読み込み中...</div>
  }

  if (bigTasks.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">タスクがありません</p>
      </div>
    )
  }

  const getStatusLabel = (status: BigTask['status']) => {
    switch (status) {
      case 'active':
        return '実行中'
      case 'completed':
        return '完了'
      case 'cancelled':
        return 'キャンセル'
      default:
        return status
    }
  }

  const getStatusColor = (status: BigTask['status']) => {
    switch (status) {
      case 'active':
        return 'text-blue-600'
      case 'completed':
        return 'text-green-600'
      case 'cancelled':
        return 'text-muted-foreground'
      default:
        return ''
    }
  }

  const handleStatusChange = async (taskId: string, newStatus: 'completed' | 'active') => {
    if (!onStatusChange) return
    
    setUpdatingTaskId(taskId)
    try {
      await onStatusChange(taskId, newStatus)
    } finally {
      setUpdatingTaskId(null)
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[30%]">タスク名</TableHead>
          <TableHead className="w-[15%]">見積時間</TableHead>
          <TableHead className="w-[15%]">ステータス</TableHead>
          <TableHead className="w-[15%]">開始日</TableHead>
          <TableHead className="w-[15%]">終了日</TableHead>
          <TableHead className="w-[10%] text-right">アクション</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bigTasks.map(task => (
          <TableRow key={task.id}>
            <TableCell className="font-medium">{task.name}</TableCell>
            <TableCell>{task.estimated_hours}時間</TableCell>
            <TableCell>
              <span className={cn('font-medium', getStatusColor(task.status))}>
                {getStatusLabel(task.status)}
              </span>
            </TableCell>
            <TableCell>
              {task.start_date
                ? format(new Date(task.start_date), 'M/d', { locale: ja })
                : '-'}
            </TableCell>
            <TableCell>
              {task.end_date
                ? format(new Date(task.end_date), 'M/d', { locale: ja })
                : '-'}
            </TableCell>
            <TableCell>
              <div className="flex items-center justify-end gap-2">
                {onStatusChange && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleStatusChange(task.id, task.status === 'completed' ? 'active' : 'completed')}
                    disabled={updatingTaskId === task.id}
                    className={task.status === 'completed' ? 'text-orange-600 hover:text-orange-700' : 'text-green-600 hover:text-green-700'}
                    title={task.status === 'completed' ? '完了を取り消す' : 'タスクを完了にする'}
                  >
                    {task.status === 'completed' ? (
                      <XCircle className="h-4 w-4" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                  </Button>
                )}
                <BigTaskEditPopover
                  task={task}
                  onUpdate={onUpdate}
                  isOpen={editingTaskId === task.id}
                  onOpenChange={(open) => setEditingTaskId(open ? task.id : null)}
                >
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingTaskId(task.id)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </BigTaskEditPopover>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDelete(task.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}