/**
 * ProjectCreatePage - 高度なプロジェクト作成ページ
 * DEVELOPMENT_CONTEXT.mdの要件に基づいて実装
 */

'use client'

import { useEffect, useState } from 'react'
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
import { Progress } from '@/components/ui/progress'
import { ArrowLeft, Calendar, Clock, AlertTriangle, Plus } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useProjectCreationStore } from '@/stores/project-creation-store'
import { useProjects } from '@/hooks/use-projects'
import { useBigTasks } from '@/hooks/use-big-tasks'
import { format, differenceInDays } from 'date-fns'
import { ja } from 'date-fns/locale'
import { EditableTaskTable } from '@/components/project/editable-task-table'
import { GanttChart } from '@/components/project/gantt-chart'
import { cn } from '@/lib/utils'
import { Header } from '@/components/layout/header'

export default function ProjectCreatePage() {
  const router = useRouter()
  const { createProject } = useProjects('current-user')
  const { createBigTask } = useBigTasks('current-user')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hoveredTask, setHoveredTask] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    // State
    projectName,
    goal,
    startDate,
    endDate,
    totalWeeks,
    weekdayWorkDays,
    weekendWorkDays,
    weekdayHoursPerDay,
    weekendHoursPerDay,
    bufferRate,
    weeklyAvailableHours,
    tasks,
    totalTaskHours,
    projectCategories,
    weeklyAllocations,
    isOverCapacity,
    validationErrors,
    categoryColors,

    // Actions
    setProjectName,
    setGoal,
    setStartDate,
    setEndDate,
    setWeekdayWorkDays,
    setWeekendWorkDays,
    setWeekdayHoursPerDay,
    setWeekendHoursPerDay,
    setBufferRate,
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
    getCategoryColor,
  } = useProjectCreationStore()

  // 初期計算
  useEffect(() => {
    calculateTotalWeeks()
    calculateWeeklyHours()

    // 初期状態で空のタスクを1つ追加
    if (tasks.length === 0) {
      addTask()
    }
  }, [])

  useEffect(() => {
    calculateTaskAllocation()
  }, [tasks, weeklyAvailableHours, totalWeeks])

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault()
    }

    // エラーをクリア
    setSubmitError(null)

    console.log('=== プロジェクト作成開始 ===')
    console.log('フォームデータ:', {
      projectName,
      goal,
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      tasksCount: tasks.length,
      validTasksCount: getValidTasks().length,
    })

    if (!validateForm()) {
      console.log('バリデーションエラー:', validationErrors)
      toast.error('入力内容に不備があります')
      return
    }

    setIsSubmitting(true)

    try {
      // プロジェクトデータを作成
      const projectData = {
        user_id: 'current-user',
        name: projectName,
        goal,
        deadline: endDate.toISOString().split('T')[0],
        status: 'active' as const,
        version: 1,
        estimated_total_hours: totalTaskHours,
      }

      console.log('作成するプロジェクトデータ:', projectData)
      const newProject = await createProject(projectData)
      console.log('作成されたプロジェクト:', newProject)

      // BigTasksを作成
      console.log('BigTask作成開始. 週配分数:', weeklyAllocations.length)

      const bigTaskPromises = weeklyAllocations.map(async (allocation, index) => {
        const allocatedTasks = allocation.allocatedTasks
        if (allocatedTasks.length === 0) {
          console.log(`週${allocation.weekNumber}: タスクなしのためスキップ`)
          return null
        }

        // タスク情報を取得
        const validTasks = getValidTasks()
        
        // allocatedTasksから実際のタスク名を取得して結合
        const taskNames = allocatedTasks.map(allocTask => {
          const task = validTasks.find(vt => vt.id === allocTask.taskId)
          return task?.name || ''
        }).filter(Boolean).join('・')
        
        // 各週の最初のタスクのカテゴリを取得（既存ロジック維持）
        const firstTaskId = allocatedTasks[0].taskId
        const firstTask = validTasks.find(t => t.id === firstTaskId)
        const category = firstTask?.category || 'その他'

        // 週の日付範囲を計算
        console.log(`週${allocation.weekNumber}の日付:`, {
          startDate: allocation.startDate,
          endDate: allocation.endDate,
        })

        const weekStart = new Date(allocation.startDate)
        const weekEnd = new Date(allocation.endDate)

        // 日付が有効かチェック
        if (isNaN(weekStart.getTime()) || isNaN(weekEnd.getTime())) {
          console.error(`週${allocation.weekNumber}の日付が無効:`, {
            startDate: allocation.startDate,
            endDate: allocation.endDate,
            weekStart,
            weekEnd,
          })
          throw new Error(`週${allocation.weekNumber}の日付が無効です`)
        }

        const bigTaskData = {
          project_id: newProject.id,
          user_id: 'current-user',
          name: taskNames || `第${allocation.weekNumber}週のタスク`,
          category,
          week_number: allocation.weekNumber,
          week_start_date: weekStart.toISOString(),
          week_end_date: weekEnd.toISOString(),
          estimated_hours: allocation.totalAllocatedHours,
          status: 'pending' as const,
        }

        console.log(`週${allocation.weekNumber}のBigTaskデータ:`, bigTaskData)

        try {
          const result = await createBigTask(bigTaskData)
          console.log(`週${allocation.weekNumber}のBigTask作成成功:`, result)
          return result
        } catch (taskError) {
          console.error(`週${allocation.weekNumber}のBigTask作成エラー:`, taskError)
          throw taskError
        }
      })

      const results = await Promise.all(bigTaskPromises.filter(Boolean))
      console.log('作成されたBigTask数:', results.length)

      toast.success('プロジェクトが正常に作成されました')
      reset()
      router.push('/projects')
    } catch (error) {
      console.error('=== プロジェクト作成エラー ===')
      console.error('エラー詳細:', error)
      if (error instanceof Error) {
        console.error('エラーメッセージ:', error.message)
        console.error('スタックトレース:', error.stack)
        setSubmitError(error.message)
        toast.error(`エラー: ${error.message}`)
      } else {
        setSubmitError('プロジェクトの作成に失敗しました')
        toast.error('プロジェクトの作成に失敗しました')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    reset()
    router.push('/projects')
  }

  const totalAvailableHours = weeklyAvailableHours * totalWeeks

  return (
    <div className="h-full bg-background flex flex-col">
      <Header
        leftContent={
          <div className="flex items-center gap-4">
            <Link href="/projects">
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                戻る
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#1C1C14]">新しいプロジェクト</h1>
                <p className="text-sm text-[#47473B]">目標設定から週別タスク配分まで一括で計画</p>
              </div>
            </div>
          </div>
        }
      />
      <form onSubmit={handleSubmit} className="flex-1 overflow-hidden">
        {/* Content */}
        <div className="overflow-auto h-full">
          <div className="container mx-auto max-w-6xl px-6 py-6">
            {/* エラー表示 */}
            {submitError && (
              <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <p className="text-sm text-destructive">{submitError}</p>
                </div>
              </div>
            )}

            <div className="space-y-6">
              {/* 1. プロジェクト基本情報 */}
              <Card className="form-section">
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
                      tabIndex={1}
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
                      tabIndex={2}
                    />
                    {validationErrors.goal && (
                      <p className="text-sm text-destructive">{validationErrors.goal}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startDate">開始日</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={startDate.toISOString().split('T')[0]}
                        onChange={e => setStartDate(new Date(e.target.value))}
                        className="focus-visible"
                        tabIndex={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endDate">期限 *</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={endDate.toISOString().split('T')[0]}
                        onChange={e => setEndDate(new Date(e.target.value))}
                        className={`focus-visible ${validationErrors.endDate ? 'border-destructive' : ''}`}
                        tabIndex={4}
                      />
                      {validationErrors.endDate && (
                        <p className="text-sm text-destructive">{validationErrors.endDate}</p>
                      )}
                    </div>
                  </div>

                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      期間: {differenceInDays(endDate, startDate)}日間 ({totalWeeks}週間)
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* 2. 投下可能時間の計算 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
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
                        value={weekdayHoursPerDay}
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
                        value={weekendHoursPerDay}
                        onChange={e => setWeekendHoursPerDay(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>バッファ率（%）</Label>
                    <Select
                      value={bufferRate.toString()}
                      onValueChange={value => setBufferRate(parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 11 }, (_, i) => 50 + i * 5).map(rate => (
                          <SelectItem key={rate} value={rate.toString()}>
                            {rate}%
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="p-3 bg-primary/5 rounded-lg">
                    <p className="text-sm font-medium text-primary">
                      週間作業可能時間: {weeklyAvailableHours}時間
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      ({weekdayWorkDays}日 × {weekdayHoursPerDay}h + {weekendWorkDays}日 ×{' '}
                      {weekendHoursPerDay}h) × {bufferRate}%
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* 3. タスク一覧 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
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
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-800">{validationErrors.tasks}</p>
                    </div>
                  )}

                  {/* 合計時間サマリー */}
                  {tasks.length > 0 && (
                    <div
                      className={cn(
                        'mt-6 p-4 rounded-lg',
                        totalTaskHours > totalAvailableHours
                          ? 'bg-red-50 border border-red-200'
                          : 'bg-muted'
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
                          <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-red-800">
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
                <Card>
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
                      categoryColors={categoryColors}
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
                  disabled={isSubmitting || !projectName || !goal || getValidTasks().length === 0}
                  className="flex-1 focus-visible"
                  tabIndex={100}
                >
                  {isSubmitting ? '作成中...' : 'プロジェクトを作成'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  className="focus-visible"
                  tabIndex={101}
                >
                  キャンセル
                </Button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
