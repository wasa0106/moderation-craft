/**
 * TaskDetailsForm - タスクの詳細情報を編集するフォーム
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SmallTask } from '@/types'
import { useDebounce } from '@/hooks/use-debounce'
import { smallTaskRepository } from '@/lib/db/repositories'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

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
  const [focusedField, setFocusedField] = useState<string | null>(null)

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
            <Label htmlFor="goal" className="text-sm font-medium">
              Goal - このタスクで実現したいこと
            </Label>
            <Textarea
              id="goal"
              value={formData.goal}
              onChange={e => handleInputChange('goal', e.target.value)}
              onFocus={() => setFocusedField('goal')}
              onBlur={() => setFocusedField(null)}
              className={cn(
                "resize-none transition-all duration-200",
                focusedField === 'goal' ? "min-h-[120px]" : "min-h-[60px]"
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dod" className="text-sm font-medium">
              DoD - 完了条件（QCD基準を含めて具体的に）
            </Label>
            <Textarea
              id="dod"
              value={formData.dod}
              onChange={e => handleInputChange('dod', e.target.value)}
              onFocus={() => setFocusedField('dod')}
              onBlur={() => setFocusedField(null)}
              className={cn(
                "resize-none transition-all duration-200",
                focusedField === 'dod' ? "min-h-[120px]" : "min-h-[60px]"
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="inputs" className="text-sm font-medium">
              Inputs - 手元にある材料、情報
            </Label>
            <Textarea
              id="inputs"
              value={formData.inputs}
              onChange={e => handleInputChange('inputs', e.target.value)}
              onFocus={() => setFocusedField('inputs')}
              onBlur={() => setFocusedField(null)}
              className={cn(
                "resize-none transition-all duration-200",
                focusedField === 'inputs' ? "min-h-[120px]" : "min-h-[60px]"
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="outputs" className="text-sm font-medium">
              Outputs - 成果物
            </Label>
            <Textarea
              id="outputs"
              value={formData.outputs}
              onChange={e => handleInputChange('outputs', e.target.value)}
              onFocus={() => setFocusedField('outputs')}
              onBlur={() => setFocusedField(null)}
              className={cn(
                "resize-none transition-all duration-200",
                focusedField === 'outputs' ? "min-h-[120px]" : "min-h-[60px]"
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="process" className="text-sm font-medium">
              Process - 作業手順
            </Label>
            <Textarea
              id="process"
              value={formData.process}
              onChange={e => handleInputChange('process', e.target.value)}
              onFocus={() => setFocusedField('process')}
              onBlur={() => setFocusedField(null)}
              className={cn(
                "resize-none font-mono text-sm transition-all duration-200",
                focusedField === 'process' ? "min-h-[250px]" : "min-h-[150px]"
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="missing_inputs" className="text-sm font-medium">
              Missing Inputs - 不足している情報
            </Label>
            <Textarea
              id="missing_inputs"
              value={formData.missing_inputs}
              onChange={e => handleInputChange('missing_inputs', e.target.value)}
              onFocus={() => setFocusedField('missing_inputs')}
              onBlur={() => setFocusedField(null)}
              className={cn(
                "resize-none transition-all duration-200",
                focusedField === 'missing_inputs' ? "min-h-[120px]" : "min-h-[60px]"
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="non_goals" className="text-sm font-medium">
              Non Goals - 今回はやらないこと
            </Label>
            <Textarea
              id="non_goals"
              value={formData.non_goals}
              onChange={e => handleInputChange('non_goals', e.target.value)}
              onFocus={() => setFocusedField('non_goals')}
              onBlur={() => setFocusedField(null)}
              className={cn(
                "resize-none transition-all duration-200",
                focusedField === 'non_goals' ? "min-h-[120px]" : "min-h-[60px]"
              )}
            />
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