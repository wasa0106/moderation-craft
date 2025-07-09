/**
 * HomePage - メインダッシュボード
 * プロジェクトとタスクの全体的な概要を表示
 */

'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useProjects } from '@/hooks/use-projects'
import { useBigTasks } from '@/hooks/use-big-tasks'
import { useSmallTasks } from '@/hooks/use-small-tasks'
import { SmallTask } from '@/types'
import { 
  Target, 
  Calendar, 
  Clock, 
  Plus, 
  TrendingUp,
  AlertTriangle,
  BarChart3,
  Zap,
  ArrowRight
} from 'lucide-react'
import Link from 'next/link'
import { format, parseISO, isToday, isTomorrow } from 'date-fns'
import { ja } from 'date-fns/locale'

export default function Home() {
  const { projects } = useProjects('current-user')
  const { bigTasks } = useBigTasks()
  const { smallTasks } = useSmallTasks()

  // Calculate overview statistics
  const projectStats = {
    total: projects.length,
    active: projects.filter(p => p.status === 'active').length,
    completed: projects.filter(p => p.status === 'completed').length,
    overdue: projects.filter(p => 
      p.deadline && new Date(p.deadline) < new Date() && p.status !== 'completed'
    ).length
  }

  const taskStats = {
    bigTasks: {
      total: bigTasks.length,
      completed: bigTasks.filter(t => t.status === 'completed').length,
      active: bigTasks.filter(t => t.status === 'active').length
    },
    smallTasks: {
      total: smallTasks.length,
      completed: smallTasks.filter(t => t.actual_minutes && t.actual_minutes > 0).length,
      pending: smallTasks.filter(t => !t.actual_minutes || t.actual_minutes === 0).length,
      emergency: smallTasks.filter(t => t.is_emergency).length
    }
  }

  // Get today's tasks
  const today = new Date()
  const todayTasks = smallTasks.filter(task => {
    const taskDate = parseISO(task.scheduled_start)
    return isToday(taskDate)
  }).sort((a, b) => parseISO(a.scheduled_start).getTime() - parseISO(b.scheduled_start).getTime())

  // Get tomorrow's tasks
  const tomorrowTasks = smallTasks.filter(task => {
    const taskDate = parseISO(task.scheduled_start)
    return isTomorrow(taskDate)
  }).sort((a, b) => parseISO(a.scheduled_start).getTime() - parseISO(b.scheduled_start).getTime())

  // Get recent active projects
  const activeProjects = projects
    .filter(p => p.status === 'active')
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 3)

  // Calculate completion rates
  const projectCompletionRate = projectStats.total > 0 ? 
    Math.round((projectStats.completed / projectStats.total) * 100) : 0
  
  const bigTaskCompletionRate = taskStats.bigTasks.total > 0 ? 
    Math.round((taskStats.bigTasks.completed / taskStats.bigTasks.total) * 100) : 0
  
  const smallTaskCompletionRate = taskStats.smallTasks.total > 0 ? 
    Math.round((taskStats.smallTasks.completed / taskStats.smallTasks.total) * 100) : 0

  const getBigTaskName = (bigTaskId: string) => {
    const bigTask = bigTasks.find(task => task.id === bigTaskId)
    return bigTask?.name || '不明なタスク'
  }


  const getTaskStatusColor = (task: SmallTask) => {
    if (task.actual_minutes && task.actual_minutes > 0) return 'bg-green-100 text-green-800'
    if (task.is_emergency) return 'bg-red-100 text-red-800'
    return 'bg-blue-100 text-blue-800'
  }

  const getTaskStatusText = (task: SmallTask) => {
    if (task.actual_minutes && task.actual_minutes > 0) return '完了'
    if (task.is_emergency) return '緊急'
    return '予定'
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">ダッシュボード</h1>
            <p className="text-gray-600 mt-1">
              {format(today, 'yyyy年MM月dd日 (E)', { locale: ja })}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Link href="/projects/new">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                新しいプロジェクト
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Overview Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">プロジェクト</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{projectStats.active}</div>
            <div className="text-sm text-gray-500">アクティブ / {projectStats.total}総数</div>
            <Progress value={projectCompletionRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">大タスク</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{taskStats.bigTasks.active}</div>
            <div className="text-sm text-gray-500">実行中 / {taskStats.bigTasks.total}総数</div>
            <Progress value={bigTaskCompletionRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">小タスク</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{taskStats.smallTasks.pending}</div>
            <div className="text-sm text-gray-500">未完了 / {taskStats.smallTasks.total}総数</div>
            <Progress value={smallTaskCompletionRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">緊急タスク</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{taskStats.smallTasks.emergency}</div>
            <div className="text-sm text-gray-500">要優先対応</div>
            {taskStats.smallTasks.emergency > 0 && (
              <div className="mt-2 flex items-center gap-1 text-xs text-red-600">
                <AlertTriangle className="h-3 w-3" />
                要注意
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Today's Tasks */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                今日のタスク
              </CardTitle>
              <Badge variant="outline">{todayTasks.length}件</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {todayTasks.length === 0 ? (
                <p className="text-center text-gray-500 py-4">今日のタスクはありません</p>
              ) : (
                todayTasks.slice(0, 5).map(task => (
                  <div key={task.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded">
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
                      <div className="text-sm text-gray-500 truncate">
                        {getBigTaskName(task.big_task_id)}
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {format(parseISO(task.scheduled_start), 'HH:mm', { locale: ja })}
                    </div>
                  </div>
                ))
              )}
              
              {todayTasks.length > 5 && (
                <div className="text-center pt-2">
                  <Link href="/schedule">
                    <Button variant="outline" size="sm">
                      他 {todayTasks.length - 5}件を表示
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tomorrow's Tasks */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                明日のタスク
              </CardTitle>
              <Badge variant="outline">{tomorrowTasks.length}件</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tomorrowTasks.length === 0 ? (
                <p className="text-center text-gray-500 py-4">明日のタスクはありません</p>
              ) : (
                tomorrowTasks.slice(0, 5).map(task => (
                  <div key={task.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">{task.name}</span>
                        {task.is_emergency && (
                          <Zap className="h-3 w-3 text-red-500" />
                        )}
                      </div>
                      <div className="text-sm text-gray-500 truncate">
                        {getBigTaskName(task.big_task_id)}
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {format(parseISO(task.scheduled_start), 'HH:mm', { locale: ja })}
                    </div>
                  </div>
                ))
              )}
              
              {tomorrowTasks.length > 5 && (
                <div className="text-center pt-2">
                  <Link href="/schedule">
                    <Button variant="outline" size="sm">
                      他 {tomorrowTasks.length - 5}件を表示
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Projects */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                アクティブなプロジェクト
              </CardTitle>
              <Link href="/projects">
                <Button variant="outline" size="sm">
                  すべて表示
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeProjects.length === 0 ? (
                <div className="text-center py-6">
                  <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">アクティブなプロジェクトがありません</p>
                  <Link href="/projects/new">
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      プロジェクトを作成
                    </Button>
                  </Link>
                </div>
              ) : (
                activeProjects.map(project => {
                  const projectBigTasks = bigTasks.filter(t => t.project_id === project.id)
                  const completedBigTasks = projectBigTasks.filter(t => t.status === 'completed')
                  const progress = projectBigTasks.length > 0 ? 
                    Math.round((completedBigTasks.length / projectBigTasks.length) * 100) : 0
                  
                  return (
                    <Link key={project.id} href={`/projects/${project.id}`}>
                      <div className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium truncate">{project.name}</h4>
                          <span className="text-sm text-gray-500">{progress}%</span>
                        </div>
                        <p className="text-sm text-gray-600 truncate mb-2">{project.goal}</p>
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-gray-500">
                            {projectBigTasks.length}個の大タスク
                          </div>
                          <Progress value={progress} className="w-20" />
                        </div>
                      </div>
                    </Link>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              クイックアクション
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Link href="/projects/new">
                <Button className="w-full flex items-center gap-2 justify-start h-12">
                  <Plus className="h-5 w-5" />
                  新しいプロジェクトを作成
                </Button>
              </Link>
              
              <Link href="/schedule">
                <Button variant="outline" className="w-full flex items-center gap-2 justify-start h-12">
                  <Calendar className="h-5 w-5" />
                  スケジュールを確認
                </Button>
              </Link>
              
              <Link href="/reports">
                <Button variant="outline" className="w-full flex items-center gap-2 justify-start h-12">
                  <BarChart3 className="h-5 w-5" />
                  レポートを表示
                </Button>
              </Link>
              
              {taskStats.smallTasks.emergency > 0 && (
                <Link href="/schedule">
                  <Button variant="destructive" className="w-full flex items-center gap-2 justify-start h-12">
                    <AlertTriangle className="h-5 w-5" />
                    緊急タスクを確認 ({taskStats.smallTasks.emergency}件)
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
