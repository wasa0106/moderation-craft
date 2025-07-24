/**
 * TaskDetailDialog - タスク詳細表示・編集・削除ダイアログ
 */

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Trash2, Edit3, Clock, Calendar, FolderOpen, ListTodo } from 'lucide-react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { SmallTask, Project, BigTask, UpdateSmallTaskData } from '@/types'

interface TaskDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: SmallTask | null
  projects: Project[]
  bigTasks: BigTask[]
  onUpdateTask: (data: { id: string; data: UpdateSmallTaskData }) => Promise<void>
  onDeleteTask: (taskId: string) => Promise<void>
}

export function TaskDetailDialog({
  open,
  onOpenChange,
  task,
  projects,
  bigTasks,
  onUpdateTask,
  onDeleteTask,
}: TaskDetailDialogProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // 編集用の状態
  const [taskName, setTaskName] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedBigTaskId, setSelectedBigTaskId] = useState('')
  const [startTimeInput, setStartTimeInput] = useState('')
  const [endTimeInput, setEndTimeInput] = useState('')
  const [estimatedMinutes, setEstimatedMinutes] = useState(30)

  // タスクが変更されたら編集フォームをリセット
  useEffect(() => {
    if (task) {
      setTaskName(task.name)
      setSelectedProjectId(task.project_id || '')
      setSelectedBigTaskId(task.big_task_id || '')
      setEstimatedMinutes(task.estimated_minutes || 30)
      
      if (task.scheduled_start) {
        const startDate = new Date(task.scheduled_start)
        setStartTimeInput(format(startDate, 'HH:mm'))
      }
      
      if (task.scheduled_end) {
        const endDate = new Date(task.scheduled_end)
        setEndTimeInput(format(endDate, 'HH:mm'))
      }
    }
  }, [task])

  // プロジェクトごとのBigTasksをフィルタリング
  const availableBigTasks = selectedProjectId
    ? bigTasks.filter(bt => bt.project_id === selectedProjectId)
    : []

  const handleSave = async () => {
    if (!task || !taskName.trim()) return

    setIsSaving(true)
    try {
      const updateData: UpdateSmallTaskData = {
        name: taskName,
        project_id: selectedProjectId,
        big_task_id: selectedBigTaskId,
        estimated_minutes: estimatedMinutes,
      }

      // 時刻が変更されている場合は、新しい日時を作成
      if (task.scheduled_start && startTimeInput) {
        const [hour, minute] = startTimeInput.split(':').map(Number)
        const newStart = new Date(task.scheduled_start)
        newStart.setHours(hour, minute, 0, 0)
        updateData.scheduled_start = newStart.toISOString()
      }

      if (task.scheduled_end && endTimeInput) {
        const [hour, minute] = endTimeInput.split(':').map(Number)
        const newEnd = new Date(task.scheduled_end)
        newEnd.setHours(hour, minute, 0, 0)
        updateData.scheduled_end = newEnd.toISOString()
      }

      await onUpdateTask({ id: task.id, data: updateData })
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to update task:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!task) return

    setIsDeleting(true)
    try {
      await onDeleteTask(task.id)
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to delete task:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  if (!task) return null

  const project = projects.find(p => p.id === task.project_id)
  const bigTask = bigTasks.find(bt => bt.id === task.big_task_id)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] bg-[#FCFAEC] border-[#C9C7B6]">
          <DialogHeader>
            <DialogTitle className="text-[#1C1C14] text-xl">
              {isEditing ? (
                <Input
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  className="text-xl font-semibold bg-white border-[#D4D2C1]"
                />
              ) : (
                task.name
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* プロジェクト */}
            <div className="grid gap-2">
              <Label className="text-[#47473B] flex items-center gap-2">
                <FolderOpen className="w-4 h-4" />
                プロジェクト
              </Label>
              {isEditing ? (
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger className="bg-white border-[#D4D2C1]">
                    <SelectValue placeholder="プロジェクトを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((proj) => (
                      <SelectItem key={proj.id} value={proj.id}>
                        {proj.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-[#1C1C14] font-medium">
                  {project?.name || '未設定'}
                </p>
              )}
            </div>

            {/* 大タスク */}
            <div className="grid gap-2">
              <Label className="text-[#47473B] flex items-center gap-2">
                <ListTodo className="w-4 h-4" />
                大タスク
              </Label>
              {isEditing ? (
                <Select 
                  value={selectedBigTaskId} 
                  onValueChange={setSelectedBigTaskId}
                  disabled={!selectedProjectId}
                >
                  <SelectTrigger className="bg-white border-[#D4D2C1]">
                    <SelectValue placeholder="大タスクを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBigTasks.map((bt) => (
                      <SelectItem key={bt.id} value={bt.id}>
                        {bt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-[#1C1C14] font-medium">
                  {bigTask?.name || '未設定'}
                </p>
              )}
            </div>

            {/* 日時 */}
            <div className="grid gap-2">
              <Label className="text-[#47473B] flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                日時
              </Label>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={startTimeInput}
                    onChange={(e) => setStartTimeInput(e.target.value)}
                    className="bg-white border-[#D4D2C1]"
                  />
                  <span className="text-[#47473B]">〜</span>
                  <Input
                    type="time"
                    value={endTimeInput}
                    onChange={(e) => setEndTimeInput(e.target.value)}
                    className="bg-white border-[#D4D2C1]"
                  />
                </div>
              ) : (
                <p className="text-[#1C1C14] font-medium">
                  {task.scheduled_start && task.scheduled_end ? (
                    <>
                      {format(new Date(task.scheduled_start), 'yyyy年M月d日 (E)', { locale: ja })}
                      <br />
                      {format(new Date(task.scheduled_start), 'HH:mm')} - 
                      {format(new Date(task.scheduled_end), 'HH:mm')}
                    </>
                  ) : (
                    '未スケジュール'
                  )}
                </p>
              )}
            </div>

            {/* 推定時間 */}
            <div className="grid gap-2">
              <Label className="text-[#47473B] flex items-center gap-2">
                <Clock className="w-4 h-4" />
                推定時間
              </Label>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={estimatedMinutes}
                    onChange={(e) => setEstimatedMinutes(parseInt(e.target.value) || 30)}
                    min="1"
                    step="15"
                    className="bg-white border-[#D4D2C1] w-24"
                  />
                  <span className="text-[#47473B]">分</span>
                </div>
              ) : (
                <p className="text-[#1C1C14] font-medium">
                  {task.estimated_minutes}分
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="flex justify-between sm:justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {isDeleting ? '削除中...' : '削除'}
            </Button>

            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(false)}
                    className="border-[#C9C7B6] text-[#47473B]"
                  >
                    キャンセル
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={isSaving || !taskName.trim()}
                    className="bg-[#5E621B] hover:bg-[#464A02] text-white"
                  >
                    {isSaving ? '保存中...' : '保存'}
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="bg-[#3C6659] hover:bg-[#244E42] text-white"
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  編集
                </Button>
              )}
            </div>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}