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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Clock, Calendar, ListTodo, Coffee, RefreshCw, ChevronDown, ChevronUp, Trash2, FileText } from 'lucide-react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Project, BigTask, SmallTask, CreateSmallTaskData, UpdateSmallTaskData, RecurrencePattern } from '@/types'
import { cn } from '@/lib/utils'
import { useBigTasks } from '@/hooks/use-big-tasks'
import { getRecurrenceDescription } from '@/lib/utils/recurrence-utils'

interface TaskCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  startTime: Date | null
  endTime: Date | null
  projects: Project[]
  bigTasks: BigTask[]
  onCreateTask: (data: CreateSmallTaskData) => Promise<void>
  userId: string
  // 編集モード用
  editMode?: boolean
  existingTask?: SmallTask | null
  onUpdateTask?: (data: { id: string; data: UpdateSmallTaskData }) => Promise<void>
  onDeleteTask?: (taskId: string) => Promise<void>
  // 繰り返しタスクの一括削除用
  onDeleteRecurringTasks?: (data: { parentId: string; mode?: 'all' | 'future' }) => Promise<void>
}

// フリータスクのプリセット
const ROUTINE_TASK_PRESETS = [
  { name: '移動', icon: '🚶' },
  { name: '身支度', icon: '🚿' },
  { name: '食事', icon: '🍽️' },
  { name: '休憩', icon: '☕' },
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
  editMode = false,
  existingTask = null,
  onUpdateTask,
  onDeleteTask,
  onDeleteRecurringTasks,
}: TaskCreateDialogProps) {
  const [taskType, setTaskType] = useState<'project' | 'routine'>('project')
  const [taskName, setTaskName] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [selectedBigTaskId, setSelectedBigTaskId] = useState<string>('')
  const [startTimeInput, setStartTimeInput] = useState('')
  const [endTimeInput, setEndTimeInput] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // 繰り返しタスク削除モード選択用
  const [showRecurringDeleteDialog, setShowRecurringDeleteDialog] = useState(false)
  const [recurringDeleteMode, setRecurringDeleteMode] = useState<'this' | 'all' | null>(null)
  
  // 繰り返し設定の状態
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false)
  const [recurrenceExpanded, setRecurrenceExpanded] = useState(false)
  const [recurrenceType, setRecurrenceType] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [recurrenceInterval, setRecurrenceInterval] = useState(1)
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([])
  const [recurrenceStartDate, setRecurrenceStartDate] = useState('')
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('')
  
  // タスク詳細フィールドの状態（デフォルトで開いた状態）
  const [detailsExpanded, setDetailsExpanded] = useState(true)
  const [taskGoal, setTaskGoal] = useState('')
  const [taskDod, setTaskDod] = useState('')
  const [taskInputs, setTaskInputs] = useState('')
  const [taskOutputs, setTaskOutputs] = useState('')
  const [taskProcess, setTaskProcess] = useState('')
  const [taskMissingInputs, setTaskMissingInputs] = useState('')
  const [taskNonGoals, setTaskNonGoals] = useState('')

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
    if (editMode && existingTask) {
      // 編集モード：既存タスクからデータを読み込む
      setTaskName(existingTask.name)
      setTaskType(existingTask.task_type || 'project')
      setSelectedProjectId(existingTask.project_id || '')
      setSelectedBigTaskId(existingTask.big_task_id || '')
      
      if (existingTask.scheduled_start) {
        const start = new Date(existingTask.scheduled_start)
        setStartTimeInput(format(start, 'HH:mm'))
        setRecurrenceStartDate(format(start, 'yyyy-MM-dd'))
      }
      
      if (existingTask.scheduled_end) {
        const end = new Date(existingTask.scheduled_end)
        setEndTimeInput(format(end, 'HH:mm'))
      }
      
      // タスク詳細フィールドの復元
      setTaskGoal(existingTask.goal || '')
      setTaskDod(existingTask.dod || '')
      setTaskInputs(existingTask.inputs || '')
      setTaskOutputs(existingTask.outputs || '')
      setTaskProcess(existingTask.process || '')
      setTaskMissingInputs(existingTask.missing_inputs || '')
      setTaskNonGoals(existingTask.non_goals || '')
      
      // 繰り返し設定の復元
      if (existingTask.recurrence_enabled && existingTask.recurrence_pattern) {
        setRecurrenceEnabled(true)
        setRecurrenceType(existingTask.recurrence_pattern.type)
        setRecurrenceInterval(existingTask.recurrence_pattern.interval)
        if (existingTask.recurrence_pattern.weekdays) {
          setSelectedWeekdays(existingTask.recurrence_pattern.weekdays)
        }
        if (existingTask.recurrence_pattern.end_condition.type === 'date' && 
            existingTask.recurrence_pattern.end_condition.value) {
          setRecurrenceEndDate(existingTask.recurrence_pattern.end_condition.value as string)
        }
      }
    } else if (startTime && endTime) {
      // 新規作成モード：選択した時間を設定
      setStartTimeInput(formatTimeInput(startTime))
      setEndTimeInput(formatTimeInput(endTime))
      // 開始日を自動設定
      const dateStr = format(startTime, 'yyyy-MM-dd')
      setRecurrenceStartDate(dateStr)
    }
  }, [startTime, endTime, editMode, existingTask])

  // プロジェクト変更時にBigTaskをリセット（新規作成時のみ）
  useEffect(() => {
    if (!editMode) {
      setSelectedBigTaskId('')
    }
  }, [selectedProjectId, editMode])

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
    setRecurrenceEnabled(false)
    setRecurrenceExpanded(false)
    setRecurrenceType('weekly')
    setRecurrenceInterval(1)
    setSelectedWeekdays([])
    setRecurrenceStartDate('')
    setRecurrenceEndDate('')
    setRecurringDeleteMode(null)
    setShowRecurringDeleteDialog(false)
    // タスク詳細フィールドをクリア
    setTaskGoal('')
    setTaskDod('')
    setTaskInputs('')
    setTaskOutputs('')
    setTaskProcess('')
    setTaskMissingInputs('')
    setTaskNonGoals('')
    // タスク詳細は開いた状態を維持
    setDetailsExpanded(true)
  }

  // 繰り返しタスクかどうかを判定
  const isRecurringTask = existingTask && (existingTask.recurrence_parent_id || existingTask.recurrence_enabled)

  // タスク作成/更新
  const handleSave = async () => {
    if (!taskName) {
      return
    }

    // プロジェクトタスクの場合は必須チェック
    if (taskType === 'project' && (!selectedProjectId || !selectedBigTaskId)) {
      return
    }

    setIsCreating(true)

    try {
      if (editMode && existingTask) {
        // 編集モード: タスクを更新（単一タスクのみ）
        const updateData: UpdateSmallTaskData = {
          name: taskName,
          big_task_id: taskType === 'project' ? selectedBigTaskId : undefined,
          project_id: taskType === 'project' ? selectedProjectId : undefined,
          task_type: taskType,
          is_reportable: taskType === 'project',
        }

        // 時刻が変更されている場合
        if (startTimeInput && endTimeInput && existingTask.scheduled_start) {
          const [startHour, startMinute] = startTimeInput.split(':').map(Number)
          const [endHour, endMinute] = endTimeInput.split(':').map(Number)
          
          const scheduledStart = new Date(existingTask.scheduled_start)
          scheduledStart.setHours(startHour, startMinute, 0, 0)
          
          const scheduledEnd = new Date(existingTask.scheduled_end || existingTask.scheduled_start)
          scheduledEnd.setHours(endHour, endMinute, 0, 0)
          
          updateData.scheduled_start = scheduledStart.toISOString()
          updateData.scheduled_end = scheduledEnd.toISOString()
          updateData.estimated_minutes = Math.ceil((scheduledEnd.getTime() - scheduledStart.getTime()) / (1000 * 60))
        }

        // タスク詳細フィールドの更新
        updateData.goal = taskGoal || undefined
        updateData.dod = taskDod || undefined
        updateData.inputs = taskInputs || undefined
        updateData.outputs = taskOutputs || undefined
        updateData.process = taskProcess || undefined
        updateData.missing_inputs = taskMissingInputs || undefined
        updateData.non_goals = taskNonGoals || undefined
        
        // 繰り返し設定の更新
        if (recurrenceEnabled) {
          updateData.recurrence_enabled = true
          updateData.recurrence_pattern = {
            type: recurrenceType,
            interval: recurrenceInterval,
            weekdays: recurrenceType === 'weekly' ? selectedWeekdays : undefined,
            start_date: recurrenceStartDate || (existingTask.scheduled_start || new Date().toISOString()),
            end_condition: recurrenceEndDate 
              ? { type: 'date', value: recurrenceEndDate }
              : { type: 'never' },
          }
        } else {
          updateData.recurrence_enabled = false
          updateData.recurrence_pattern = undefined
        }

        // 単一タスクの更新のみ（繰り返しタスクでも個別に編集）
        if (onUpdateTask) {
          await onUpdateTask({ id: existingTask.id, data: updateData })
        }
        console.log('タスク更新成功')
      } else {
        // 新規作成モード
        if (!startTime || !endTime) return
        
        const [startHour, startMinute] = startTimeInput.split(':').map(Number)
        const [endHour, endMinute] = endTimeInput.split(':').map(Number)

        const scheduledStart = new Date(startTime)
        scheduledStart.setHours(startHour, startMinute, 0, 0)

        const scheduledEnd = new Date(endTime)
        scheduledEnd.setHours(endHour, endMinute, 0, 0)

        // 繰り返しパターンを作成
        let recurrencePattern: RecurrencePattern | undefined
        if (recurrenceEnabled) {
          recurrencePattern = {
            type: recurrenceType,
            interval: recurrenceInterval,
            weekdays: recurrenceType === 'weekly' ? selectedWeekdays : undefined,
            start_date: recurrenceStartDate || scheduledStart.toISOString(),
            end_condition: recurrenceEndDate 
              ? { type: 'date', value: recurrenceEndDate }
              : { type: 'never' },
          }
        }

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
          is_emergency: false,
          recurrence_enabled: recurrenceEnabled,
          recurrence_pattern: recurrencePattern,
          // タスク詳細フィールド（任意）
          goal: taskGoal || undefined,
          dod: taskDod || undefined,
          inputs: taskInputs || undefined,
          outputs: taskOutputs || undefined,
          process: taskProcess || undefined,
          missing_inputs: taskMissingInputs || undefined,
          non_goals: taskNonGoals || undefined,
        }

        await onCreateTask(taskData)
        console.log('タスク作成成功')
      }
      
      resetForm()
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to save task:', error)
    } finally {
      setIsCreating(false)
    }
  }

  // タスク削除
  const handleDelete = async () => {
    if (!editMode || !existingTask) return
    
    // 繰り返しタスクの削除の場合、モード選択ダイアログを表示
    if (isRecurringTask) {
      setShowRecurringDeleteDialog(true)
      return
    }
    
    // 通常タスクの削除
    setIsDeleting(true)
    try {
      if (onDeleteTask) {
        await onDeleteTask(existingTask.id)
      }
      resetForm()
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to delete task:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  // フリータスクのプリセット選択
  const handlePresetSelect = (preset: (typeof ROUTINE_TASK_PRESETS)[0]) => {
    setTaskName(preset.name)
  }

  // 繰り返しタスク削除モード選択後の処理
  const handleRecurringDeleteModeSelect = async (mode: 'this' | 'all') => {
    setShowRecurringDeleteDialog(false)
    
    if (!editMode || !existingTask) return
    
    setIsDeleting(true)
    try {
      if (mode === 'all' && onDeleteRecurringTasks) {
        const parentId = existingTask.recurrence_parent_id || existingTask.id
        await onDeleteRecurringTasks({
          parentId,
          mode: 'all'
        })
      } else if (onDeleteTask) {
        await onDeleteTask(existingTask.id)
      }
      resetForm()
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to delete task:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] bg-card border-border flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            {editMode ? 'タスクを編集' : '新しいタスクを作成'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4 overflow-y-auto flex-1 min-h-0">
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
              フリータスク
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
            /* フリータスクのプリセット */
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

          {/* 繰り返し設定 */}
          <div className={cn(
            "grid gap-3 border rounded-lg p-3 transition-all",
            recurrenceEnabled 
              ? "border-green-500/50" 
              : "border-border"
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className={cn(
                  "w-4 h-4 transition-colors",
                  recurrenceEnabled ? "text-green-600 dark:text-green-500" : "text-muted-foreground"
                )} />
                <Label 
                  htmlFor="recurrence-toggle" 
                  className={cn(
                    "transition-colors font-medium",
                    recurrenceEnabled ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  繰り返し設定
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="recurrence-toggle"
                  checked={recurrenceEnabled}
                  onCheckedChange={(checked) => {
                    setRecurrenceEnabled(checked)
                    if (checked) setRecurrenceExpanded(true)
                  }}
                />
                {recurrenceEnabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setRecurrenceExpanded(!recurrenceExpanded)}
                    className="h-6 w-6 p-0"
                  >
                    {recurrenceExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>

            {recurrenceEnabled && recurrenceExpanded && (
              <div className="grid gap-3 pt-2 border-t border-border">
                {/* 単位 */}
                <div className="grid gap-2">
                  <Label className="text-xs text-muted-foreground">単位</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={recurrenceType === 'daily' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setRecurrenceType('daily')}
                    >
                      毎日
                    </Button>
                    <Button
                      type="button"
                      variant={recurrenceType === 'weekly' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setRecurrenceType('weekly')}
                    >
                      毎週
                    </Button>
                    <Button
                      type="button"
                      variant={recurrenceType === 'monthly' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setRecurrenceType('monthly')}
                    >
                      毎月
                    </Button>
                  </div>
                </div>

                {/* 期間 */}
                <div className="grid gap-2">
                  <Label className="text-xs text-muted-foreground">期間</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={recurrenceStartDate}
                      onChange={(e) => setRecurrenceStartDate(e.target.value)}
                      className="flex-1 bg-background border-border focus:border-primary"
                    />
                    <span className="text-sm text-muted-foreground">〜</span>
                    <Input
                      type="date"
                      value={recurrenceEndDate}
                      onChange={(e) => setRecurrenceEndDate(e.target.value)}
                      placeholder="終了日（任意）"
                      className="flex-1 bg-background border-border focus:border-primary"
                    />
                  </div>
                  {!recurrenceEndDate && (
                    <p className="text-xs text-muted-foreground">終了日を指定しない場合は無期限になります</p>
                  )}
                </div>

                {/* 周期 */}
                <div className="grid gap-2">
                  <Label className="text-xs text-muted-foreground">周期</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      max="30"
                      value={recurrenceInterval}
                      onChange={(e) => setRecurrenceInterval(parseInt(e.target.value) || 1)}
                      className="w-20 bg-background border-border focus:border-primary"
                    />
                    <span className="text-sm text-muted-foreground">
                      {recurrenceType === 'daily' ? '日ごと' :
                       recurrenceType === 'weekly' ? '週間ごと' :
                       'ヶ月ごと'}
                    </span>
                  </div>
                </div>

                {/* 曜日（週単位の場合） */}
                {recurrenceType === 'weekly' && (
                  <div className="grid gap-2">
                    <Label className="text-xs text-muted-foreground">曜日</Label>
                    <div className="flex gap-2 flex-wrap">
                      {['日', '月', '火', '水', '木', '金', '土'].map((day, index) => {
                        const isSelected = selectedWeekdays.includes(index)
                        return (
                          <div key={index} className="flex items-center gap-1">
                            <Checkbox
                              id={`weekday-${index}`}
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedWeekdays([...selectedWeekdays, index])
                                } else {
                                  setSelectedWeekdays(selectedWeekdays.filter(d => d !== index))
                                }
                              }}
                              className={cn(
                                isSelected && "data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500 data-[state=checked]:text-white"
                              )}
                            />
                            <Label
                              htmlFor={`weekday-${index}`}
                              className="text-sm cursor-pointer"
                            >
                              {day}
                            </Label>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* 繰り返しパターンの説明 */}
                {recurrenceEnabled && (
                  <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                    {(() => {
                      const pattern: RecurrencePattern = {
                        type: recurrenceType,
                        interval: recurrenceInterval,
                        weekdays: recurrenceType === 'weekly' ? selectedWeekdays : undefined,
                        start_date: recurrenceStartDate || (startTime?.toISOString() || new Date().toISOString()),
                        end_condition: recurrenceEndDate
                          ? { type: 'date', value: recurrenceEndDate }
                          : { type: 'never' },
                      }
                      return getRecurrenceDescription(pattern)
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* タスク詳細設定（折りたたみ可能） */}
          <div className="grid gap-3">
            <button
              type="button"
              onClick={() => setDetailsExpanded(!detailsExpanded)}
              className="flex items-center justify-between p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">タスク詳細（任意）</span>
              </div>
              {detailsExpanded ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            {detailsExpanded && (
              <div className="grid gap-3 pl-6">
                <div className="grid gap-2">
                  <Label htmlFor="goal" className="text-xs text-muted-foreground">
                    Goal - このタスクで実現したいこと
                  </Label>
                  <Textarea
                    id="goal"
                    value={taskGoal}
                    onChange={(e) => setTaskGoal(e.target.value)}
                    placeholder=""
                    className="min-h-[50px] resize-none text-sm"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="dod" className="text-xs text-muted-foreground">
                    DoD - 完了条件（QCD基準を含めて具体的に）
                  </Label>
                  <Textarea
                    id="dod"
                    value={taskDod}
                    onChange={(e) => setTaskDod(e.target.value)}
                    placeholder=""
                    className="min-h-[50px] resize-none text-sm"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="inputs" className="text-xs text-muted-foreground">
                    Inputs - 手元にある材料、情報
                  </Label>
                  <Textarea
                    id="inputs"
                    value={taskInputs}
                    onChange={(e) => setTaskInputs(e.target.value)}
                    placeholder=""
                    className="min-h-[50px] resize-none text-sm"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="outputs" className="text-xs text-muted-foreground">
                    Outputs - 成果物
                  </Label>
                  <Textarea
                    id="outputs"
                    value={taskOutputs}
                    onChange={(e) => setTaskOutputs(e.target.value)}
                    placeholder=""
                    className="min-h-[50px] resize-none text-sm"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="process" className="text-xs text-muted-foreground">
                    Process - 作業手順
                  </Label>
                  <Textarea
                    id="process"
                    value={taskProcess}
                    onChange={(e) => setTaskProcess(e.target.value)}
                    placeholder=""
                    className="min-h-[60px] resize-none text-sm"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="missing_inputs" className="text-xs text-muted-foreground">
                    Missing Inputs - 不足している情報
                  </Label>
                  <Textarea
                    id="missing_inputs"
                    value={taskMissingInputs}
                    onChange={(e) => setTaskMissingInputs(e.target.value)}
                    placeholder=""
                    className="min-h-[50px] resize-none text-sm"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="non_goals" className="text-xs text-muted-foreground">
                    Non Goals - 今回はやらないこと
                  </Label>
                  <Textarea
                    id="non_goals"
                    value={taskNonGoals}
                    onChange={(e) => setTaskNonGoals(e.target.value)}
                    placeholder=""
                    className="min-h-[50px] resize-none text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-shrink-0">
          <div className="flex items-center justify-between w-full">
            <div>
              {editMode && (
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {isDeleting ? '削除中...' : '削除'}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-border text-muted-foreground hover:bg-accent"
              >
                キャンセル
              </Button>
              <Button
                onClick={handleSave}
                disabled={
                  !taskName ||
                  (editMode ? false : estimatedMinutes <= 0) ||
                  isCreating ||
                  (taskType === 'project' && (!selectedProjectId || !selectedBigTaskId))
                }
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isCreating ? (editMode ? '更新中...' : '作成中...') : (editMode ? '更新' : 'タスクを作成')}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* 繰り返しタスク削除モード選択ダイアログ */}
    <AlertDialog open={showRecurringDeleteDialog} onOpenChange={setShowRecurringDeleteDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>繰り返しタスクの削除</AlertDialogTitle>
          <AlertDialogDescription>
            このタスクは繰り返し設定されています。どのように削除しますか？
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel 
            onClick={() => {
              setShowRecurringDeleteDialog(false)
            }}
          >
            キャンセル
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => handleRecurringDeleteModeSelect('this')}
            className="bg-secondary hover:bg-secondary/90"
          >
            この回のみ削除
          </AlertDialogAction>
          <AlertDialogAction
            onClick={() => handleRecurringDeleteModeSelect('all')}
            className="bg-primary hover:bg-primary/90"
          >
            すべての繰り返しを削除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
