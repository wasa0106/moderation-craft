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
import { format, addDays, startOfWeek, endOfWeek } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon } from 'lucide-react'

const bigTaskFormSchema = z.object({
  name: z.string().min(1, 'タスク名は必須です').max(100, 'タスク名は100文字以内で入力してください'),
  description: z.string().max(500, '説明は500文字以内で入力してください').optional(),
  start_date: z.string().min(1, '開始日は必須です'),
  end_date: z.string().min(1, '終了日は必須です'),
  category: z.string().min(1, 'カテゴリーは必須です'),
  estimated_hours: z
    .number()
    .min(0.5, '見積時間は0.5時間以上である必要があります')
    .max(168, '見積時間は168時間以下である必要があります'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
  status: z.enum(['active', 'completed', 'cancelled']).optional().default('active'),
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
      start_date:
        task?.start_date || format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      end_date: task?.end_date || format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      category: task?.category || 'その他',
      estimated_hours: task?.estimated_hours || 8,
      priority: task?.priority || 'medium',
      status: task?.status || 'active',
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

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">開始日 *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !form.watch('start_date') && 'text-muted-foreground',
                      form.formState.errors.start_date && 'border-red-500'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.watch('start_date') ? (
                      format(new Date(form.watch('start_date')), 'yyyy年M月d日', { locale: ja })
                    ) : (
                      <span>開始日を選択</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={
                      form.watch('start_date') ? new Date(form.watch('start_date')) : undefined
                    }
                    onSelect={date =>
                      date && form.setValue('start_date', format(date, 'yyyy-MM-dd'))
                    }
                    locale={ja}
                  />
                </PopoverContent>
              </Popover>
              {form.formState.errors.start_date && (
                <p className="text-sm text-red-600">{form.formState.errors.start_date.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">終了日 *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !form.watch('end_date') && 'text-muted-foreground',
                      form.formState.errors.end_date && 'border-red-500'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.watch('end_date') ? (
                      format(new Date(form.watch('end_date')), 'yyyy年M月d日', { locale: ja })
                    ) : (
                      <span>終了日を選択</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.watch('end_date') ? new Date(form.watch('end_date')) : undefined}
                    onSelect={date => date && form.setValue('end_date', format(date, 'yyyy-MM-dd'))}
                    locale={ja}
                  />
                </PopoverContent>
              </Popover>
              {form.formState.errors.end_date && (
                <p className="text-sm text-red-600">{form.formState.errors.end_date.message}</p>
              )}
            </div>
          </div>

          {/* Category and Estimated Hours */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">カテゴリー *</Label>
              <Select
                value={form.watch('category')}
                onValueChange={value => form.setValue('category', value)}
              >
                <SelectTrigger className={cn(form.formState.errors.category && 'border-red-500')}>
                  <SelectValue placeholder="カテゴリーを選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="開発">開発</SelectItem>
                  <SelectItem value="設計">設計</SelectItem>
                  <SelectItem value="テスト">テスト</SelectItem>
                  <SelectItem value="その他">その他</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.category && (
                <p className="text-sm text-red-600">{form.formState.errors.category.message}</p>
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
