/**
 * TaskEditDialog - タスク編集ダイアログ
 * タスクの時間編集と削除のみを行うシンプルなダイアログ
 */

import { useState, useEffect } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { Clock, Trash2, FileText, ChevronDown, ChevronUp } from 'lucide-react'
import { format } from 'date-fns'
import { SmallTask, UpdateSmallTaskData } from '@/types'

interface TaskEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: SmallTask | null
  onUpdateTask: (data: { id: string; data: UpdateSmallTaskData }) => Promise<void>
  onDeleteTask: (taskId: string) => Promise<void>
  onDeleteRecurringTasks?: (data: { parentId: string; mode?: 'all' | 'future' }) => Promise<void>
}

export function TaskEditDialog({
  open,
  onOpenChange,
  task,
  onUpdateTask,
  onDeleteTask,
  onDeleteRecurringTasks,
}: TaskEditDialogProps) {
  const [startTimeInput, setStartTimeInput] = useState('')
  const [endTimeInput, setEndTimeInput] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  
  // タスク詳細フィールドの状態
  const [detailsExpanded, setDetailsExpanded] = useState(false)
  const [taskGoal, setTaskGoal] = useState('')
  const [taskDod, setTaskDod] = useState('')
  const [taskInputs, setTaskInputs] = useState('')
  const [taskOutputs, setTaskOutputs] = useState('')
  const [taskProcess, setTaskProcess] = useState('')
  const [taskMissingInputs, setTaskMissingInputs] = useState('')
  const [taskNonGoals, setTaskNonGoals] = useState('')

  // 繰り返しタスクかどうかを判定（改善版）
  const isRecurringTask = !!(task && (
    // 親IDが設定されている（子タスク） - null/undefined/空文字列を除外
    (task.recurrence_parent_id && 
     task.recurrence_parent_id !== '' && 
     task.recurrence_parent_id !== null && 
     task.recurrence_parent_id !== undefined) || 
    // 繰り返し有効フラグが明示的にtrue
    task.recurrence_enabled === true ||
    // recurrence_patternが存在し、かつ空でない
    (task.recurrence_pattern && 
     typeof task.recurrence_pattern === 'object' && 
     Object.keys(task.recurrence_pattern).length > 0)
  ))

  // デバッグ用ログ（詳細版）
  useEffect(() => {
    if (task) {
      console.log('TaskEditDialog - 詳細なタスクデータ:', {
        name: task.name,
        id: task.id,
        recurrence_parent_id: task.recurrence_parent_id,
        recurrence_parent_id_type: typeof task.recurrence_parent_id,
        recurrence_enabled: task.recurrence_enabled,
        recurrence_enabled_type: typeof task.recurrence_enabled,
        recurrence_pattern: task.recurrence_pattern,
        recurrence_pattern_type: typeof task.recurrence_pattern,
        is_reportable: task.is_reportable,
        判定結果: isRecurringTask,
        判定詳細: {
          親ID判定: !!(task.recurrence_parent_id && task.recurrence_parent_id !== '' && task.recurrence_parent_id !== null),
          有効フラグ判定: task.recurrence_enabled === true,
          パターン判定: !!(task.recurrence_pattern && Object.keys(task.recurrence_pattern).length > 0)
        }
      })
    }
  }, [task, isRecurringTask])

  // 初期値の設定
  useEffect(() => {
    if (task) {
      if (task.scheduled_start) {
        const start = new Date(task.scheduled_start)
        setStartTimeInput(format(start, 'HH:mm'))
      }
      if (task.scheduled_end) {
        const end = new Date(task.scheduled_end)
        setEndTimeInput(format(end, 'HH:mm'))
      }
      
      // タスク詳細フィールドの初期値
      setTaskGoal(task.goal || '')
      setTaskDod(task.dod || '')
      setTaskInputs(task.inputs || '')
      setTaskOutputs(task.outputs || '')
      setTaskProcess(task.process || '')
      setTaskMissingInputs(task.missing_inputs || '')
      setTaskNonGoals(task.non_goals || '')
    }
  }, [task])

  // 時間から分数を計算
  const calculateMinutes = () => {
    if (!startTimeInput || !endTimeInput) return 0

    const [startHour, startMinute] = startTimeInput.split(':').map(Number)
    const [endHour, endMinute] = endTimeInput.split(':').map(Number)

    const startTotalMinutes = startHour * 60 + startMinute
    const endTotalMinutes = endHour * 60 + endMinute

    return Math.max(0, endTotalMinutes - startTotalMinutes)
  }

  // タスク更新
  const handleUpdate = async () => {
    if (!task || !startTimeInput || !endTimeInput) return

    setIsUpdating(true)
    try {
      const [startHour, startMinute] = startTimeInput.split(':').map(Number)
      const [endHour, endMinute] = endTimeInput.split(':').map(Number)
      
      // scheduled_startがnullの場合は現在時刻を使用
      const scheduledStart = new Date(task.scheduled_start || new Date().toISOString())
      scheduledStart.setHours(startHour, startMinute, 0, 0)
      
      const scheduledEnd = new Date(task.scheduled_end || task.scheduled_start || new Date().toISOString())
      scheduledEnd.setHours(endHour, endMinute, 0, 0)
      
      const updateData: UpdateSmallTaskData = {
        scheduled_start: scheduledStart.toISOString(),
        scheduled_end: scheduledEnd.toISOString(),
        estimated_minutes: calculateMinutes(),
        // タスク詳細フィールド
        goal: taskGoal || undefined,
        dod: taskDod || undefined,
        inputs: taskInputs || undefined,
        outputs: taskOutputs || undefined,
        process: taskProcess || undefined,
        missing_inputs: taskMissingInputs || undefined,
        non_goals: taskNonGoals || undefined,
      }

      await onUpdateTask({ id: task.id, data: updateData })
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to update task:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  // タスク削除（通常）
  const handleDelete = async () => {
    if (!task) {
      console.log('handleDelete: タスクがnullです')
      return
    }

    console.log('========== handleDelete 詳細デバッグ ==========')
    console.log('タスク名:', task.name)
    console.log('タスクID:', task.id)
    console.log('recurrence_parent_id:', task.recurrence_parent_id)
    console.log('recurrence_parent_id型:', typeof task.recurrence_parent_id)
    console.log('recurrence_enabled:', task.recurrence_enabled)
    console.log('recurrence_enabled型:', typeof task.recurrence_enabled)
    console.log('recurrence_pattern:', task.recurrence_pattern)
    console.log('isRecurringTask判定結果:', isRecurringTask)
    console.log('==============================================')

    // 繰り返しタスクの場合、削除オプションダイアログを表示
    if (isRecurringTask) {
      console.log('🔁 繰り返しタスクと判定 → AlertDialogを表示します')
      setShowDeleteDialog(true)
      console.log('showDeleteDialog state set to true')
      return
    }

    console.log('❌ 通常タスクと判定 → 直接削除します')
    // 通常タスクの削除
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

  // 繰り返しタスク削除モード選択後の処理
  const handleRecurringDelete = async (mode: 'this' | 'all') => {
    if (!task) return
    
    setShowDeleteDialog(false)
    setIsDeleting(true)
    
    try {
      if (mode === 'all' && onDeleteRecurringTasks) {
        // 親IDを取得（recurrence_parent_idがある場合はそれを、なければ自身のIDを使用）
        const parentId = task.recurrence_parent_id || task.id
        await onDeleteRecurringTasks({
          parentId,
          mode: 'all'
        })
      } else {
        // この回のみ削除
        await onDeleteTask(task.id)
      }
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to delete task:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const estimatedMinutes = calculateMinutes()

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[400px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              タスクを編集
            </DialogTitle>
            {task && (
              <div className="text-sm text-muted-foreground mt-2">
                {task.name}
                {isRecurringTask && <span className="ml-2">🔁 繰り返しタスク</span>}
                {/* デバッグ情報 */}
                <div className="text-xs mt-1 opacity-50">
                  parent_id: {task.recurrence_parent_id || 'なし'} | 
                  enabled: {task.recurrence_enabled ? 'true' : 'false'} |
                  reportable: {task.is_reportable ? 'true' : 'false'}
                </div>
              </div>
            )}
          </DialogHeader>

          <div className="grid gap-4 py-4">
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
                <p className="text-sm text-primary mt-1">
                  予定時間: {estimatedMinutes}分
                </p>
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
                <div className="grid gap-3 max-h-[300px] overflow-y-auto">
                  <div className="grid gap-2">
                    <Label htmlFor="goal" className="text-xs text-muted-foreground">
                      Goal - このタスクで実現したいこと
                    </Label>
                    <Textarea
                      id="goal"
                      value={taskGoal}
                      onChange={(e) => setTaskGoal(e.target.value)}
                      placeholder="例：ユーザーが簡単にタスクを管理できるUIを作る"
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
                      placeholder="例：タスクの追加・編集・削除が正常に動作し、レスポンスが1秒以内"
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
                      placeholder="例：デザインモックアップ、API仕様書、既存のコードベース"
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
                      placeholder="例：タスク管理コンポーネント、テストコード、ドキュメント"
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
                      placeholder="例：1. UIコンポーネント作成 2. ロジック実装 3. テスト作成 4. 動作確認"
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
                      placeholder="例：アイコンの素材、エラー時の仕様"
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
                      placeholder="例：パフォーマンス最適化、多言語対応"
                      className="min-h-[50px] resize-none text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <div className="flex items-center justify-between w-full">
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {isDeleting ? '削除中...' : '削除'}
              </Button>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="border-border text-muted-foreground hover:bg-accent"
                >
                  キャンセル
                </Button>
                <Button
                  onClick={handleUpdate}
                  disabled={
                    !startTimeInput ||
                    !endTimeInput ||
                    estimatedMinutes <= 0 ||
                    isUpdating
                  }
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {isUpdating ? '更新中...' : '更新'}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 繰り返しタスク削除選択ダイアログ */}
      {console.log('AlertDialog レンダリング状態:', { showDeleteDialog, isRecurringTask })}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>繰り返しタスクの削除</AlertDialogTitle>
            <AlertDialogDescription>
              このタスクは繰り返し設定されています。どのように削除しますか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel onClick={() => setShowDeleteDialog(false)}>
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleRecurringDelete('this')}
              className="bg-secondary hover:bg-secondary/90"
            >
              この回のみ削除
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => handleRecurringDelete('all')}
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