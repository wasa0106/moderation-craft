/**
 * SmallTaskForm - Form for creating and editing small tasks
 * Handles small task creation and updates with validation
 */

'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SmallTask, CreateSmallTaskData, UpdateSmallTaskData } from '@/types'
import { cn } from '@/lib/utils'

const smallTaskFormSchema = z.object({
  name: z.string().min(1, 'タスク名は必須です').max(100, 'タスク名は100文字以内で入力してください'),
  description: z.string().max(500, '説明は500文字以内で入力してください').optional(),
  scheduled_start: z.string().min(1, '開始予定時刻は必須です'),
  scheduled_end: z.string().min(1, '終了予定時刻は必須です'),
  estimated_minutes: z.number().min(5, '見積時間は5分以上である必要があります').max(600, '見積時間は600分以下である必要があります'),
  is_emergency: z.boolean().optional().default(false)
})

type SmallTaskFormData = z.infer<typeof smallTaskFormSchema>

interface SmallTaskFormProps {
  bigTaskId: string
  task?: SmallTask
  onSubmit: (data: CreateSmallTaskData | UpdateSmallTaskData) => void
  onCancel?: () => void
  isLoading?: boolean
  className?: string
}

export function SmallTaskForm({ 
  bigTaskId,
  task, 
  onSubmit, 
  onCancel, 
  isLoading = false,
  className 
}: SmallTaskFormProps) {
  const isEditing = !!task

  const form = useForm({
    resolver: zodResolver(smallTaskFormSchema),
    defaultValues: {
      name: task?.name || '',
      description: task?.description || '',
      scheduled_start: task?.scheduled_start ? 
        new Date(task.scheduled_start).toISOString().slice(0, 16) : 
        new Date().toISOString().slice(0, 16),
      scheduled_end: task?.scheduled_end ? 
        new Date(task.scheduled_end).toISOString().slice(0, 16) : 
        new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
      estimated_minutes: task?.estimated_minutes || 30,
      is_emergency: task?.is_emergency || false
    }
  })

  const handleSubmit = (data: SmallTaskFormData) => {
    // Convert datetime-local to ISO string
    const submissionData = {
      ...data,
      scheduled_start: new Date(data.scheduled_start).toISOString(),
      scheduled_end: new Date(data.scheduled_end).toISOString()
    }

    if (isEditing) {
      onSubmit(submissionData as UpdateSmallTaskData)
    } else {
      onSubmit({
        ...submissionData,
        big_task_id: bigTaskId,
        user_id: 'current-user', // In a real app, get from auth context
        actual_minutes: 0,
        version: 1
      } as CreateSmallTaskData)
    }
  }

  // Auto-calculate estimated minutes based on scheduled times
  const calculateEstimatedMinutes = () => {
    const start = form.watch('scheduled_start')
    const end = form.watch('scheduled_end')
    
    if (start && end) {
      const startDate = new Date(start)
      const endDate = new Date(end)
      const diffMinutes = Math.max(5, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60)))
      form.setValue('estimated_minutes', diffMinutes)
    }
  }

  return (
    <Card className={cn('max-w-2xl', className)}>
      <CardHeader>
        <CardTitle>
          {isEditing ? '小タスクを編集' : '新しい小タスクを作成'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Task Name */}
          <div className="space-y-2">
            <Label htmlFor="name">タスク名 *</Label>
            <Input
              id="name"
              placeholder="タスク名を入力"
              {...form.register('name')}
              className={cn(
                form.formState.errors.name && 'border-red-500 focus:border-red-500'
              )}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-600">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">説明</Label>
            <Textarea
              id="description"
              placeholder="タスクの詳細を入力"
              rows={3}
              {...form.register('description')}
              className={cn(
                form.formState.errors.description && 'border-red-500 focus:border-red-500'
              )}
            />
            {form.formState.errors.description && (
              <p className="text-sm text-red-600">
                {form.formState.errors.description.message}
              </p>
            )}
          </div>

          {/* Scheduled Times */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scheduled_start">開始予定時刻 *</Label>
              <Input
                id="scheduled_start"
                type="datetime-local"
                {...form.register('scheduled_start')}
                onChange={(e) => {
                  form.setValue('scheduled_start', e.target.value)
                  calculateEstimatedMinutes()
                }}
                className={cn(
                  form.formState.errors.scheduled_start && 'border-red-500 focus:border-red-500'
                )}
              />
              {form.formState.errors.scheduled_start && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.scheduled_start.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduled_end">終了予定時刻 *</Label>
              <Input
                id="scheduled_end"
                type="datetime-local"
                {...form.register('scheduled_end')}
                onChange={(e) => {
                  form.setValue('scheduled_end', e.target.value)
                  calculateEstimatedMinutes()
                }}
                className={cn(
                  form.formState.errors.scheduled_end && 'border-red-500 focus:border-red-500'
                )}
              />
              {form.formState.errors.scheduled_end && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.scheduled_end.message}
                </p>
              )}
            </div>
          </div>

          {/* Estimated Minutes */}
          <div className="space-y-2">
            <Label htmlFor="estimated_minutes">見積時間 (分) *</Label>
            <Input
              id="estimated_minutes"
              type="number"
              min={5}
              max={600}
              step={5}
              placeholder="30"
              {...form.register('estimated_minutes', { valueAsNumber: true })}
              className={cn(
                form.formState.errors.estimated_minutes && 'border-red-500 focus:border-red-500'
              )}
            />
            {form.formState.errors.estimated_minutes && (
              <p className="text-sm text-red-600">
                {form.formState.errors.estimated_minutes.message}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              予定時刻から自動計算されます。手動で調整も可能です。
            </p>
          </div>

          {/* Emergency Flag */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_emergency"
              checked={form.watch('is_emergency')}
              onCheckedChange={(checked) => form.setValue('is_emergency', !!checked)}
            />
            <Label htmlFor="is_emergency" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              緊急タスクとしてマークする
            </Label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  {isEditing ? '更新中...' : '作成中...'}
                </span>
              ) : (
                isEditing ? '更新' : '作成'
              )}
            </Button>
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isLoading}
                className="flex-1"
              >
                キャンセル
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}