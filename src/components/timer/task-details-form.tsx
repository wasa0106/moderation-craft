/**
 * TaskDetailsForm - タスクの詳細情報を編集するフォーム
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { SmallTask } from '@/types'
import { useDebounce } from '@/hooks/use-debounce'
import { smallTaskRepository } from '@/lib/db/repositories'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Markdown } from '@/components/ui/markdown'
import { Eye, Edit } from 'lucide-react'

interface TaskDetailsFormProps {
  task: SmallTask | null
  onUpdate?: (task: SmallTask) => void
  className?: string
}

export function TaskDetailsForm({ task, onUpdate, className }: TaskDetailsFormProps) {
  const [formData, setFormData] = useState({
    goal: '',
    dod: '',
    inputs: '',
    outputs: '',
    process: '',
    missing_inputs: '',
    non_goals: '',
  })

  const [isSaving, setIsSaving] = useState(false)
  const [previewMode, setPreviewMode] = useState<Record<string, boolean>>({
    goal: false,
    dod: false,
    inputs: false,
    outputs: false,
    process: false,
    missing_inputs: false,
    non_goals: false,
  })

  // タスクが切り替わったら、フォームデータを更新
  // 前のタスクIDを追跡して、タスクが切り替わった時のみ更新
  const [previousTaskId, setPreviousTaskId] = useState<string | null>(null)
  
  useEffect(() => {
    if (task && task.id !== previousTaskId) {
      // タスクが切り替わった時のみフォームデータを更新
      setFormData({
        goal: task.goal || '',
        dod: task.dod || '',
        inputs: task.inputs || '',
        outputs: task.outputs || '',
        process: task.process || '',
        missing_inputs: task.missing_inputs || '',
        non_goals: task.non_goals || '',
      })
      setPreviousTaskId(task.id)
    } else if (!task && previousTaskId !== null) {
      // タスクがない場合はフォームをクリア
      setFormData({
        goal: '',
        dod: '',
        inputs: '',
        outputs: '',
        process: '',
        missing_inputs: '',
        non_goals: '',
      })
      setPreviousTaskId(null)
    }
  }, [task?.id, previousTaskId])

  // デバウンスされたフォームデータ
  const debouncedFormData = useDebounce(formData, 1000)

  // 自動保存
  useEffect(() => {
    const saveTaskDetails = async () => {
      if (!task || isSaving) return

      // 変更がない場合は保存しない
      const hasChanges = Object.keys(formData).some(
        key => formData[key as keyof typeof formData] !== (task[key as keyof SmallTask] || '')
      )

      if (!hasChanges) return

      setIsSaving(true)
      try {
        const updatedTask = await smallTaskRepository.update(task.id, {
          goal: formData.goal || undefined,
          dod: formData.dod || undefined,
          inputs: formData.inputs || undefined,
          outputs: formData.outputs || undefined,
          process: formData.process || undefined,
          missing_inputs: formData.missing_inputs || undefined,
          non_goals: formData.non_goals || undefined,
        })

        if (onUpdate) {
          onUpdate(updatedTask)
        }
      } catch (error) {
        console.error('Failed to save task details:', error)
        toast.error('タスク詳細の保存に失敗しました')
      } finally {
        setIsSaving(false)
      }
    }

    saveTaskDetails()
  }, [debouncedFormData, task?.id, onUpdate]) // taskではなくtask.idを使用、isSavingを削除

  const handleInputChange = useCallback((field: keyof typeof formData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }))
  }, [])

  const togglePreview = useCallback((field: keyof typeof formData) => {
    setPreviewMode(prev => ({
      ...prev,
      [field]: !prev[field],
    }))
  }, [])

  if (!task) {
    return (
      <Card className={cn('bg-surface-1 shadow-surface-1 border border-border', className)}>
        <CardContent className="py-4">
          <div className="text-center text-muted-foreground">
            実行中のタスクがありません
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('bg-surface-1 shadow-surface-1 border border-border', className)}>
      <CardContent className="py-4 space-y-4">
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="goal" className="text-sm font-medium">
                Goal - このタスクで実現したいこと
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => togglePreview('goal')}
                className="h-7 px-2"
              >
                {previewMode.goal ? (
                  <><Edit className="h-3 w-3 mr-1" />編集</>
                ) : (
                  <><Eye className="h-3 w-3 mr-1" />プレビュー</>
                )}
              </Button>
            </div>
            {previewMode.goal ? (
              <div className="min-h-[60px] p-3 rounded-md border border-border bg-muted/30">
                {formData.goal ? (
                  <Markdown content={formData.goal} />
                ) : (
                  <span className="text-muted-foreground text-sm">内容がありません</span>
                )}
              </div>
            ) : (
              <Textarea
                id="goal"
                value={formData.goal}
                onChange={e => handleInputChange('goal', e.target.value)}
                className="min-h-[60px] resize-none"
              />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="dod" className="text-sm font-medium">
                DoD - 完了条件（QCD基準を含めて具体的に）
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => togglePreview('dod')}
                className="h-7 px-2"
              >
                {previewMode.dod ? (
                  <><Edit className="h-3 w-3 mr-1" />編集</>
                ) : (
                  <><Eye className="h-3 w-3 mr-1" />プレビュー</>
                )}
              </Button>
            </div>
            {previewMode.dod ? (
              <div className="min-h-[60px] p-3 rounded-md border border-border bg-muted/30">
                {formData.dod ? (
                  <Markdown content={formData.dod} />
                ) : (
                  <span className="text-muted-foreground text-sm">内容がありません</span>
                )}
              </div>
            ) : (
              <Textarea
                id="dod"
                value={formData.dod}
                onChange={e => handleInputChange('dod', e.target.value)}
                className="min-h-[60px] resize-none"
              />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="inputs" className="text-sm font-medium">
                Inputs - 手元にある材料、情報
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => togglePreview('inputs')}
                className="h-7 px-2"
              >
                {previewMode.inputs ? (
                  <><Edit className="h-3 w-3 mr-1" />編集</>
                ) : (
                  <><Eye className="h-3 w-3 mr-1" />プレビュー</>
                )}
              </Button>
            </div>
            {previewMode.inputs ? (
              <div className="min-h-[60px] p-3 rounded-md border border-border bg-muted/30">
                {formData.inputs ? (
                  <Markdown content={formData.inputs} />
                ) : (
                  <span className="text-muted-foreground text-sm">内容がありません</span>
                )}
              </div>
            ) : (
              <Textarea
                id="inputs"
                value={formData.inputs}
                onChange={e => handleInputChange('inputs', e.target.value)}
                className="min-h-[60px] resize-none"
              />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="outputs" className="text-sm font-medium">
                Outputs - 成果物
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => togglePreview('outputs')}
                className="h-7 px-2"
              >
                {previewMode.outputs ? (
                  <><Edit className="h-3 w-3 mr-1" />編集</>
                ) : (
                  <><Eye className="h-3 w-3 mr-1" />プレビュー</>
                )}
              </Button>
            </div>
            {previewMode.outputs ? (
              <div className="min-h-[60px] p-3 rounded-md border border-border bg-muted/30">
                {formData.outputs ? (
                  <Markdown content={formData.outputs} />
                ) : (
                  <span className="text-muted-foreground text-sm">内容がありません</span>
                )}
              </div>
            ) : (
              <Textarea
                id="outputs"
                value={formData.outputs}
                onChange={e => handleInputChange('outputs', e.target.value)}
                className="min-h-[60px] resize-none"
              />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="process" className="text-sm font-medium">
                Process - 作業手順
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => togglePreview('process')}
                className="h-7 px-2"
              >
                {previewMode.process ? (
                  <><Edit className="h-3 w-3 mr-1" />編集</>
                ) : (
                  <><Eye className="h-3 w-3 mr-1" />プレビュー</>
                )}
              </Button>
            </div>
            {previewMode.process ? (
              <div className="min-h-[150px] p-3 rounded-md border border-border bg-muted/30">
                {formData.process ? (
                  <Markdown content={formData.process} />
                ) : (
                  <span className="text-muted-foreground text-sm">内容がありません</span>
                )}
              </div>
            ) : (
              <Textarea
                id="process"
                value={formData.process}
                onChange={e => handleInputChange('process', e.target.value)}
                className="min-h-[150px] resize-none font-mono text-sm"
              />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="missing_inputs" className="text-sm font-medium">
                Missing Inputs - 不足している情報
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => togglePreview('missing_inputs')}
                className="h-7 px-2"
              >
                {previewMode.missing_inputs ? (
                  <><Edit className="h-3 w-3 mr-1" />編集</>
                ) : (
                  <><Eye className="h-3 w-3 mr-1" />プレビュー</>
                )}
              </Button>
            </div>
            {previewMode.missing_inputs ? (
              <div className="min-h-[60px] p-3 rounded-md border border-border bg-muted/30">
                {formData.missing_inputs ? (
                  <Markdown content={formData.missing_inputs} />
                ) : (
                  <span className="text-muted-foreground text-sm">内容がありません</span>
                )}
              </div>
            ) : (
              <Textarea
                id="missing_inputs"
                value={formData.missing_inputs}
                onChange={e => handleInputChange('missing_inputs', e.target.value)}
                className="min-h-[60px] resize-none"
              />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="non_goals" className="text-sm font-medium">
                Non Goals - 今回はやらないこと
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => togglePreview('non_goals')}
                className="h-7 px-2"
              >
                {previewMode.non_goals ? (
                  <><Edit className="h-3 w-3 mr-1" />編集</>
                ) : (
                  <><Eye className="h-3 w-3 mr-1" />プレビュー</>
                )}
              </Button>
            </div>
            {previewMode.non_goals ? (
              <div className="min-h-[60px] p-3 rounded-md border border-border bg-muted/30">
                {formData.non_goals ? (
                  <Markdown content={formData.non_goals} />
                ) : (
                  <span className="text-muted-foreground text-sm">内容がありません</span>
                )}
              </div>
            ) : (
              <Textarea
                id="non_goals"
                value={formData.non_goals}
                onChange={e => handleInputChange('non_goals', e.target.value)}
                className="min-h-[60px] resize-none"
              />
            )}
          </div>
        </div>

        {isSaving && (
          <div className="text-xs text-muted-foreground text-center">
            保存中...
          </div>
        )}
      </CardContent>
    </Card>
  )
}