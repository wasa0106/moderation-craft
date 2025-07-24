/**
 * ReportsPage - レポートページ
 * プロジェクトとタスクの総合的な分析とレポート
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useProjects } from '@/hooks/use-projects'
import { useBigTasks } from '@/hooks/use-big-tasks'
import { useSmallTasks } from '@/hooks/use-small-tasks'
import {
  BarChart3,
  Target,
  Clock,
  Award,
  AlertTriangle,
  CheckCircle2,
  Download,
} from 'lucide-react'
import { parseISO, startOfMonth, endOfMonth, subMonths, isWithinInterval } from 'date-fns'

export default function ReportsPage() {
  const { projects } = useProjects('current-user')
  const [selectedPeriod, setSelectedPeriod] = useState<string>('current-month')
  const [selectedProject, setSelectedProject] = useState<string>('all')
  
  const { bigTasks } = useBigTasks(selectedProject === 'all' ? '' : selectedProject)
  const { smallTasks } = useSmallTasks(selectedProject === 'all' ? '' : selectedProject)

  // Get period date range
  const getPeriodRange = (period: string) => {
    const now = new Date()
    switch (period) {
      case 'current-month':
        return { start: startOfMonth(now), end: endOfMonth(now) }
      case 'last-month':
        const lastMonth = subMonths(now, 1)
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) }
      case 'last-3-months':
        return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) }
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) }
    }
  }

  const periodRange = getPeriodRange(selectedPeriod)

  // Filter data based on selected period and project
  const filteredProjects =
    selectedProject === 'all' ? projects : projects.filter(p => p.id === selectedProject)

  const filteredBigTasks = bigTasks.filter(task => {
    const isProjectMatch = selectedProject === 'all' || task.project_id === selectedProject
    const taskDate = parseISO(task.created_at)
    const isInPeriod = isWithinInterval(taskDate, periodRange)
    return isProjectMatch && isInPeriod
  })

  const filteredSmallTasks = smallTasks.filter(task => {
    const bigTask = bigTasks.find(bt => bt.id === task.big_task_id)
    if (!bigTask) return false

    const isProjectMatch = selectedProject === 'all' || bigTask.project_id === selectedProject
    const taskDate = parseISO(task.scheduled_start)
    const isInPeriod = isWithinInterval(taskDate, periodRange)
    return isProjectMatch && isInPeriod
  })

  // Calculate comprehensive statistics
  const projectStats = {
    total: filteredProjects.length,
    active: filteredProjects.filter(p => p.status === 'active').length,
    completed: filteredProjects.filter(p => p.status === 'completed').length,
    overdue: filteredProjects.filter(
      p => p.deadline && new Date(p.deadline) < new Date() && p.status !== 'completed'
    ).length,
  }

  const bigTaskStats = {
    total: filteredBigTasks.length,
    completed: filteredBigTasks.filter(t => t.status === 'completed').length,
    active: filteredBigTasks.filter(t => t.status === 'active').length,
    pending: filteredBigTasks.filter(t => t.status === 'pending').length,
    totalEstimatedHours: filteredBigTasks.reduce((sum, t) => sum + t.estimated_hours, 0),
    totalActualHours: filteredBigTasks.reduce((sum, t) => sum + (t.actual_hours || 0), 0),
  }

  const smallTaskStats = {
    total: filteredSmallTasks.length,
    completed: filteredSmallTasks.filter(t => t.actual_minutes && t.actual_minutes > 0).length,
    pending: filteredSmallTasks.filter(t => !t.actual_minutes || t.actual_minutes === 0).length,
    emergency: filteredSmallTasks.filter(t => t.is_emergency).length,
    totalEstimatedMinutes: filteredSmallTasks.reduce((sum, t) => sum + t.estimated_minutes, 0),
    totalActualMinutes: filteredSmallTasks.reduce((sum, t) => sum + (t.actual_minutes || 0), 0),
    overdue: filteredSmallTasks.filter(t => {
      const taskEnd = parseISO(t.scheduled_end)
      return taskEnd < new Date() && (!t.actual_minutes || t.actual_minutes === 0)
    }).length,
  }

  // Calculate performance metrics
  const projectCompletionRate =
    projectStats.total > 0 ? Math.round((projectStats.completed / projectStats.total) * 100) : 0

  const bigTaskCompletionRate =
    bigTaskStats.total > 0 ? Math.round((bigTaskStats.completed / bigTaskStats.total) * 100) : 0

  const smallTaskCompletionRate =
    smallTaskStats.total > 0
      ? Math.round((smallTaskStats.completed / smallTaskStats.total) * 100)
      : 0

  const bigTaskTimeEfficiency =
    bigTaskStats.totalEstimatedHours > 0
      ? Math.round((bigTaskStats.totalActualHours / bigTaskStats.totalEstimatedHours) * 100)
      : 0

  const smallTaskTimeEfficiency =
    smallTaskStats.totalEstimatedMinutes > 0
      ? Math.round((smallTaskStats.totalActualMinutes / smallTaskStats.totalEstimatedMinutes) * 100)
      : 0

  // Project performance analysis
  const projectPerformance = filteredProjects
    .map(project => {
      const projectBigTasks = filteredBigTasks.filter(t => t.project_id === project.id)
      const projectSmallTasks = filteredSmallTasks.filter(t =>
        projectBigTasks.some(bt => bt.id === t.big_task_id)
      )

      const bigTaskCompletion =
        projectBigTasks.length > 0
          ? Math.round(
              (projectBigTasks.filter(t => t.status === 'completed').length /
                projectBigTasks.length) *
                100
            )
          : 0

      const smallTaskCompletion =
        projectSmallTasks.length > 0
          ? Math.round(
              (projectSmallTasks.filter(t => t.actual_minutes && t.actual_minutes > 0).length /
                projectSmallTasks.length) *
                100
            )
          : 0

      return {
        project,
        bigTaskCount: projectBigTasks.length,
        smallTaskCount: projectSmallTasks.length,
        bigTaskCompletion,
        smallTaskCompletion,
        overallCompletion: Math.round((bigTaskCompletion + smallTaskCompletion) / 2),
      }
    })
    .sort((a, b) => b.overallCompletion - a.overallCompletion)

  // Time variance analysis
  const timeVarianceAnalysis = filteredSmallTasks
    .filter(task => task.actual_minutes && task.actual_minutes > 0)
    .map(task => {
      const variance = (task.actual_minutes || 0) - task.estimated_minutes
      const variancePercent =
        task.estimated_minutes > 0 ? Math.round((variance / task.estimated_minutes) * 100) : 0
      return {
        task,
        variance,
        variancePercent,
        isAccurate: Math.abs(variancePercent) <= 20,
        isOver: variance > 0,
        isUnder: variance < 0,
      }
    })

  const accurateEstimates = timeVarianceAnalysis.filter(t => t.isAccurate).length
  const estimateAccuracy =
    timeVarianceAnalysis.length > 0
      ? Math.round((accurateEstimates / timeVarianceAnalysis.length) * 100)
      : 0

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 90) return 'text-green-600'
    if (efficiency >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getCompletionColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600'
    if (rate >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <BarChart3 className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">レポート・分析</h1>
              <p className="text-gray-600">プロジェクトとタスクの総合的な分析結果</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              レポート出力
            </Button>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">期間:</label>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current-month">今月</SelectItem>
              <SelectItem value="last-month">先月</SelectItem>
              <SelectItem value="last-3-months">過去3ヶ月</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">プロジェクト:</label>
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべてのプロジェクト</SelectItem>
              {projects.map(project => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Overview Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">プロジェクト完了率</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${getCompletionColor(projectCompletionRate)}`}>
              {projectCompletionRate}%
            </div>
            <div className="text-sm text-gray-500">
              {projectStats.completed}/{projectStats.total} 完了
            </div>
            <Progress value={projectCompletionRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">大タスク完了率</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${getCompletionColor(bigTaskCompletionRate)}`}>
              {bigTaskCompletionRate}%
            </div>
            <div className="text-sm text-gray-500">
              {bigTaskStats.completed}/{bigTaskStats.total} 完了
            </div>
            <Progress value={bigTaskCompletionRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">小タスク完了率</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${getCompletionColor(smallTaskCompletionRate)}`}>
              {smallTaskCompletionRate}%
            </div>
            <div className="text-sm text-gray-500">
              {smallTaskStats.completed}/{smallTaskStats.total} 完了
            </div>
            <Progress value={smallTaskCompletionRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">見積精度</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${getEfficiencyColor(estimateAccuracy)}`}>
              {estimateAccuracy}%
            </div>
            <div className="text-sm text-gray-500">
              {accurateEstimates}/{timeVarianceAnalysis.length} 正確
            </div>
            <Progress value={estimateAccuracy} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">概要</TabsTrigger>
          <TabsTrigger value="projects">プロジェクト</TabsTrigger>
          <TabsTrigger value="tasks">タスク分析</TabsTrigger>
          <TabsTrigger value="time">時間分析</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Key Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  主要指標
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">総プロジェクト数</span>
                    <span className="font-bold">{projectStats.total}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">総大タスク数</span>
                    <span className="font-bold">{bigTaskStats.total}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">総小タスク数</span>
                    <span className="font-bold">{smallTaskStats.total}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">緊急タスク数</span>
                    <span className="font-bold text-red-600">{smallTaskStats.emergency}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">期限超過タスク</span>
                    <span className="font-bold text-orange-600">{smallTaskStats.overdue}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Time Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  時間サマリー
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm">大タスク時間効率</span>
                      <span className={`font-bold ${getEfficiencyColor(bigTaskTimeEfficiency)}`}>
                        {bigTaskTimeEfficiency}%
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      予定: {Math.round(bigTaskStats.totalEstimatedHours)}h / 実績:{' '}
                      {Math.round(bigTaskStats.totalActualHours)}h
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm">小タスク時間効率</span>
                      <span className={`font-bold ${getEfficiencyColor(smallTaskTimeEfficiency)}`}>
                        {smallTaskTimeEfficiency}%
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      予定: {Math.round(smallTaskStats.totalEstimatedMinutes / 60)}h / 実績:{' '}
                      {Math.round(smallTaskStats.totalActualMinutes / 60)}h
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm">総予定時間</span>
                      <span className="font-bold">
                        {Math.round(
                          bigTaskStats.totalEstimatedHours +
                            smallTaskStats.totalEstimatedMinutes / 60
                        )}
                        h
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">大タスク + 小タスク</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Projects Tab */}
        <TabsContent value="projects" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                プロジェクト別パフォーマンス
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {projectPerformance.map(item => (
                  <div key={item.project.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{item.project.name}</h4>
                        <Badge
                          variant={item.project.status === 'completed' ? 'default' : 'secondary'}
                        >
                          {item.project.status === 'completed'
                            ? '完了'
                            : item.project.status === 'active'
                              ? 'アクティブ'
                              : item.project.status}
                        </Badge>
                      </div>
                      <div
                        className={`text-lg font-bold ${getCompletionColor(item.overallCompletion)}`}
                      >
                        {item.overallCompletion}%
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span>大タスク:</span>
                          <span>{item.bigTaskCompletion}%</span>
                        </div>
                        <Progress value={item.bigTaskCompletion} className="mb-1" />
                        <div className="text-xs text-gray-500">{item.bigTaskCount}件</div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span>小タスク:</span>
                          <span>{item.smallTaskCompletion}%</span>
                        </div>
                        <Progress value={item.smallTaskCompletion} className="mb-1" />
                        <div className="text-xs text-gray-500">{item.smallTaskCount}件</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Task Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  タスク分布
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">大タスク</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>完了:</span>
                        <span className="font-medium text-green-600">{bigTaskStats.completed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>実行中:</span>
                        <span className="font-medium text-blue-600">{bigTaskStats.active}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>待機中:</span>
                        <span className="font-medium text-gray-600">{bigTaskStats.pending}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">小タスク</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>完了:</span>
                        <span className="font-medium text-green-600">
                          {smallTaskStats.completed}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>未完了:</span>
                        <span className="font-medium text-gray-600">{smallTaskStats.pending}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>緊急:</span>
                        <span className="font-medium text-red-600">{smallTaskStats.emergency}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>期限超過:</span>
                        <span className="font-medium text-orange-600">
                          {smallTaskStats.overdue}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Issues and Alerts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  課題と警告
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {smallTaskStats.overdue > 0 && (
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                        <span className="font-medium text-orange-800">期限超過</span>
                      </div>
                      <p className="text-sm text-orange-700">
                        {smallTaskStats.overdue}件のタスクが期限を超過しています
                      </p>
                    </div>
                  )}

                  {smallTaskStats.emergency > 0 && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <span className="font-medium text-red-800">緊急タスク</span>
                      </div>
                      <p className="text-sm text-red-700">
                        {smallTaskStats.emergency}件の緊急タスクがあります
                      </p>
                    </div>
                  )}

                  {projectStats.overdue > 0 && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <span className="font-medium text-yellow-800">期限超過プロジェクト</span>
                      </div>
                      <p className="text-sm text-yellow-700">
                        {projectStats.overdue}件のプロジェクトが期限を超過しています
                      </p>
                    </div>
                  )}

                  {smallTaskStats.overdue === 0 &&
                    smallTaskStats.emergency === 0 &&
                    projectStats.overdue === 0 && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="font-medium text-green-800">問題なし</span>
                        </div>
                        <p className="text-sm text-green-700">現在、緊急の課題はありません</p>
                      </div>
                    )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Time Tab */}
        <TabsContent value="time" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                時間見積り精度分析
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {timeVarianceAnalysis.filter(t => t.isUnder).length}
                    </div>
                    <div className="text-sm text-green-700">予定より短縮</div>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{accurateEstimates}</div>
                    <div className="text-sm text-blue-700">正確な見積り</div>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      {timeVarianceAnalysis.filter(t => t.isOver).length}
                    </div>
                    <div className="text-sm text-red-700">予定より超過</div>
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-lg font-medium mb-2">見積り精度: {estimateAccuracy}%</div>
                  <Progress value={estimateAccuracy} className="max-w-md mx-auto" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
