/**
 * UnplannedTaskDialog - 計画外タスク作成ダイアログ
 */

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Project, BigTask } from '@/types'
import { cn } from '@/lib/utils'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'

export interface UnplannedTaskData {
  name: string
  projectId?: string
  bigTaskId?: string
}

interface UnplannedTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (taskData: UnplannedTaskData) => void
  projects: Project[]
  bigTasks: BigTask[]
  initialTaskName?: string
}

export function UnplannedTaskDialog({
  open,
  onOpenChange,
  onConfirm,
  projects,
  bigTasks,
  initialTaskName,
}: UnplannedTaskDialogProps) {
  const [taskName, setTaskName] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('none')
  const [selectedBigTaskId, setSelectedBigTaskId] = useState<string>('none')

  // ダイアログが開いた時に値をリセット
  useEffect(() => {
    if (open) {
      setTaskName(initialTaskName || '')
      setSelectedProjectId('none')
      setSelectedBigTaskId('none')
    }
  }, [open, initialTaskName])

  // 選択されたプロジェクトのBigTasksをフィルタリング
  const filteredBigTasks = selectedProjectId !== 'none' 
    ? bigTasks.filter(task => task.project_id === selectedProjectId)
    : []

  const handleSubmit = () => {
    if (!taskName.trim()) return

    onConfirm({
      name: taskName.trim(),
      projectId: selectedProjectId === 'none' ? undefined : selectedProjectId,
      bigTaskId: selectedBigTaskId === 'none' ? undefined : selectedBigTaskId,
    })

    onOpenChange(false)
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <VisuallyHidden>
            <DialogTitle>タスク設定</DialogTitle>
          </VisuallyHidden>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>タスク名</Label>
            <div className="text-lg font-medium">
              {taskName || '未設定'}
            </div>
          </div>

          <div className="space-y-2">
            <Label>プロジェクト（任意）</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={selectedProjectId === 'none' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setSelectedProjectId('none')
                  setSelectedBigTaskId('none')
                }}
                className="h-auto px-3 py-1.5 font-normal"
              >
                プロジェクトなし
              </Button>
              {projects.map(project => (
                <Button
                  key={project.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedProjectId(project.id)
                    setSelectedBigTaskId('none')
                  }}
                  className={cn(
                    'h-auto px-3 py-1.5 font-normal transition-all',
                    selectedProjectId === project.id && 'ring-2 ring-offset-2'
                  )}
                  style={
                    project.color
                      ? {
                          ...(selectedProjectId === project.id
                            ? {
                                backgroundColor: project.color,
                                borderColor: project.color,
                                color: 'white',
                              }
                            : {
                                borderColor: project.color,
                                color: project.color,
                              }),
                        }
                      : undefined
                  }
                >
                  <div className="flex items-center gap-2">
                    {project.color && (
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor:
                            selectedProjectId === project.id ? 'white' : project.color,
                          opacity: selectedProjectId === project.id ? 0.8 : 1,
                        }}
                      />
                    )}
                    <span className="text-sm">{project.name}</span>
                  </div>
                </Button>
              ))}
            </div>
          </div>

          {selectedProjectId !== 'none' && (
            <div className="space-y-2">
              <Label>大タスク（任意）</Label>
              {filteredBigTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  選択されたプロジェクトに大タスクがありません
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={selectedBigTaskId === 'none' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedBigTaskId('none')}
                    className="h-auto px-3 py-1.5 font-normal"
                  >
                    大タスクなし
                  </Button>
                  {filteredBigTasks.map(bigTask => (
                    <Button
                      key={bigTask.id}
                      type="button"
                      variant={selectedBigTaskId === bigTask.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedBigTaskId(bigTask.id)}
                      className={cn(
                        'h-auto px-3 py-1.5 font-normal transition-all max-w-xs',
                        selectedBigTaskId === bigTask.id && 'ring-2 ring-offset-2'
                      )}
                    >
                      <span className="text-sm truncate">{bigTask.name}</span>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
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
