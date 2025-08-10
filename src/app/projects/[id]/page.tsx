/**
 * ProjectDetailPage - プロジェクト詳細ページ
 * 特定のプロジェクトの詳細情報と管理機能を提供
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ProjectForm } from '@/components/project/project-form'
import { GanttChart } from '@/components/project/gantt-chart'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useProjects } from '@/hooks/use-projects'
import { useBigTasks } from '@/hooks/use-big-tasks'
import { useSmallTasks } from '@/hooks/use-small-tasks'
import { Project, UpdateProjectData } from '@/types'
import {
  ArrowLeft,
  Edit,
  Trash2,
  Target,
  Calendar,
  Plus,
  CheckCircle2,
  AlertCircle,
  Settings,
  BarChart3,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { format, eachDayOfInterval, getDay } from 'date-fns'
import { ja } from 'date-fns/locale'
import { getHolidaysOfYear } from 'holiday-jp-since'

interface ProjectDetailPageProps {
  params: Promise<{
    id: string
  }>
}

export default function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const router = useRouter()
  const { projects, updateProject, deleteProject } = useProjects('current-user')
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null)
  const { bigTasks, updateTaskStatus } = useBigTasks('current-user', resolvedParams?.id)
  const { smallTasks } = useSmallTasks('current-user', resolvedParams?.id)

  // Resolve params promise
  useEffect(() => {
    params.then(setResolvedParams)
  }, [params])

  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

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

  const handleBigTaskStatusUpdate = async (taskId: string, status: 'completed' | 'pending') => {
    try {
      await updateTaskStatus({ id: taskId, status })
      toast.success(`タスクを${status === 'completed' ? '完了' : '未完了'}にしました`)
    } catch (error) {
      console.error('Failed to update task status:', error)
      toast.error('タスクステータスの更新に失敗しました')
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
      pending: projectBigTasks.filter(t => t.status === 'pending').length,
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              disabled={isEditing}
            >
              <Edit className="h-4 w-4 mr-2" />
              編集
            </Button>
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
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">概要</TabsTrigger>
          <TabsTrigger value="tasks">タスク管理</TabsTrigger>
          <TabsTrigger value="gantt">ガントチャート</TabsTrigger>
          <TabsTrigger value="settings">設定</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Progress Overview */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">進捗率</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{completionPercentage}%</div>
                <div className="w-full bg-muted rounded-full h-2 mt-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${completionPercentage}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  大タスク
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">
                  {stats.bigTasks.completed}/{stats.bigTasks.total}
                </div>
                <div className="text-sm text-muted-foreground">完了 / 総数</div>
              </CardContent>
            </Card>

            <Card className="border border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  小タスク
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">
                  {stats.smallTasks.completed}/{stats.smallTasks.total}
                </div>
                <div className="text-sm text-muted-foreground">完了 / 総数</div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-card-foreground">
                <Settings className="h-5 w-5" />
                クイックアクション
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 gap-4">
                <Button asChild className="w-full flex items-center gap-2 h-12">
                  <Link href={`/projects/${resolvedParams.id}/tasks`}>
                    <Plus className="h-5 w-5" />
                    タスクを管理
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full flex items-center gap-2 h-12">
                  <Link href="/schedule">
                    <Calendar className="h-5 w-5" />
                    スケジュール表示
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  タスク一覧
                </CardTitle>
                <Button asChild size="sm">
                  <Link href={`/projects/${resolvedParams.id}/tasks`}>
                    <Plus className="h-4 w-4 mr-2" />
                    詳細管理
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {stats.bigTasks.total === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">まだタスクがありません</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    大タスクを作成してプロジェクトを開始しましょう
                  </p>
                  <Button asChild>
                    <Link href={`/projects/${resolvedParams.id}/tasks`}>
                      <Plus className="h-4 w-4 mr-2" />
                      タスクを作成
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h3 className="font-medium text-blue-900 mb-2">大タスク</h3>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>完了済み</span>
                          <span className="font-medium">{stats.bigTasks.completed}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>実行中</span>
                          <span className="font-medium">{stats.bigTasks.active}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>待機中</span>
                          <span className="font-medium">{stats.bigTasks.pending}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-green-50 rounded-lg">
                      <h3 className="font-medium text-green-900 mb-2">小タスク</h3>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>完了済み</span>
                          <span className="font-medium">{stats.smallTasks.completed}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>未完了</span>
                          <span className="font-medium">{stats.smallTasks.pending}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>総数</span>
                          <span className="font-medium">{stats.smallTasks.total}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 大タスク一覧表 */}
                  <div className="mt-6">
                    <h3 className="font-medium mb-2">大タスク一覧</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-collapse border border-border">
                        <thead>
                          <tr className="bg-muted">
                            <th className="border border-border px-4 py-2 text-left">カテゴリ</th>
                            <th className="border border-border px-4 py-2 text-left">タスク名</th>
                            <th className="border border-border px-4 py-2 text-right">見積時間</th>
                          </tr>
                        </thead>
                        <tbody>
                          {projectBigTasks.map(task => (
                            <tr key={task.id} className="hover:bg-muted">
                              <td className="border border-border px-4 py-2">
                                {task.category || '-'}
                              </td>
                              <td className="border border-border px-4 py-2">{task.name}</td>
                              <td className="border border-border px-4 py-2 text-right">
                                {task.estimated_hours}h
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Gantt Chart Tab */}
        <TabsContent value="gantt" className="space-y-6">
          <div className="border border-border rounded-lg bg-surface-1">
            <div className="p-6 pb-0">
              <h3 className="flex items-center gap-2 font-semibold">
                <BarChart3 className="h-5 w-5" />
                ガントチャート
              </h3>
            </div>
            {projectBigTasks.length === 0 ? (
              <div className="text-center p-8">
                <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">タスクがないため、ガントチャートを表示できません</p>
                <p className="text-sm text-muted-foreground mb-4">
                  大タスクを作成してガントチャートを表示しましょう
                </p>
                <Button asChild>
                  <Link href={`/projects/${resolvedParams.id}/tasks`}>
                    <Plus className="h-4 w-4 mr-2" />
                    タスクを作成
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="mt-6">
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
                          
                          // 週末（土日）の場合
                          if (dayOfWeek === 0 || dayOfWeek === 6) {
                            totalHours += project.weekend_hours_per_day || 0
                          } else {
                            // 平日の場合
                            totalHours += project.weekday_hours_per_day || 8
                          }
                        })
                        
                        return totalHours
                      })()
                    }
                    weekdayWorkDays={project.weekday_work_days}
                    weekendWorkDays={project.weekend_work_days}
                    weekdayHoursPerDay={project.weekday_hours_per_day}
                    weekendHoursPerDay={project.weekend_hours_per_day}
                    workableWeekdays={project.workable_weekdays}
                    excludeHolidays={project.exclude_holidays}
                    holidayWorkHours={project.holiday_work_hours}
                    allowStatusChange={true}
                    onBigTaskStatusUpdate={handleBigTaskStatusUpdate}
                  />
              </div>
            )}
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          {isEditing ? (
            <Card>
              <CardHeader>
                <CardTitle>プロジェクト設定の編集</CardTitle>
              </CardHeader>
              <CardContent>
                <ProjectForm
                  project={project}
                  onSubmit={handleUpdateProject}
                  onCancel={() => setIsEditing(false)}
                  isLoading={isUpdating}
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  プロジェクト設定
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      プロジェクト名
                    </label>
                    <p className="text-foreground">{project.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">ゴール</label>
                    <p className="text-foreground">{project.goal}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">ステータス</label>
                    <div className="mt-1">
                      <Badge className={getStatusColor(project.status)}>
                        {getStatusText(project.status)}
                      </Badge>
                    </div>
                  </div>
                  {project.deadline && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">期限</label>
                      <p className="text-foreground">
                        {format(new Date(project.deadline), 'yyyy年MM月dd日', { locale: ja })}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
