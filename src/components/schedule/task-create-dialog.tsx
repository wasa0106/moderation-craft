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
import { Clock, Calendar, ListTodo, Coffee } from 'lucide-react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Project, BigTask, CreateSmallTaskData } from '@/types'
import { cn } from '@/lib/utils'
import { useBigTasks } from '@/hooks/use-big-tasks'

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

// ルーチンタスクのプリセット
const ROUTINE_TASK_PRESETS = [
  { name: '移動', icon: '🚶', estimatedMinutes: 30 },
  { name: '身支度', icon: '🚿', estimatedMinutes: 30 },
  { name: '食事', icon: '🍽️', estimatedMinutes: 30 },
  { name: '休憩', icon: '☕', estimatedMinutes: 15 },
  { name: '掃除', icon: '🧹', estimatedMinutes: 30 },
  { name: '買い物', icon: '🛒', estimatedMinutes: 60 },
  { name: '運動', icon: '🏃', estimatedMinutes: 45 },
  { name: '読書', icon: '📚', estimatedMinutes: 30 },
]

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
  const [taskType, setTaskType] = useState<'project' | 'routine'>('project')
  const [taskName, setTaskName] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [selectedBigTaskId, setSelectedBigTaskId] = useState<string>('')
  const [startTimeInput, setStartTimeInput] = useState('')
  const [endTimeInput, setEndTimeInput] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // 選択されたプロジェクトの全BigTasksを取得
  const { bigTasks: allProjectBigTasks } = useBigTasks(userId, selectedProjectId)

  // プロジェクトに紐づくBigTasksをフィルタリング
  const availableBigTasks = useMemo(() => {
    if (!selectedProjectId) return []

    // デバッグログ
    console.log('TaskCreateDialog - BigTasks:', {
      selectedProjectId,
      allProjectBigTasks: allProjectBigTasks.length,
      propsBigTasks: bigTasks.length,
      allProjectBigTasksData: allProjectBigTasks.map(t => ({
        id: t.id,
        name: t.name,
        project_id: t.project_id,
      })),
    })

    // 独自に取得したBigTasksを優先し、なければpropsのbigTasksを使用
    const tasksToUse = allProjectBigTasks.length > 0 ? allProjectBigTasks : bigTasks
    return tasksToUse.filter(task => task.project_id === selectedProjectId)
  }, [selectedProjectId, allProjectBigTasks, bigTasks])

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
    setTaskType('project')
    setTaskName('')
    setSelectedProjectId('')
    setSelectedBigTaskId('')
    setStartTimeInput('')
    setEndTimeInput('')
  }

  // タスク作成
  const handleCreate = async () => {
    if (!taskName || !startTime || !endTime) {
      return
    }

    // プロジェクトタスクの場合は必須チェック
    if (taskType === 'project' && (!selectedProjectId || !selectedBigTaskId)) {
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
        big_task_id: taskType === 'project' ? selectedBigTaskId : undefined,
        project_id: taskType === 'project' ? selectedProjectId : undefined,
        user_id: userId,
        estimated_minutes: estimatedMinutes,
        scheduled_start: scheduledStart.toISOString(),
        scheduled_end: scheduledEnd.toISOString(),
        task_type: taskType,
        is_reportable: taskType === 'project',
      }

      console.log('タスク作成データ:', {
        ...taskData,
        scheduled_start_formatted: format(scheduledStart, 'yyyy-MM-dd HH:mm'),
        scheduled_end_formatted: format(scheduledEnd, 'yyyy-MM-dd HH:mm'),
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

  // ルーチンタスクのプリセット選択
  const handlePresetSelect = (preset: (typeof ROUTINE_TASK_PRESETS)[0]) => {
    setTaskName(preset.name)
    // 終了時刻を予定時間に基づいて自動設定
    if (startTimeInput) {
      const [startHour, startMinute] = startTimeInput.split(':').map(Number)
      const endTotalMinutes = startHour * 60 + startMinute + preset.estimatedMinutes
      const endHour = Math.floor(endTotalMinutes / 60)
      const endMinute = endTotalMinutes % 60
      setEndTimeInput(`${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            新しいタスクを作成
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* タスクタイプ選択 */}
          <div className="flex gap-2 p-1 bg-muted rounded-lg">
            <Button
              type="button"
              variant={taskType === 'project' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTaskType('project')}
              className="flex-1 gap-2"
            >
              <ListTodo className="w-4 h-4" />
              プロジェクトタスク
            </Button>
            <Button
              type="button"
              variant={taskType === 'routine' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTaskType('routine')}
              className="flex-1 gap-2"
            >
              <Coffee className="w-4 h-4" />
              ルーチンタスク
            </Button>
          </div>
          {taskType === 'project' ? (
            <>
              {/* プロジェクト選択 */}
              <div className="grid gap-2">
                <Label htmlFor="project" className="text-muted-foreground">
                  プロジェクト <span className="text-red-500">*</span>
                </Label>
                <div className="flex flex-wrap gap-2">
                  {projects.map(project => (
                    <Button
                      key={project.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedProjectId(project.id)}
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

              {/* BigTask選択 */}
              <div className="grid gap-2">
                <Label htmlFor="big-task" className="text-muted-foreground">
                  大タスク <span className="text-red-500">*</span>
                </Label>
                {!selectedProjectId ? (
                  <p className="text-sm text-muted-foreground">
                    先にプロジェクトを選択してください
                  </p>
                ) : availableBigTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    選択されたプロジェクトに大タスクがありません
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {availableBigTasks.map(task => (
                      <Button
                        key={task.id}
                        type="button"
                        variant={selectedBigTaskId === task.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedBigTaskId(task.id)}
                        disabled={!selectedProjectId}
                        className={cn(
                          'h-auto px-3 py-1.5 font-normal transition-all max-w-xs',
                          selectedBigTaskId === task.id && 'ring-2 ring-offset-2',
                          !selectedProjectId && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <span className="text-sm truncate">{task.name}</span>
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ルーチンタスクのプリセット */
            <div className="grid gap-2">
              <Label className="text-muted-foreground">よく使うタスク</Label>
              <div className="grid grid-cols-4 gap-2">
                {ROUTINE_TASK_PRESETS.map(preset => (
                  <Button
                    key={preset.name}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handlePresetSelect(preset)}
                    className="flex flex-col items-center gap-1 h-auto py-2"
                  >
                    <span className="text-lg">{preset.icon}</span>
                    <span className="text-xs">{preset.name}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* タスク名 */}
          <div className="grid gap-2">
            <Label htmlFor="task-name" className="text-muted-foreground">
              タスク名 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="task-name"
              value={taskName}
              onChange={e => setTaskName(e.target.value)}
              className="bg-background border-border focus:border-primary"
            />
          </div>

          {/* 時間設定 */}
          <div className="grid gap-2">
            <Label className="text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" />
              時間設定
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="start-time" className="text-xs text-muted-foreground">
                  開始時刻
                </Label>
                <Input
                  id="start-time"
                  type="time"
                  value={startTimeInput}
                  onChange={e => setStartTimeInput(e.target.value)}
                  className="bg-background border-border focus:border-primary"
                />
              </div>
              <div>
                <Label htmlFor="end-time" className="text-xs text-muted-foreground">
                  終了時刻
                </Label>
                <Input
                  id="end-time"
                  type="time"
                  value={endTimeInput}
                  onChange={e => setEndTimeInput(e.target.value)}
                  className="bg-background border-border focus:border-primary"
                />
              </div>
            </div>
            {estimatedMinutes > 0 && (
              <p className="text-sm text-primary mt-1">予定時間: {estimatedMinutes}分</p>
            )}
          </div>

          {/* 日付表示 */}
          {startTime && (
            <div className="text-sm text-muted-foreground bg-muted p-3 rounded">
              <p className="font-medium">{format(startTime, 'yyyy年M月d日(E)', { locale: ja })}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-border text-muted-foreground hover:bg-accent"
          >
            キャンセル
          </Button>
          <Button
            onClick={handleCreate}
            disabled={
              !taskName ||
              estimatedMinutes <= 0 ||
              isCreating ||
              (taskType === 'project' && (!selectedProjectId || !selectedBigTaskId))
            }
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isCreating ? '作成中...' : 'タスクを作成'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
