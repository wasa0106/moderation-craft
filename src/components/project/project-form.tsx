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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Project, CreateProjectData, UpdateProjectData } from '@/types'
import { cn } from '@/lib/utils'
import { ProjectColorPicker } from '@/components/project/project-color-picker'

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
  color: z.string().optional().default('hsl(137, 42%, 55%)'),
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
      color: project?.color || 'hsl(137, 42%, 55%)',
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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Project Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>プロジェクト名 *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="プロジェクト名を入力"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Goal */}
          <FormField
            control={form.control}
            name="goal"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ゴール *</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="プロジェクトの目標を入力"
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Deadline */}
          <FormField
            control={form.control}
            name="deadline"
            render={({ field }) => (
              <FormItem>
                <FormLabel>期限</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Status (only for editing) */}
          {isEditing && (
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ステータス</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="ステータスを選択" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="planning">計画中</SelectItem>
                      <SelectItem value="active">アクティブ</SelectItem>
                      <SelectItem value="completed">完了</SelectItem>
                      <SelectItem value="paused">一時停止</SelectItem>
                      <SelectItem value="cancelled">キャンセル</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Color */}
          <FormField
            control={form.control}
            name="color"
            render={({ field }) => (
              <FormItem>
                <FormLabel>プロジェクトカラー</FormLabel>
                <FormControl>
                  <ProjectColorPicker
                    value={field.value}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

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
        </Form>
      </CardContent>
    </Card>
  )
}
