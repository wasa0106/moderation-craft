/**
 * UnplannedTaskDialog - 計画外タスク名入力ダイアログ
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
import { Zap } from 'lucide-react'

interface UnplannedTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (taskName: string) => void
  defaultValue?: string
}

export function UnplannedTaskDialog({
  open,
  onOpenChange,
  onConfirm,
  defaultValue = '',
}: UnplannedTaskDialogProps) {
  const [taskName, setTaskName] = useState(defaultValue)

  // ダイアログが開いた時に値をリセット
  useEffect(() => {
    if (open) {
      setTaskName(defaultValue)
    }
  }, [open, defaultValue])

  const handleSubmit = () => {
    if (!taskName.trim()) return
    onConfirm(taskName.trim())
    setTaskName('')
    onOpenChange(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && taskName.trim()) {
      handleSubmit()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-orange-500" />
            計画外の作業
          </DialogTitle>
          <DialogDescription>
            どのような作業を行いますか？
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="task-name">作業内容</Label>
            <Input
              id="task-name"
              placeholder="例: 緊急バグ修正、メール対応"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!taskName.trim()}
          >
            開始
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}