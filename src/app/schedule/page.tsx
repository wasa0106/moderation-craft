/**
 * SchedulePage - スケジュール管理ページ
 * 小タスクのスケジュール表示と週間管理
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
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
  Calendar as CalendarIcon, 
  Zap,
  TrendingUp
} from 'lucide-react'
import Link from 'next/link'
import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO, getWeek } from 'date-fns'
import { ja } from 'date-fns/locale'

export default function SchedulePage() {
  const { projects } = useProjects('current-user')
  const { bigTasks } = useBigTasks()
  const { smallTasks } = useSmallTasks()
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'day' | 'week'>('week')

  // Filter tasks based on selected project
  const filteredBigTasks = selectedProject === 'all' 
    ? bigTasks 
    : bigTasks.filter(task => task.project_id === selectedProject)
  
  const filteredSmallTasks = smallTasks.filter(task => 
    filteredBigTasks.some(bigTask => bigTask.id === task.big_task_id)
  )

  // Get current week range
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 })

  // Filter tasks for current week
  const weekTasks = filteredSmallTasks.filter(task => {
    const taskDate = parseISO(task.scheduled_start)
    return isWithinInterval(taskDate, { start: weekStart, end: weekEnd })
  })

  // Filter tasks for selected day
  const dayTasks = filteredSmallTasks.filter(task => {
    const taskDate = parseISO(task.scheduled_start)
    return format(taskDate, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
  })

  // Get current week number
  const currentWeek = getWeek(selectedDate)

  // Group tasks by day for week view
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

  // Calculate statistics
  const stats = {
    total: weekTasks.length,
    completed: weekTasks.filter(task => task.actual_minutes && task.actual_minutes > 0).length,
    pending: weekTasks.filter(task => !task.actual_minutes || task.actual_minutes === 0).length,
    emergency: weekTasks.filter(task => task.is_emergency).length,
    totalMinutes: weekTasks.reduce((sum, task) => sum + task.estimated_minutes, 0),
    completedMinutes: weekTasks.reduce((sum, task) => sum + (task.actual_minutes || 0), 0)
  }

  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0

  // Get task status color
  const getTaskStatusColor = (task: SmallTask) => {
    if (task.actual_minutes && task.actual_minutes > 0) return 'bg-green-100 text-green-800'
    if (task.is_emergency) return 'bg-red-100 text-red-800'
    const now = new Date()
    const taskTime = parseISO(task.scheduled_start)
    if (taskTime < now) return 'bg-yellow-100 text-yellow-800'
    return 'bg-blue-100 text-blue-800'
  }

  const getTaskStatusText = (task: SmallTask) => {
    if (task.actual_minutes && task.actual_minutes > 0) return '完了'
    if (task.is_emergency) return '緊急'
    const now = new Date()
    const taskTime = parseISO(task.scheduled_start)
    if (taskTime < now) return '期限超過'
    return '予定'
  }

  const getBigTaskName = (bigTaskId: string) => {
    const bigTask = bigTasks.find(task => task.id === bigTaskId)
    return bigTask?.name || '不明なタスク'
  }


  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-50 rounded-lg">
              <CalendarIcon className="h-8 w-8 text-purple-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">スケジュール管理</h1>
              <p className="text-gray-600">
                {format(selectedDate, 'yyyy年MM月dd日 (E)', { locale: ja })} - 
                第{currentWeek}週
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Link href="/schedule/weekly">
              <Button variant="outline">
                <TrendingUp className="h-4 w-4 mr-2" />
                週間詳細
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
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

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">表示:</label>
          <Select value={viewMode} onValueChange={(value) => setViewMode(value as 'day' | 'week')}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">日表示</SelectItem>
              <SelectItem value="week">週表示</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">完了率</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{completionRate}%</div>
            <div className="text-sm text-gray-500">{stats.completed}/{stats.total} タスク</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">予定時間</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{Math.round(stats.totalMinutes / 60)}h</div>
            <div className="text-sm text-gray-500">{stats.totalMinutes}分</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">実績時間</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{Math.round(stats.completedMinutes / 60)}h</div>
            <div className="text-sm text-gray-500">{stats.completedMinutes}分</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">緊急タスク</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.emergency}</div>
            <div className="text-sm text-gray-500">要優先対応</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">カレンダー</CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border"
              locale={ja}
            />
          </CardContent>
        </Card>

        {/* Schedule View */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              {viewMode === 'week' ? '週間スケジュール' : '日間スケジュール'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {viewMode === 'week' ? (
              <div className="space-y-4">
                {Array.from({ length: 7 }, (_, i) => {
                  const day = new Date(weekStart)
                  day.setDate(weekStart.getDate() + i)
                  const dateKey = format(day, 'yyyy-MM-dd')
                  const dayTasks = groupedTasks[dateKey] || []
                  
                  return (
                    <div key={dateKey} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">
                            {format(day, 'MM月dd日 (E)', { locale: ja })}
                          </h3>
                          <Badge variant="outline">
                            {dayTasks.length}件
                          </Badge>
                        </div>
                        {format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') && (
                          <Badge>今日</Badge>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        {dayTasks.length === 0 ? (
                          <p className="text-sm text-gray-500">タスクがありません</p>
                        ) : (
                          dayTasks.map(task => (
                            <div key={task.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium truncate">{task.name}</span>
                                  <Badge className={getTaskStatusColor(task)}>
                                    {getTaskStatusText(task)}
                                  </Badge>
                                  {task.is_emergency && (
                                    <Zap className="h-3 w-3 text-red-500" />
                                  )}
                                </div>
                                <div className="text-xs text-gray-500 truncate">
                                  {getBigTaskName(task.big_task_id)} • {task.estimated_minutes}分
                                </div>
                              </div>
                              <div className="text-xs text-gray-500">
                                {format(parseISO(task.scheduled_start), 'HH:mm', { locale: ja })}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    {format(selectedDate, 'yyyy年MM月dd日 (E)', { locale: ja })}
                  </h3>
                  <Badge variant="outline">
                    {dayTasks.length}件のタスク
                  </Badge>
                </div>
                
                {dayTasks.length === 0 ? (
                  <div className="text-center py-8">
                    <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">この日にはタスクがありません</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dayTasks
                      .sort((a, b) => parseISO(a.scheduled_start).getTime() - parseISO(b.scheduled_start).getTime())
                      .map(task => (
                        <div key={task.id} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium truncate">{task.name}</h4>
                                <Badge className={getTaskStatusColor(task)}>
                                  {getTaskStatusText(task)}
                                </Badge>
                                {task.is_emergency && (
                                  <Zap className="h-4 w-4 text-red-500" />
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mb-1">
                                {getBigTaskName(task.big_task_id)}
                              </p>
                              {task.description && (
                                <p className="text-sm text-gray-500 truncate">
                                  {task.description}
                                </p>
                              )}
                            </div>
                            <div className="text-sm text-gray-500 text-right">
                              <div>{format(parseISO(task.scheduled_start), 'HH:mm', { locale: ja })}</div>
                              <div>{task.estimated_minutes}分</div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}