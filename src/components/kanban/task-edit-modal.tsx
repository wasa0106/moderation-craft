'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SmallTask, BigTask, CreateSmallTaskData, UpdateSmallTaskData } from '@/types'
import { useQuery } from '@tanstack/react-query'
import { bigTaskRepository } from '@/lib/db/repositories'
import { generateId } from '@/lib/utils'

interface TaskEditModalProps {
  task: SmallTask | null
  bigTaskId?: string
  projectId: string
  open: boolean
  onClose: () => void
  onSave: (data: Omit<CreateSmallTaskData, 'user_id' | 'project_id'> | UpdateSmallTaskData) => void
}

export function TaskEditModal({
  task,
  bigTaskId,
  projectId,
  open,
  onClose,
  onSave,
}: TaskEditModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    estimated_minutes: 0, // カンバンタスクは未スケジュール
    status: 'pending' as SmallTask['status'],
    is_emergency: false,
    big_task_id: bigTaskId || '',
  })

  // BigTasksを取得
  const { data: bigTasks } = useQuery({
    queryKey: ['big-tasks', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const tasks = await bigTaskRepository.getByProjectId(projectId)
      return tasks.filter(t => t.status === 'active')
    },
    enabled: !!projectId && open,
  })

  useEffect(() => {
    if (task) {
      setFormData({
        name: task.name || '',
        estimated_minutes: task.estimated_minutes || 0,
        status: task.status || 'pending',
        is_emergency: task.is_emergency || false,
        big_task_id: task.big_task_id || bigTaskId || '',
      })
    } else {
      setFormData({
        name: '',
        estimated_minutes: 0, // カンバンタスクは未スケジュール
        status: 'pending',
        is_emergency: false,
        big_task_id: bigTaskId || '',
      })
    }
  }, [task, bigTaskId])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // カンバンタスクは未スケジュールとして作成
    const unscheduledDate = '1970-01-01T00:00:00.000Z'
    
    if (task) {
      // 更新の場合
      const updateData: UpdateSmallTaskData = {
        name: formData.name,
        estimated_minutes: formData.estimated_minutes,
        status: formData.status,
        is_emergency: formData.is_emergency,
        big_task_id: formData.big_task_id || undefined,
      }
      onSave(updateData)
    } else {
      // 新規作成の場合（カンバンタスクは未スケジュール）
      const createData: Omit<CreateSmallTaskData, 'user_id' | 'project_id'> = {
        name: formData.name,
        estimated_minutes: formData.estimated_minutes,
        scheduled_start: unscheduledDate,
        scheduled_end: unscheduledDate,
        status: formData.status,
        is_emergency: formData.is_emergency,
        task_type: 'project',
        big_task_id: formData.big_task_id || undefined,
      }
      onSave(createData)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{task ? 'タスクを編集' : '新しいタスク'}</DialogTitle>
            <DialogDescription>
              {task ? 'タスクの情報を編集します' : '新しいタスクを作成します'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">タスク名</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="タスク名を入力"
                required
                autoFocus
              />
            </div>

            {bigTasks && bigTasks.length > 0 && (
              <div className="grid gap-2">
                <Label htmlFor="big_task">大タスク</Label>
                <Select
                  value={formData.big_task_id}
                  onValueChange={(value) => setFormData({ ...formData, big_task_id: value })}
                >
                  <SelectTrigger id="big_task">
                    <SelectValue placeholder="大タスクを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {bigTasks.map((bigTask) => (
                      <SelectItem key={bigTask.id} value={bigTask.id}>
                        {bigTask.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}


            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="estimated_minutes">見積時間（分）</Label>
                <Input
                  id="estimated_minutes"
                  type="number"
                  min="1"
                  value={formData.estimated_minutes}
                  onChange={(e) => setFormData({ ...formData, estimated_minutes: parseInt(e.target.value) || 30 })}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="status">ステータス</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value as SmallTask['status'] })}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">未完了</SelectItem>
                    <SelectItem value="completed">完了</SelectItem>
                    <SelectItem value="cancelled">キャンセル</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>


            <div className="flex items-center space-x-2">
              <Switch
                id="is_emergency"
                checked={formData.is_emergency}
                onCheckedChange={(checked) => setFormData({ ...formData, is_emergency: checked })}
              />
              <Label htmlFor="is_emergency" className="cursor-pointer">
                緊急タスクとしてマーク
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit">
              {task ? '更新' : '作成'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}