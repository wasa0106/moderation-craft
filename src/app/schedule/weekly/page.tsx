/**
 * WeeklySchedulePage - 週間スケジュール詳細ページ
 * 週間のタスク実績と分析を表示
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { useProjects } from '@/hooks/use-projects'
import { useBigTasks } from '@/hooks/use-big-tasks'
import { useSmallTasks } from '@/hooks/use-small-tasks'
import { SmallTask } from '@/types'
import { 
  Calendar, 
  TrendingUp, 
  Target, 
  Clock, 
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Zap
} from 'lucide-react'
import Link from 'next/link'
import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO, getWeek, getYear, addWeeks, subWeeks } from 'date-fns'
import { ja } from 'date-fns/locale'

export default function WeeklySchedulePage() {
  const { projects } = useProjects('current-user')
  const { bigTasks } = useBigTasks()
  const { smallTasks } = useSmallTasks()
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedProject, setSelectedProject] = useState<string>('all')

  // Get current week range
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 })
  const currentWeek = getWeek(selectedDate)
  const currentYear = getYear(selectedDate)

  // Filter tasks based on selected project
  const filteredBigTasks = selectedProject === 'all' 
    ? bigTasks 
    : bigTasks.filter(task => task.project_id === selectedProject)
  
  const filteredSmallTasks = smallTasks.filter(task => 
    filteredBigTasks.some(bigTask => bigTask.id === task.big_task_id)
  )

  // Filter tasks for current week
  const weekTasks = filteredSmallTasks.filter(task => {
    const taskDate = parseISO(task.scheduled_start)
    return isWithinInterval(taskDate, { start: weekStart, end: weekEnd })
  })

  // Group tasks by day
  const groupTasksByDay = (tasks: SmallTask[]) => {
    const grouped: { [key: string]: SmallTask[] } = {}
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart)
      day.setDate(weekStart.getDate() + i)
      const dateKey = format(day, 'yyyy-MM-dd')
      grouped[dateKey] = tasks.filter(task => {
        const taskDate = parseISO(task.scheduled_start)
        return format(taskDate, 'yyyy-MM-dd') === dateKey
      })
    }
    
    return grouped
  }

  const groupedTasks = groupTasksByDay(weekTasks)

  // Calculate detailed statistics
  const stats = {
    total: weekTasks.length,
    completed: weekTasks.filter(task => task.actual_minutes && task.actual_minutes > 0).length,
    pending: weekTasks.filter(task => !task.actual_minutes || task.actual_minutes === 0).length,
    emergency: weekTasks.filter(task => task.is_emergency).length,
    totalEstimated: weekTasks.reduce((sum, task) => sum + task.estimated_minutes, 0),
    totalActual: weekTasks.reduce((sum, task) => sum + (task.actual_minutes || 0), 0),
    overdue: weekTasks.filter(task => {
      const taskEnd = parseISO(task.scheduled_end)
      return taskEnd < new Date() && (!task.actual_minutes || task.actual_minutes === 0)
    }).length
  }

  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
  const timeEfficiency = stats.totalEstimated > 0 ? Math.round((stats.totalActual / stats.totalEstimated) * 100) : 0

  // Calculate variance analysis
  const varianceAnalysis = weekTasks.map(task => {
    if (!task.actual_minutes || task.actual_minutes === 0) return null
    const variance = task.actual_minutes - task.estimated_minutes
    const variancePercent = task.estimated_minutes > 0 ? Math.round((variance / task.estimated_minutes) * 100) : 0
    return {
      task,
      variance,
      variancePercent,
      isOver: variance > 0,
      isUnder: variance < 0
    }
  }).filter(Boolean)

  // Calculate daily performance
  const dailyPerformance = Object.keys(groupedTasks).map(dateKey => {
    const dayTasks = groupedTasks[dateKey]
    const dayStats = {
      date: dateKey,
      total: dayTasks.length,
      completed: dayTasks.filter(task => task.actual_minutes && task.actual_minutes > 0).length,
      estimated: dayTasks.reduce((sum, task) => sum + task.estimated_minutes, 0),
      actual: dayTasks.reduce((sum, task) => sum + (task.actual_minutes || 0), 0)
    }
    return {
      ...dayStats,
      completionRate: dayStats.total > 0 ? Math.round((dayStats.completed / dayStats.total) * 100) : 0,
      timeEfficiency: dayStats.estimated > 0 ? Math.round((dayStats.actual / dayStats.estimated) * 100) : 0
    }
  })

  const getBigTaskName = (bigTaskId: string) => {
    const bigTask = bigTasks.find(task => task.id === bigTaskId)
    return bigTask?.name || '不明なタスク'
  }


  const getVarianceColor = (variance: number) => {
    if (variance > 0) return 'text-red-600'
    if (variance < 0) return 'text-green-600'
    return 'text-gray-600'
  }

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 90) return 'text-green-600'
    if (efficiency >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/schedule">
            <Button variant="ghost" size="sm" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              スケジュール一覧に戻る
            </Button>
          </Link>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <BarChart3 className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">週間分析</h1>
              <p className="text-gray-600">
                {format(weekStart, 'MM月dd日', { locale: ja })} - 
                {format(weekEnd, 'MM月dd日', { locale: ja })} ({currentYear}年 第{currentWeek}週)
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setSelectedDate(subWeeks(selectedDate, 1))}
            >
              前週
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setSelectedDate(addWeeks(selectedDate, 1))}
            >
              次週
            </Button>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 mb-8">
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

      {/* Weekly Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">完了率</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{completionRate}%</div>
            <div className="text-sm text-gray-500">{stats.completed}/{stats.total} タスク</div>
            <Progress value={completionRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">時間効率</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${getEfficiencyColor(timeEfficiency)}`}>
              {timeEfficiency}%
            </div>
            <div className="text-sm text-gray-500">
              {Math.round(stats.totalActual / 60)}h / {Math.round(stats.totalEstimated / 60)}h
            </div>
            <Progress value={timeEfficiency} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">期限超過</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats.overdue}</div>
            <div className="text-sm text-gray-500">未完了タスク</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">緊急タスク</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{stats.emergency}</div>
            <div className="text-sm text-gray-500">要注意</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Daily Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              日別パフォーマンス
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dailyPerformance.map(day => (
                <div key={day.date} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">
                        {format(new Date(day.date), 'MM月dd日 (E)', { locale: ja })}
                      </h4>
                      <Badge variant="outline">{day.total}件</Badge>
                    </div>
                    <div className="text-sm text-gray-500">
                      {day.completionRate}% 完了
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="flex justify-between">
                        <span>完了:</span>
                        <span className="font-medium">{day.completed}/{day.total}</span>
                      </div>
                      <Progress value={day.completionRate} className="mt-1" />
                    </div>
                    <div>
                      <div className="flex justify-between">
                        <span>時間効率:</span>
                        <span className={`font-medium ${getEfficiencyColor(day.timeEfficiency)}`}>
                          {day.timeEfficiency}%
                        </span>
                      </div>
                      <Progress value={day.timeEfficiency} className="mt-1" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Variance Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              時間見積り精度
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {varianceAnalysis.length === 0 ? (
                <p className="text-sm text-gray-500">完了したタスクがありません</p>
              ) : (
                varianceAnalysis.filter(item => item !== null).map(item => (
                  <div key={item!.task.id} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h5 className="font-medium truncate">{item!.task.name}</h5>
                        <p className="text-sm text-gray-500 truncate">
                          {getBigTaskName(item!.task.big_task_id)}
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        <div className={`font-medium ${getVarianceColor(item!.variance)}`}>
                          {item!.variance > 0 ? '+' : ''}{item!.variance}分
                        </div>
                        <div className="text-gray-500">
                          ({item!.variancePercent > 0 ? '+' : ''}{item!.variancePercent}%)
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-500 flex justify-between">
                      <span>予定: {item!.task.estimated_minutes}分</span>
                      <span>実績: {item!.task.actual_minutes}分</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Task List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            タスク詳細
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.keys(groupedTasks).map(dateKey => {
              const dayTasks = groupedTasks[dateKey]
              if (dayTasks.length === 0) return null
              
              return (
                <div key={dateKey} className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    {format(new Date(dateKey), 'MM月dd日 (E)', { locale: ja })}
                    <Badge variant="outline">{dayTasks.length}件</Badge>
                  </h4>
                  
                  <div className="space-y-2">
                    {dayTasks
                      .sort((a, b) => parseISO(a.scheduled_start).getTime() - parseISO(b.scheduled_start).getTime())
                      .map(task => (
                        <div key={task.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium truncate">{task.name}</span>
                              {task.actual_minutes && task.actual_minutes > 0 ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              ) : (
                                <Clock className="h-4 w-4 text-gray-400" />
                              )}
                              {task.is_emergency && (
                                <Zap className="h-4 w-4 text-red-500" />
                              )}
                            </div>
                            <div className="text-sm text-gray-500">
                              {getBigTaskName(task.big_task_id)}
                            </div>
                          </div>
                          
                          <div className="text-right text-sm">
                            <div className="font-medium">
                              {format(parseISO(task.scheduled_start), 'HH:mm', { locale: ja })}
                            </div>
                            <div className="text-gray-500">
                              {task.estimated_minutes}分
                              {task.actual_minutes && task.actual_minutes > 0 && (
                                <span className={getVarianceColor(task.actual_minutes - task.estimated_minutes)}>
                                  {' '}(実績: {task.actual_minutes}分)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}