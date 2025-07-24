/**
 * BigTaskForm - Form for creating and editing big tasks
 * Handles big task creation and updates with validation
 */

'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BigTask, CreateBigTaskData, UpdateBigTaskData } from '@/types'
import { cn } from '@/lib/utils'

const bigTaskFormSchema = z.object({
  name: z.string().min(1, 'タスク名は必須です').max(100, 'タスク名は100文字以内で入力してください'),
  description: z.string().max(500, '説明は500文字以内で入力してください').optional(),
  week_number: z
    .number()
    .min(1, '週番号は1以上である必要があります')
    .max(52, '週番号は52以下である必要があります'),
  estimated_hours: z
    .number()
    .min(0.5, '見積時間は0.5時間以上である必要があります')
    .max(168, '見積時間は168時間以下である必要があります'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
  status: z.enum(['pending', 'active', 'completed', 'cancelled']).optional().default('pending'),
})

type BigTaskFormData = z.infer<typeof bigTaskFormSchema>

interface BigTaskFormProps {
  projectId: string
  task?: BigTask
  onSubmit: (data: CreateBigTaskData | UpdateBigTaskData) => void
  onCancel?: () => void
  isLoading?: boolean
  className?: string
}

export function BigTaskForm({
  projectId,
  task,
  onSubmit,
  onCancel,
  isLoading = false,
  className,
}: BigTaskFormProps) {
  const isEditing = !!task

  const form = useForm({
    resolver: zodResolver(bigTaskFormSchema),
    defaultValues: {
      name: task?.name || '',
      description: task?.description || '',
      week_number: task?.week_number || 1,
      estimated_hours: task?.estimated_hours || 8,
      priority: task?.priority || 'medium',
      status: task?.status || 'pending',
    },
  })

  const handleSubmit = (data: BigTaskFormData) => {
    if (isEditing) {
      onSubmit(data as UpdateBigTaskData)
    } else {
      onSubmit({
        ...data,
        project_id: projectId,
        user_id: 'current-user', // In a real app, get from auth context
        actual_hours: 0,
        version: 1,
      } as CreateBigTaskData)
    }
  }

  return (
    <Card className={cn('max-w-2xl', className)}>
      <CardHeader>
        <CardTitle>{isEditing ? '大タスクを編集' : '新しい大タスクを作成'}</CardTitle>
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
              className={cn(form.formState.errors.name && 'border-red-500 focus:border-red-500')}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-600">{form.formState.errors.name.message}</p>
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
              <p className="text-sm text-red-600">{form.formState.errors.description.message}</p>
            )}
          </div>

          {/* Week Number and Estimated Hours */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="week_number">週番号 *</Label>
              <Input
                id="week_number"
                type="number"
                min={1}
                max={52}
                placeholder="1"
                {...form.register('week_number', { valueAsNumber: true })}
                className={cn(
                  form.formState.errors.week_number && 'border-red-500 focus:border-red-500'
                )}
              />
              {form.formState.errors.week_number && (
                <p className="text-sm text-red-600">{form.formState.errors.week_number.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimated_hours">見積時間 (時間) *</Label>
              <Input
                id="estimated_hours"
                type="number"
                min={0.5}
                max={168}
                step={0.5}
                placeholder="8"
                {...form.register('estimated_hours', { valueAsNumber: true })}
                className={cn(
                  form.formState.errors.estimated_hours && 'border-red-500 focus:border-red-500'
                )}
              />
              {form.formState.errors.estimated_hours && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.estimated_hours.message}
                </p>
              )}
            </div>
          </div>

          {/* Priority and Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">優先度</Label>
              <Select
                value={form.watch('priority') || undefined}
                onValueChange={value => form.setValue('priority', value as BigTask['priority'])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="優先度を選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">低</SelectItem>
                  <SelectItem value="medium">中</SelectItem>
                  <SelectItem value="high">高</SelectItem>
                  <SelectItem value="urgent">緊急</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isEditing && (
              <div className="space-y-2">
                <Label htmlFor="status">ステータス</Label>
                <Select
                  value={form.watch('status')}
                  onValueChange={value => form.setValue('status', value as BigTask['status'])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="ステータスを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">待機中</SelectItem>
                    <SelectItem value="active">実行中</SelectItem>
                    <SelectItem value="completed">完了</SelectItem>
                    <SelectItem value="cancelled">キャンセル</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  {isEditing ? '更新中...' : '作成中...'}
                </span>
              ) : isEditing ? (
                '更新'
              ) : (
                '作成'
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
