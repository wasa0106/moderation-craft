/**
 * ProjectForm - Form for creating and editing projects
 * Handles project creation and updates with validation
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
import { Project, CreateProjectData, UpdateProjectData } from '@/types'
import { cn } from '@/lib/utils'

const projectFormSchema = z.object({
  name: z
    .string()
    .min(1, 'プロジェクト名は必須です')
    .max(100, 'プロジェクト名は100文字以内で入力してください'),
  goal: z.string().min(1, 'ゴールは必須です').max(500, 'ゴールは500文字以内で入力してください'),
  deadline: z.string().optional(),
  status: z
    .enum(['planning', 'active', 'completed', 'paused', 'cancelled'])
    .optional()
    .default('active'),
})

type ProjectFormData = z.infer<typeof projectFormSchema>

interface ProjectFormProps {
  project?: Project
  onSubmit: (data: CreateProjectData | UpdateProjectData) => void
  onCancel?: () => void
  isLoading?: boolean
  className?: string
}

export function ProjectForm({
  project,
  onSubmit,
  onCancel,
  isLoading = false,
  className,
}: ProjectFormProps) {
  const isEditing = !!project

  const form = useForm({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: project?.name || '',
      goal: project?.goal || '',
      deadline: project?.deadline ? project.deadline.split('T')[0] : '',
      status: project?.status || 'active',
    },
  })

  const handleSubmit = (data: ProjectFormData) => {
    const formData = {
      ...data,
      deadline: data.deadline || undefined,
    }

    if (isEditing) {
      onSubmit(formData as UpdateProjectData)
    } else {
      onSubmit({
        ...formData,
        user_id: 'current-user', // In a real app, get from auth context
        version: 1,
      } as CreateProjectData)
    }
  }

  return (
    <Card className={cn('max-w-2xl', className)}>
      <CardHeader>
        <CardTitle>{isEditing ? 'プロジェクトを編集' : '新しいプロジェクトを作成'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Project Name */}
          <div className="space-y-2">
            <Label htmlFor="name">プロジェクト名 *</Label>
            <Input
              id="name"
              placeholder="プロジェクト名を入力"
              {...form.register('name')}
              className={cn(form.formState.errors.name && 'border-red-500 focus:border-red-500')}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-600">{form.formState.errors.name.message}</p>
            )}
          </div>

          {/* Goal */}
          <div className="space-y-2">
            <Label htmlFor="goal">ゴール *</Label>
            <Textarea
              id="goal"
              placeholder="プロジェクトの目標を入力"
              rows={3}
              {...form.register('goal')}
              className={cn(form.formState.errors.goal && 'border-red-500 focus:border-red-500')}
            />
            {form.formState.errors.goal && (
              <p className="text-sm text-red-600">{form.formState.errors.goal.message}</p>
            )}
          </div>

          {/* Deadline */}
          <div className="space-y-2">
            <Label htmlFor="deadline">期限</Label>
            <Input
              id="deadline"
              type="date"
              {...form.register('deadline')}
              className={cn(
                form.formState.errors.deadline && 'border-red-500 focus:border-red-500'
              )}
            />
            {form.formState.errors.deadline && (
              <p className="text-sm text-red-600">{form.formState.errors.deadline.message}</p>
            )}
          </div>

          {/* Status (only for editing) */}
          {isEditing && (
            <div className="space-y-2">
              <Label htmlFor="status">ステータス</Label>
              <Select
                value={form.watch('status')}
                onValueChange={value => form.setValue('status', value as Project['status'])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="ステータスを選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">計画中</SelectItem>
                  <SelectItem value="active">アクティブ</SelectItem>
                  <SelectItem value="completed">完了</SelectItem>
                  <SelectItem value="paused">一時停止</SelectItem>
                  <SelectItem value="cancelled">キャンセル</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

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
