/**
 * ProjectDetailPage - プロジェクト詳細ページ
 * 特定のプロジェクトの詳細情報と管理機能を提供
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ProjectForm } from '@/components/project/project-form'
import { GanttChart } from '@/components/project/gantt-chart'
import { FlowBigTaskTable } from '@/components/task/flow-big-task-table'
import { RecurringBigTaskTable } from '@/components/task/recurring-big-task-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useProjects } from '@/hooks/use-projects'
import { useBigTasks } from '@/hooks/use-big-tasks'
import { useSmallTasks } from '@/hooks/use-small-tasks'
import { Project, UpdateProjectData, CreateBigTaskData, UpdateBigTaskData, BigTask } from '@/types'
import {
  ArrowLeft,
  Trash2,
  Target,
  Calendar,
  Plus,
  CheckCircle2,
  AlertCircle,
  Settings,
  BarChart3,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { format, eachDayOfInterval, getDay, differenceInDays } from 'date-fns'
import { ja } from 'date-fns/locale'
import { getHolidaysOfYear } from 'holiday-jp-since'

interface ProjectDetailPageProps {
  params: Promise<{
    id: string
  }>
}

export default function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const router = useRouter()
  const { projects, updateProject, deleteProject, completeProject } = useProjects('current-user')
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null)
  const { 
    bigTasks, 
    createBigTask,
    updateBigTask,
    deleteBigTask,
    updateTaskStatus,
    isLoading: bigTasksLoading 
  } = useBigTasks('current-user', resolvedParams?.id)
  const { smallTasks } = useSmallTasks('current-user', resolvedParams?.id)

  // Resolve params promise
  useEffect(() => {
    params.then(setResolvedParams)
  }, [params])

  const [isDeleting, setIsDeleting] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [isSubmittingTask, setIsSubmittingTask] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  const project = projects.find(p => p.id === resolvedParams?.id)

  if (!resolvedParams) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">プロジェクトが見つかりません</h2>
          <p className="text-muted-foreground mb-6">
            指定されたプロジェクトは存在しないか、削除されています。
          </p>
          <Button asChild>
            <Link href="/projects">プロジェクト一覧に戻る</Link>
          </Button>
        </div>
      </div>
    )
  }

  const handleUpdateProject = async (data: UpdateProjectData) => {
    if (!resolvedParams) return
    setIsUpdating(true)

    try {
      updateProject({ id: resolvedParams.id, data })
      toast.success('プロジェクトが正常に更新されました')
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to update project:', error)
      toast.error('プロジェクトの更新に失敗しました')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeleteProject = async () => {
    if (!resolvedParams) return
    if (!confirm('このプロジェクトを削除しますか？この操作は取り消せません。')) {
      return
    }

    setIsDeleting(true)

    try {
      deleteProject(resolvedParams.id)
      toast.success('プロジェクトが正常に削除されました')
      router.push('/projects')
    } catch (error) {
      console.error('Failed to delete project:', error)
      toast.error('プロジェクトの削除に失敗しました')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleUpdateBigTask = async (id: string, data: Partial<BigTask>) => {
    await updateBigTask({ id, data })
  }

  const handleBigTaskStatusUpdate = async (taskId: string, status: 'completed' | 'active') => {
    try {
      await updateTaskStatus({ id: taskId, status })
      toast.success(`タスクを${status === 'completed' ? '完了' : '実行中'}にしました`)
    } catch (error) {
      console.error('Failed to update task status:', error)
      toast.error('タスクステータスの更新に失敗しました')
    }
  }

  const handleCompleteProject = async () => {
    if (!resolvedParams) return
    
    // 確認ダイアログを表示
    if (!confirm(
      'プロジェクトを完了にしますか？\n\n' +
      'この操作により、すべての未完了タスクも自動的に完了になります。\n' +
      'この操作は取り消すことができます。'
    )) {
      return
    }

    setIsCompleting(true)

    try {
      const result = await completeProject(resolvedParams.id)
      toast.success(
        `プロジェクト「${project.name}」を完了しました。\n` +
        `${result.completedTasks}個のタスクが完了になりました。`
      )
    } catch (error) {
      console.error('Failed to complete project:', error)
      if (error instanceof Error && error.message.includes('already completed')) {
        toast.error('プロジェクトはすでに完了しています')
      } else {
        toast.error('プロジェクトの完了に失敗しました')
      }
    } finally {
      setIsCompleting(false)
    }
  }

  const handleReactivateProject = async () => {
    if (!resolvedParams) return
    
    setIsUpdating(true)
    try {
      await updateProject({ id: resolvedParams.id, data: { status: 'active' } })
      toast.success('プロジェクトを再開しました')
    } catch (error) {
      console.error('Failed to reactivate project:', error)
      toast.error('プロジェクトの再開に失敗しました')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleBigTaskHoursUpdate = async (taskId: string, estimatedHours: number) => {
    try {
      await updateBigTask({ id: taskId, data: { estimated_hours: estimatedHours } })
      toast.success('タスクの予定工数を更新しました')
    } catch (error) {
      console.error('Failed to update task hours:', error)
      toast.error('タスクの予定工数の更新に失敗しました')
    }
  }

  const handleBigTaskDateUpdate = async (taskId: string, startDate: Date, endDate: Date) => {
    try {
      await updateBigTask({ 
        id: taskId, 
        data: { 
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd')
        } 
      })
      // トースト通知はしない（連鎖更新が多いため）
    } catch (error) {
      console.error('Failed to update task dates:', error)
      toast.error('タスクの日付更新に失敗しました')
    }
  }

  // Handle Big Task operations
  const handleCreateBigTask = async (data: CreateBigTaskData) => {
    setIsSubmittingTask(true)

    try {
      await createBigTask(data)
      toast.success('タスクが正常に作成されました')
    } catch (error) {
      console.error('Failed to create big task:', error)
      toast.error('タスクの作成に失敗しました')
    } finally {
      setIsSubmittingTask(false)
    }
  }

  const handleDeleteBigTask = async (taskId: string) => {
    if (!confirm('このタスクを削除しますか？関連する小タスクも削除されます。')) {
      return
    }

    try {
      await deleteBigTask(taskId)
      toast.success('タスクが正常に削除されました')
    } catch (error) {
      console.error('Failed to delete big task:', error)
      toast.error('タスクの削除に失敗しました')
    }
  }


  const getStatusColor = (status: Project['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'completed':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const getStatusText = (status: Project['status']) => {
    switch (status) {
      case 'active':
        return 'アクティブ'
      case 'completed':
        return '完了'
      default:
        return status
    }
  }

  // Calculate project statistics
  const projectBigTasks = bigTasks // すでにprojectIdでフィルタリングされている
  const projectSmallTasks = smallTasks.filter(task =>
    projectBigTasks.some(bigTask => bigTask.id === task.big_task_id)
  )

  const stats = {
    bigTasks: {
      total: projectBigTasks.length,
      completed: projectBigTasks.filter(t => t.status === 'completed').length,
      active: projectBigTasks.filter(t => t.status === 'active').length,
      cancelled: projectBigTasks.filter(t => t.status === 'cancelled').length,
    },
    smallTasks: {
      total: projectSmallTasks.length,
      completed: projectSmallTasks.filter(t => t.actual_minutes && t.actual_minutes > 0).length,
      pending: projectSmallTasks.filter(t => !t.actual_minutes || t.actual_minutes === 0).length,
    },
  }

  const completionPercentage =
    stats.bigTasks.total > 0
      ? Math.round((stats.bigTasks.completed / stats.bigTasks.total) * 100)
      : 0

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <Button asChild variant="ghost" size="sm" className="flex items-center gap-2">
            <Link href="/projects">
              <ArrowLeft className="h-4 w-4" />
              プロジェクト一覧に戻る
            </Link>
          </Button>
        </div>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Target className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-foreground">{project.name}</h1>
                <Badge className={getStatusColor(project.status)}>
                  {getStatusText(project.status)}
                </Badge>
              </div>
              <p className="text-muted-foreground">{project.goal}</p>
              {project.deadline && (
                <p className="text-sm text-muted-foreground mt-1">
                  期限: {format(new Date(project.deadline), 'yyyy年MM月dd日', { locale: ja })}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {project.status === 'completed' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReactivateProject}
                disabled={isUpdating}
                className="text-orange-600 hover:text-orange-700"
              >
                <XCircle className="h-4 w-4 mr-2" />
                完了を取り消す
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCompleteProject}
                disabled={isCompleting}
                className="text-green-600 hover:text-green-700"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                プロジェクトを完了
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteProject}
              disabled={isDeleting}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              削除
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="tasks" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="tasks">タスク管理</TabsTrigger>
          <TabsTrigger value="settings">設定</TabsTrigger>
        </TabsList>


        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-6">
          {/* Task List */}
          <Card className="border border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  タスク一覧
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {/* 定期タスク */}
              <RecurringBigTaskTable
                tasks={projectBigTasks}
                projectId={resolvedParams.id}
                totalWeeks={Math.ceil(differenceInDays(new Date(project.deadline), new Date()) / 7)}
                onUpdate={handleUpdateBigTask}
                onCreate={handleCreateBigTask}
                onDelete={handleDeleteBigTask}
                onStatusChange={handleBigTaskStatusUpdate}
                isLoading={bigTasksLoading}
              />

              {/* 区切り線 */}
              <div className="border-t my-4" />

              {/* フロータスク */}
              <FlowBigTaskTable
                tasks={projectBigTasks}
                projectId={resolvedParams.id}
                onUpdate={handleUpdateBigTask}
                onCreate={handleCreateBigTask}
                onDelete={handleDeleteBigTask}
                onStatusChange={handleBigTaskStatusUpdate}
                isLoading={bigTasksLoading}
              />

              {/* 合計時間サマリー */}
              {projectBigTasks.length > 0 && (
                <div className="mt-6 p-4 rounded-lg bg-muted/30">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">合計タスク時間</span>
                    <span className="text-lg font-bold">
                      {projectBigTasks.reduce((sum, task) => sum + (task.estimated_hours || 0), 0).toFixed(1)}時間
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm text-muted-foreground">フロータスク</span>
                    <span className="text-sm text-muted-foreground">
                      {projectBigTasks
                        .filter(t => t.task_type !== 'recurring')
                        .reduce((sum, t) => sum + (t.estimated_hours || 0), 0)
                        .toFixed(1)}時間
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-sm text-muted-foreground">定期タスク</span>
                    <span className="text-sm text-muted-foreground">
                      {projectBigTasks
                        .filter(t => t.task_type === 'recurring')
                        .reduce((sum, t) => sum + (t.estimated_hours || 0), 0)
                        .toFixed(1)}時間
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gantt Chart */}
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                ガントチャート
              </CardTitle>
            </CardHeader>
            <CardContent>
              {projectBigTasks.length === 0 ? (
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">タスクがないため、ガントチャートを表示できません</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    大タスクを作成してガントチャートを表示しましょう
                  </p>
                  <Button onClick={() => {
                    const element = document.querySelector('tbody tr:last-child input');
                    if (element instanceof HTMLElement) element.focus();
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    タスクを作成
                  </Button>
                </div>
              ) : (
                <GanttChart
                  bigTasks={projectBigTasks}
                  startDate={
                    projectBigTasks.length > 0
                      ? new Date(
                          Math.min(
                            ...projectBigTasks
                              .filter(t => t.start_date)
                              .map(t => new Date(t.start_date).getTime())
                          )
                        )
                      : new Date()
                  }
                  endDate={new Date(project.deadline)}
                  totalTaskHours={projectBigTasks.reduce(
                    (sum, task) => sum + (task.estimated_hours || 0),
                    0
                  )}
                  totalAvailableHours={
                    (() => {
                      // プロジェクトの開始日から終了日までの日数を計算
                      const startDate =
                        projectBigTasks.length > 0
                          ? new Date(
                              Math.min(
                                ...projectBigTasks
                                  .filter(t => t.start_date)
                                  .map(t => new Date(t.start_date).getTime())
                              )
                            )
                          : new Date()
                      const endDate = new Date(project.deadline)
                      
                      // 実際の作業可能時間を正確に計算
                      const days = eachDayOfInterval({ start: startDate, end: endDate })
                      let totalHours = 0
                      
                      // 各日の作業可能時間を計算
                      days.forEach(day => {
                        // 祝日判定
                        if (project.exclude_holidays) {
                          const holidays = getHolidaysOfYear(day.getFullYear())
                          const dateStr = format(day, 'yyyy-MM-dd')
                          const isHoliday = holidays.some(h => {
                            const holidayDate = new Date(day.getFullYear(), h.month - 1, h.day)
                            return format(holidayDate, 'yyyy-MM-dd') === dateStr
                          })
                          
                          if (isHoliday) {
                            totalHours += project.holiday_work_hours || 0
                            return
                          }
                        }
                        
                        // 曜日判定（0=日, 1=月...6=土）
                        const dayOfWeek = getDay(day)
                        
                        // workableWeekdaysの配列インデックスに変換
                        // [月,火,水,木,金,土,日] なので
                        const weekdayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1
                        
                        // 作業可能な曜日かチェック
                        if (project.workable_weekdays && !project.workable_weekdays[weekdayIndex]) {
                          return
                        }
                        
                        // weekday_hoursがある場合はそれを使用
                        if (project.weekday_hours && project.weekday_hours.length === 7) {
                          totalHours += project.weekday_hours[weekdayIndex] || 0
                        } else {
                          // 後方互換性: 古いデータの場合はデフォルト値を使用
                          totalHours += 8
                        }
                      })
                      
                      return totalHours
                    })()
                  }
                  workableWeekdays={project.workable_weekdays}
                  weekdayHours={project.weekday_hours}
                  excludeHolidays={project.exclude_holidays}
                  holidayWorkHours={project.holiday_work_hours}
                  allowStatusChange={true}
                  onBigTaskStatusUpdate={handleBigTaskStatusUpdate}
                  onBigTaskHoursUpdate={handleBigTaskHoursUpdate}
                  onBigTaskDateUpdate={handleBigTaskDateUpdate}
                  reflowScope="category"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>プロジェクト設定の編集</CardTitle>
            </CardHeader>
            <CardContent>
              <ProjectForm
                project={project}
                onSubmit={handleUpdateProject}
                onCancel={() => {}}
                isLoading={isUpdating}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
