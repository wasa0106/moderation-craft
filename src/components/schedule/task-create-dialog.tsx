/**
 * TaskCreateDialog - タスク作成ダイアログ
 * カレンダー上でクリック/ドラッグしてタスクを作成
 */

import { useState, useEffect, useMemo } from 'react'
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
import { Clock, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Project, BigTask, CreateSmallTaskData } from '@/types'

interface TaskCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  startTime: Date | null
  endTime: Date | null
  projects: Project[]
  bigTasks: BigTask[]
  onCreateTask: (data: CreateSmallTaskData) => Promise<void>
  userId: string
}

export function TaskCreateDialog({
  open,
  onOpenChange,
  startTime,
  endTime,
  projects,
  bigTasks,
  onCreateTask,
  userId,
}: TaskCreateDialogProps) {
  const [taskName, setTaskName] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [selectedBigTaskId, setSelectedBigTaskId] = useState<string>('')
  const [startTimeInput, setStartTimeInput] = useState('')
  const [endTimeInput, setEndTimeInput] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // プロジェクトに紐づくBigTasksをフィルタリング
  const availableBigTasks = useMemo(() => {
    if (!selectedProjectId) return []
    return bigTasks.filter(task => task.project_id === selectedProjectId)
  }, [selectedProjectId, bigTasks])

  // 時間を時:分形式に変換
  const formatTimeInput = (date: Date | null) => {
    if (!date) return ''
    return format(date, 'HH:mm')
  }

  // 初期値の設定
  useEffect(() => {
    if (startTime && endTime) {
      setStartTimeInput(formatTimeInput(startTime))
      setEndTimeInput(formatTimeInput(endTime))
    }
  }, [startTime, endTime])

  // プロジェクト変更時にBigTaskをリセット
  useEffect(() => {
    setSelectedBigTaskId('')
  }, [selectedProjectId])

  // 時間から分数を計算
  const calculateMinutes = () => {
    if (!startTime || !endTime || !startTimeInput || !endTimeInput) return 0
    
    const [startHour, startMinute] = startTimeInput.split(':').map(Number)
    const [endHour, endMinute] = endTimeInput.split(':').map(Number)
    
    const startTotalMinutes = startHour * 60 + startMinute
    const endTotalMinutes = endHour * 60 + endMinute
    
    return Math.max(0, endTotalMinutes - startTotalMinutes)
  }

  const estimatedMinutes = calculateMinutes()

  // フォームのリセット
  const resetForm = () => {
    setTaskName('')
    setSelectedProjectId('')
    setSelectedBigTaskId('')
    setStartTimeInput('')
    setEndTimeInput('')
  }

  // タスク作成
  const handleCreate = async () => {
    if (!taskName || !selectedProjectId || !selectedBigTaskId || !startTime || !endTime) {
      return
    }

    setIsCreating(true)

    try {
      // 入力された時刻を使って正確な日時を作成
      const [startHour, startMinute] = startTimeInput.split(':').map(Number)
      const [endHour, endMinute] = endTimeInput.split(':').map(Number)
      
      const scheduledStart = new Date(startTime)
      scheduledStart.setHours(startHour, startMinute, 0, 0)
      
      const scheduledEnd = new Date(endTime)
      scheduledEnd.setHours(endHour, endMinute, 0, 0)

      const taskData: CreateSmallTaskData = {
        name: taskName,
        big_task_id: selectedBigTaskId,
        project_id: selectedProjectId,
        user_id: userId,
        estimated_minutes: estimatedMinutes,
        scheduled_start: scheduledStart.toISOString(),
        scheduled_end: scheduledEnd.toISOString(),
        // 削除されたフィールドは含めない
      }
      
      console.log('タスク作成データ:', {
        ...taskData,
        scheduled_start_formatted: format(scheduledStart, 'yyyy-MM-dd HH:mm'),
        scheduled_end_formatted: format(scheduledEnd, 'yyyy-MM-dd HH:mm')
      })

      await onCreateTask(taskData)
      console.log('タスク作成成功')
      resetForm()
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to create task:', error)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-[#FCFAEC] border-[#C9C7B6]">
        <DialogHeader>
          <DialogTitle className="text-[#1C1C14] flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#5E621B]" />
            新しいタスクを作成
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* タスク名 */}
          <div className="grid gap-2">
            <Label htmlFor="task-name" className="text-[#47473B]">
              タスク名 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="task-name"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="例：レポート作成"
              className="bg-white border-[#D4D2C1] focus:border-[#5E621B]"
            />
          </div>

          {/* プロジェクト選択 */}
          <div className="grid gap-2">
            <Label htmlFor="project" className="text-[#47473B]">
              プロジェクト <span className="text-red-500">*</span>
            </Label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="bg-white border-[#D4D2C1] focus:border-[#5E621B]">
                <SelectValue placeholder="プロジェクトを選択" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* BigTask選択 */}
          <div className="grid gap-2">
            <Label htmlFor="big-task" className="text-[#47473B]">
              大タスク <span className="text-red-500">*</span>
            </Label>
            <Select 
              value={selectedBigTaskId} 
              onValueChange={setSelectedBigTaskId}
              disabled={!selectedProjectId}
            >
              <SelectTrigger className="bg-white border-[#D4D2C1] focus:border-[#5E621B]">
                <SelectValue placeholder={selectedProjectId ? "大タスクを選択" : "先にプロジェクトを選択"} />
              </SelectTrigger>
              <SelectContent>
                {availableBigTasks.map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 時間設定 */}
          <div className="grid gap-2">
            <Label className="text-[#47473B] flex items-center gap-2">
              <Clock className="w-4 h-4" />
              時間設定
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="start-time" className="text-xs text-[#47473B]">
                  開始時刻
                </Label>
                <Input
                  id="start-time"
                  type="time"
                  value={startTimeInput}
                  onChange={(e) => setStartTimeInput(e.target.value)}
                  className="bg-white border-[#D4D2C1] focus:border-[#5E621B]"
                />
              </div>
              <div>
                <Label htmlFor="end-time" className="text-xs text-[#47473B]">
                  終了時刻
                </Label>
                <Input
                  id="end-time"
                  type="time"
                  value={endTimeInput}
                  onChange={(e) => setEndTimeInput(e.target.value)}
                  className="bg-white border-[#D4D2C1] focus:border-[#5E621B]"
                />
              </div>
            </div>
            {estimatedMinutes > 0 && (
              <p className="text-sm text-[#5E621B] mt-1">
                予定時間: {estimatedMinutes}分
              </p>
            )}
          </div>

          {/* 日付表示 */}
          {startTime && (
            <div className="text-sm text-[#47473B] bg-[#E5E3D2] p-3 rounded">
              <p className="font-medium">
                {format(startTime, 'yyyy年M月d日(E)', { locale: ja })}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-[#C9C7B6] text-[#47473B] hover:bg-[#E5E3D2]"
          >
            キャンセル
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!taskName || !selectedProjectId || !selectedBigTaskId || estimatedMinutes <= 0 || isCreating}
            className="bg-[#5E621B] hover:bg-[#464A02] text-white"
          >
            {isCreating ? '作成中...' : 'タスクを作成'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}