/**
 * UnplannedTaskDialog - 計画外タスク作成ダイアログ
 */

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Zap } from 'lucide-react'
import { Project } from '@/types'

export interface UnplannedTaskData {
  name: string
  projectId?: string
}

interface UnplannedTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (taskData: UnplannedTaskData) => void
  projects: Project[]
}

export function UnplannedTaskDialog({
  open,
  onOpenChange,
  onConfirm,
  projects,
}: UnplannedTaskDialogProps) {
  const [taskName, setTaskName] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('none')

  // ダイアログが開いた時に値をリセット
  useEffect(() => {
    if (open) {
      setTaskName('')
      setSelectedProjectId('none')
    }
  }, [open])

  const handleSubmit = () => {
    if (!taskName.trim()) return

    onConfirm({
      name: taskName.trim(),
      projectId: selectedProjectId === 'none' ? undefined : selectedProjectId,
    })

    onOpenChange(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && taskName.trim() && e.target instanceof HTMLInputElement) {
      handleSubmit()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-orange-500" />
            緊急タスクの作成
          </DialogTitle>
          <DialogDescription>急遽発生した作業を登録します</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="task-name">タスク名</Label>
            <Input
              id="task-name"
              placeholder="例: 緊急バグ修正、急な会議対応"
              value={taskName}
              onChange={e => setTaskName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project">プロジェクト（任意）</Label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger id="project">
                <SelectValue placeholder="プロジェクトを選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">プロジェクトなし</SelectItem>
                {projects.map(project => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit} disabled={!taskName.trim()}>
            作成して開始
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
