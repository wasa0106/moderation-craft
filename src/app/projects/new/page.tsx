/**
 * ProjectCreatePage - 高度なプロジェクト作成ページ
 * DEVELOPMENT_CONTEXT.mdの要件に基づいて実装
 */

'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar, Clock, AlertTriangle, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useProjectCreationStore } from '@/stores/project-creation-store'
import { useProjects } from '@/hooks/use-projects'
import { useBigTasks } from '@/hooks/use-big-tasks'
import { format, differenceInDays } from 'date-fns'
import { EditableTaskTable } from '@/components/project/editable-task-table'
import { GanttChart } from '@/components/project/gantt-chart'
import { ProjectColorPicker } from '@/components/project/project-color-picker'
import { cn } from '@/lib/utils'

// 定数
const CURRENT_USER_ID = 'current-user'

export default function ProjectCreatePage() {
  const router = useRouter()
  const { createProject, deleteProject } = useProjects(CURRENT_USER_ID)
  const { createBigTask, deleteBigTask } = useBigTasks(CURRENT_USER_ID)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const isMountedRef = useRef(true)

  const {
    // State
    projectName,
    goal,
    startDate,
    endDate,
    totalWeeks,
    projectColor,
    weekdayWorkDays,
    weekendWorkDays,
    weekdayHoursPerDay,
    weekendHoursPerDay,
    weeklyAvailableHours,
    totalAvailableHours,
    tasks,
    totalTaskHours,
    projectCategories,
    weeklyAllocations,
    taskSchedules,
    validationErrors,

    // Actions
    setProjectName,
    setGoal,
    setStartDate,
    setEndDate,
    setProjectColor,
    setWeekdayWorkDays,
    setWeekendWorkDays,
    setWeekdayHoursPerDay,
    setWeekendHoursPerDay,
    addTask,
    updateTask,
    deleteTask,
    reorderTasks,
    updateTaskWeeks,
    addCategory,
    updateTaskCategory,
    calculateWeeklyHours,
    calculateTaskAllocation,
    calculateTotalWeeks,
    validateForm,
    getValidTasks,
    reset,
  } = useProjectCreationStore()

  // 初期計算
  useEffect(() => {
    calculateTotalWeeks()
    calculateWeeklyHours()
  }, [calculateTotalWeeks, calculateWeeklyHours])

  // 初期タスクの追加（初回マウント時のみ）
  useEffect(() => {
    if (tasks.length === 0) {
      addTask()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // タスク配分の計算
  useEffect(() => {
    calculateTaskAllocation()
  }, [tasks, weeklyAvailableHours, totalWeeks, calculateTaskAllocation])

  // クリーンアップ
  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault()
    }

    // エラーをクリア
    setSubmitError(null)

    if (process.env.NODE_ENV === 'development') {
      console.log('=== プロジェクト作成開始 ===')
      console.log('フォームデータ:', {
        projectName,
        goal,
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        tasksCount: tasks.length,
        validTasksCount: getValidTasks().length,
      })
    }

    if (!validateForm()) {
      if (process.env.NODE_ENV === 'development') {
        console.log('バリデーションエラー:', validationErrors)
      }
      toast.error('入力内容に不備があります')
      return
    }

    setIsSubmitting(true)

    try {
      // プロジェクトデータを作成
      const projectData = {
        user_id: CURRENT_USER_ID,
        name: projectName,
        goal,
        deadline: format(endDate, 'yyyy-MM-dd'),
        status: 'active' as const,
        version: 1,
        estimated_total_hours: totalTaskHours,
        color: projectColor,
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('作成するプロジェクトデータ:', projectData)
      }
      const newProject = await createProject(projectData)
      if (process.env.NODE_ENV === 'development') {
        console.log('作成されたプロジェクト:', newProject)
      }

      // BigTasksを作成（1タスク1BigTask）
      const validTasks = getValidTasks()
      const createdBigTasks: Array<{ id: string }> = [] // 作成済みBigTaskのリスト（ロールバック用）
      
      if (process.env.NODE_ENV === 'development') {
        console.log('BigTask作成開始. タスク数:', validTasks.length)
      }

      try {
        // BigTaskを順次作成（エラー時のロールバックを容易にするため）
        for (const task of validTasks) {
          // taskSchedulesから該当タスクの開始日・終了日を取得
          const schedule = taskSchedules.get(task.id)
          if (!schedule) {
            if (process.env.NODE_ENV === 'development') {
              console.log(`タスク「${task.name}」: スケジュールなしのためスキップ`)
            }
            continue
          }

          const bigTaskData = {
            project_id: newProject.id,
            user_id: CURRENT_USER_ID,
            name: task.name,
            category: task.category || 'その他',
            start_date: schedule.startDate,
            end_date: schedule.endDate,
            estimated_hours: task.estimatedHours,
            status: 'pending' as const,
          }

          if (process.env.NODE_ENV === 'development') {
            console.log(`タスク「${task.name}」のBigTaskデータ:`, bigTaskData)
          }

          const result = await createBigTask(bigTaskData)
          createdBigTasks.push(result)
          
          if (process.env.NODE_ENV === 'development') {
            console.log(`タスク「${task.name}」のBigTask作成成功:`, result)
          }
        }

        if (process.env.NODE_ENV === 'development') {
          console.log('作成されたBigTask数:', createdBigTasks.length)
        }

        // 「その他」タスクを自動作成
        try {
          const otherTaskData = {
            project_id: newProject.id,
            user_id: CURRENT_USER_ID,
            name: 'その他',
            category: 'その他',
            start_date: format(startDate, 'yyyy-MM-dd'),
            end_date: format(endDate, 'yyyy-MM-dd'),
            estimated_hours: 1,
            status: 'pending' as const,
          }

          if (process.env.NODE_ENV === 'development') {
            console.log('「その他」タスクのBigTaskデータ:', otherTaskData)
          }

          const otherTask = await createBigTask(otherTaskData)
          createdBigTasks.push(otherTask)

          if (process.env.NODE_ENV === 'development') {
            console.log('「その他」タスクのBigTask作成成功:', otherTask)
          }
        } catch (otherTaskError) {
          // 「その他」タスク作成失敗はログに記録するが、プロジェクト作成は続行
          console.error('「その他」タスクの作成に失敗しました:', otherTaskError)
        }
      } catch (taskError) {
        // BigTask作成失敗時のロールバック
        if (process.env.NODE_ENV === 'development') {
          console.error('BigTask作成中にエラーが発生しました。ロールバックを実行します。', taskError)
        }
        
        // ロールバック処理
        try {
          // 作成済みBigTaskを削除
          if (createdBigTasks.length > 0) {
            for (const bigTask of createdBigTasks) {
              await deleteBigTask(bigTask.id)
            }
          }
          
          // プロジェクトを削除
          await deleteProject(newProject.id)
          
          if (process.env.NODE_ENV === 'development') {
            console.log('ロールバック完了')
          }
        } catch (rollbackError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('ロールバック中にエラー:', rollbackError)
          }
          // ロールバック自体が失敗した場合は、ユーザーに通知
          toast.error('データの整合性に問題が発生しました。管理者にお問い合わせください。')
        }
        
        // 元のエラーを再スロー
        throw taskError
      }

      // マウントされている場合のみ実行
      if (isMountedRef.current) {
        toast.success('プロジェクトが正常に作成されました')
        reset()
        router.push('/projects')
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('=== プロジェクト作成エラー ===')
        console.error('エラー詳細:', error)
      }
      
      if (isMountedRef.current) {
        if (error instanceof Error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('エラーメッセージ:', error.message)
            console.error('スタックトレース:', error.stack)
          }
          setSubmitError(error.message)
          toast.error(`エラー: ${error.message}`)
        } else {
          setSubmitError('プロジェクトの作成に失敗しました')
          toast.error('プロジェクトの作成に失敗しました')
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false)
      }
    }
  }

  const handleCancel = () => {
    reset()
    router.push('/projects')
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <form onSubmit={handleSubmit} className="flex-1">
        <div className="space-y-6">
            {/* エラー表示 */}
            {submitError && (
              <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <p className="text-sm text-destructive">{submitError}</p>
                </div>
              </div>
            )}

            {/* 1. プロジェクト基本情報 */}
              <Card className="border border-border bg-surface-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    プロジェクト基本情報
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="projectName">プロジェクト名 *</Label>
                    <Input
                      id="projectName"
                      placeholder="例：新サービスのランディングページ作成"
                      value={projectName}
                      onChange={e => setProjectName(e.target.value)}
                      className={`focus-visible ${validationErrors.projectName ? 'border-destructive' : ''}`}
                    />
                    {validationErrors.projectName && (
                      <p className="text-sm text-destructive">{validationErrors.projectName}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="goal">定量目標 *</Label>
                    <Textarea
                      id="goal"
                      placeholder="例：月間CV数100件を達成するランディングページを2週間で完成"
                      value={goal}
                      onChange={e => setGoal(e.target.value)}
                      className={`focus-visible ${validationErrors.goal ? 'border-destructive' : ''}`}
                      rows={3}
                    />
                    {validationErrors.goal && (
                      <p className="text-sm text-destructive">{validationErrors.goal}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="startDate">開始日</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={format(startDate, 'yyyy-MM-dd')}
                        onChange={e => setStartDate(new Date(e.target.value))}
                        className="focus-visible"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="endDate">期限 *</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={format(endDate, 'yyyy-MM-dd')}
                        onChange={e => setEndDate(new Date(e.target.value))}
                        className={`focus-visible ${validationErrors.endDate ? 'border-destructive' : ''}`}
                      />
                      {validationErrors.endDate && (
                        <p className="text-sm text-destructive">{validationErrors.endDate}</p>
                      )}
                    </div>
                    <div className="flex items-end md:col-span-1">
                      <div className="w-full h-10 bg-muted/30 rounded-md flex items-center">
                        <p className="text-sm text-muted-foreground">
                          期間: {differenceInDays(endDate, startDate)}日間 ({totalWeeks}週間)
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4">
                    <ProjectColorPicker
                      value={projectColor}
                      onChange={setProjectColor}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* 2. 投下可能時間の計算 */}
              <Card className="border border-border bg-surface-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-card-foreground">
                    <Clock className="h-5 w-5" />
                    投下可能時間の計算
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>平日の作業可能日数</Label>
                      <Select
                        value={weekdayWorkDays.toString()}
                        onValueChange={value => setWeekdayWorkDays(parseInt(value))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[0, 1, 2, 3, 4, 5].map(days => (
                            <SelectItem key={days} value={days.toString()}>
                              {days}日
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>休日の作業可能日数</Label>
                      <Select
                        value={weekendWorkDays.toString()}
                        onValueChange={value => setWeekendWorkDays(parseInt(value))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[0, 1, 2].map(days => (
                            <SelectItem key={days} value={days.toString()}>
                              {days}日
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>平日の作業時間（時間/日）</Label>
                      <Input
                        type="number"
                        min="0"
                        max="24"
                        step="0.5"
                        value={weekdayHoursPerDay === 0 ? '' : weekdayHoursPerDay}
                        onChange={e => setWeekdayHoursPerDay(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>休日の作業時間（時間/日）</Label>
                      <Input
                        type="number"
                        min="0"
                        max="24"
                        step="0.5"
                        value={weekendHoursPerDay === 0 ? '' : weekendHoursPerDay}
                        onChange={e => setWeekendHoursPerDay(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>


                  <div className="p-3 bg-accent/10 rounded-lg border border-accent/20">
                    <p className="text-sm font-medium text-accent-foreground">
                      週間作業可能時間: {weeklyAvailableHours}時間
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {weekdayWorkDays}日 × {weekdayHoursPerDay}h + {weekendWorkDays}日 × {weekendHoursPerDay}h
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* 3. タスク一覧 */}
              <Card className="border border-border bg-surface-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-card-foreground">
                    <Plus className="h-5 w-5" />
                    タスク一覧
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <EditableTaskTable
                    tasks={tasks}
                    totalTaskHours={totalTaskHours}
                    projectCategories={projectCategories}
                    onAddTask={addTask}
                    onUpdateTask={updateTask}
                    onDeleteTask={deleteTask}
                    onReorderTasks={reorderTasks}
                    onAddCategory={addCategory}
                    onUpdateTaskCategory={updateTaskCategory}
                  />

                  {/* タスクバリデーションエラー */}
                  {validationErrors.tasks && (
                    <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <p className="text-sm text-destructive">{validationErrors.tasks}</p>
                    </div>
                  )}

                  {/* 合計時間サマリー */}
                  {tasks.length > 0 && (
                    <div
                      className={cn(
                        'mt-6 p-4 rounded-lg',
                        totalTaskHours > totalAvailableHours
                          ? 'bg-destructive/10 border border-destructive/20'
                          : 'bg-surface-1'
                      )}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium">合計時間</span>
                        <span className="text-lg font-bold">{totalTaskHours.toFixed(1)}時間</span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-sm text-muted-foreground">利用可能時間</span>
                        <span className="text-sm text-muted-foreground">
                          {totalAvailableHours.toFixed(1)}時間
                        </span>
                      </div>
                      {totalTaskHours > totalAvailableHours && (
                        <div className="mt-3 flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-destructive">
                            タスクの合計時間（{totalTaskHours.toFixed(1)}時間）が利用可能時間（
                            {totalAvailableHours.toFixed(1)}時間）を超えています。
                            <br />
                            タスクを調整するか、プロジェクト期間を延長してください。
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ガントチャート */}
              {tasks.length > 0 && startDate && endDate && (
                <Card className="border border-border bg-surface-1">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      ガントチャート
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <GanttChart
                      tasks={tasks}
                      startDate={startDate}
                      endDate={endDate}
                      weeklyAllocations={weeklyAllocations}
                      onTaskUpdate={updateTaskWeeks}
                      totalTaskHours={totalTaskHours}
                      totalAvailableHours={totalAvailableHours}
                    />
                  </CardContent>
                </Card>
              )}

              {/* アクションボタン */}
              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={isSubmitting || !projectName || !goal}
                  className="flex-1 focus-visible"
                >
                  {isSubmitting ? '作成中...' : 'プロジェクトを作成'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                  className="focus-visible"
                >
                  キャンセル
                </Button>
              </div>
        </div>
      </form>
    </div>
  )
}
