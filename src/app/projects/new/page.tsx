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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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

export default function ProjectCreatePage() {
  const router = useRouter()
  const { createProject } = useProjects('current-user')
  const { createBigTask } = useBigTasks('current-user')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hoveredTask, setHoveredTask] = useState<string | null>(null)
  
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

  const handleSubmit = async () => {
    if (!validateForm()) {
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
        status: 'planning' as const,
        version: 1,
        estimated_total_hours: totalTaskHours,
      }

      const newProject = await createProject(projectData)
      
      // BigTasksを作成
      const bigTaskPromises = weeklyAllocations.map(async (allocation, index) => {
        const allocatedTasks = allocation.allocatedTasks
        if (allocatedTasks.length === 0) return null
        
        // 各週の最初のタスクのカテゴリを取得
        const firstTaskId = allocatedTasks[0].taskId
        const validTasks = getValidTasks()
        const firstTask = validTasks.find(t => t.id === firstTaskId)
        const category = firstTask?.category || 'その他'
        
        const bigTaskData = {
          project_id: newProject.id,
          user_id: 'current-user',
          name: `第${allocation.weekNumber}週のタスク`,
          category,
          week_number: allocation.weekNumber,
          estimated_hours: allocation.totalAllocatedHours,
          status: 'pending' as const,
        }
        
        return createBigTask(bigTaskData)
      })
      
      await Promise.all(bigTaskPromises.filter(Boolean))
      
      toast.success('プロジェクトが正常に作成されました')
      reset()
      router.push('/projects')
      
    } catch (error) {
      console.error('Failed to create project:', error)
      toast.error('プロジェクトの作成に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    reset()
    router.push('/projects')
  }

  const totalAvailableHours = weeklyAvailableHours * totalWeeks
  const utilizationRate = totalAvailableHours > 0 ? (totalTaskHours / totalAvailableHours) * 100 : 0

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/projects">
            <Button variant="ghost" size="sm" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              プロジェクト一覧に戻る
            </Button>
          </Link>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Calendar className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">新しいプロジェクト</h1>
            <p className="text-muted-foreground mt-1">目標設定から週別タスク配分まで一括で計画</p>
          </div>
        </div>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左側 - 基本情報とタスク */}
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
                  onChange={(e) => setProjectName(e.target.value)}
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
                  onChange={(e) => setGoal(e.target.value)}
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
                    onChange={(e) => setStartDate(new Date(e.target.value))}
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
                    onChange={(e) => setEndDate(new Date(e.target.value))}
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
                  <Select value={weekdayWorkDays.toString()} onValueChange={(value) => setWeekdayWorkDays(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3, 4, 5].map((days) => (
                        <SelectItem key={days} value={days.toString()}>
                          {days}日
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>休日の作業可能日数</Label>
                  <Select value={weekendWorkDays.toString()} onValueChange={(value) => setWeekendWorkDays(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2].map((days) => (
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
                    onChange={(e) => setWeekdayHoursPerDay(parseFloat(e.target.value) || 0)}
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
                    onChange={(e) => setWeekendHoursPerDay(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>バッファ率（%）</Label>
                <Select value={bufferRate.toString()} onValueChange={(value) => setBufferRate(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 11 }, (_, i) => 50 + i * 5).map((rate) => (
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
                  ({weekdayWorkDays}日 × {weekdayHoursPerDay}h + {weekendWorkDays}日 × {weekendHoursPerDay}h) × {bufferRate}%
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
                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">合計時間</span>
                    <span className="text-lg font-bold">{totalTaskHours.toFixed(1)}時間</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-sm text-muted-foreground">利用可能時間</span>
                    <span className="text-sm text-muted-foreground">{totalAvailableHours.toFixed(1)}時間</span>
                  </div>
                  <div className="mt-2">
                    <Progress value={utilizationRate} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">
                      使用率: {utilizationRate.toFixed(1)}%
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 右側 - 週別タスク配分 */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                週別タスク配分
              </CardTitle>
            </CardHeader>
            <CardContent>
              {weeklyAllocations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>タスクを追加すると自動で週別に配分されます</p>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  {weeklyAllocations.map((allocation) => {
                    const isOverCapacity = allocation.utilizationRate > 100
                    
                    return (
                      <div 
                        key={allocation.weekNumber} 
                        className="bg-white rounded-lg shadow-sm border p-4 space-y-3"
                      >
                        {/* ヘッダー行 */}
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-gray-900">第{allocation.weekNumber}週</h4>
                            <p className="text-sm text-gray-500">
                              {format(allocation.startDate, 'M/d', { locale: ja })} - {format(allocation.endDate, 'M/d', { locale: ja })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900">
                              {allocation.totalAllocatedHours.toFixed(1)}h / {allocation.availableHours.toFixed(1)}h
                            </p>
                            <p className={`text-sm font-medium ${isOverCapacity ? 'text-red-600' : 'text-gray-600'}`}>
                              ({allocation.utilizationRate.toFixed(1)}%)
                            </p>
                          </div>
                        </div>

                        {/* タスクバッジ */}
                        <div className="flex flex-wrap gap-1.5">
                          {allocation.allocatedTasks.map((task, index) => {
                            const taskData = tasks.find(t => t.id === task.taskId)
                            const categoryColor = taskData?.category ? getCategoryColor(taskData.category) : '#999999'
                            const taskKey = `${task.taskId}-${index}`
                            const isHovered = hoveredTask === taskKey
                            
                            return (
                              <div
                                key={taskKey}
                                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-all duration-200 cursor-pointer ${
                                  isHovered ? 'ring-2 ring-offset-1 ring-current' : ''
                                }`}
                                style={{ 
                                  backgroundColor: `${categoryColor}20`,
                                  color: categoryColor
                                }}
                                onMouseEnter={() => setHoveredTask(taskKey)}
                                onMouseLeave={() => setHoveredTask(null)}
                              >
                                <div 
                                  className="w-2 h-2 rounded-full" 
                                  style={{ backgroundColor: categoryColor }} 
                                />
                                <span className="font-medium">{task.taskName}</span>
                                <span className="font-semibold">{task.allocatedHours.toFixed(1)}h</span>
                              </div>
                            )
                          })}
                        </div>

                        {/* プログレスバー */}
                        <div className="space-y-1">
                          <div className="relative h-1 bg-gray-200 rounded-full overflow-hidden">
                            {allocation.allocatedTasks.map((task, index) => {
                              const taskData = tasks.find(t => t.id === task.taskId)
                              const categoryColor = taskData?.category ? getCategoryColor(taskData.category) : '#999999'
                              const percentage = (task.allocatedHours / allocation.availableHours) * 100
                              const leftOffset = allocation.allocatedTasks
                                .slice(0, index)
                                .reduce((sum, t) => sum + (t.allocatedHours / allocation.availableHours) * 100, 0)
                              const taskKey = `${task.taskId}-${index}`
                              const isHovered = hoveredTask === taskKey
                              
                              return (
                                <div
                                  key={taskKey}
                                  className={`absolute top-0 h-full transition-all duration-200 ${
                                    isHovered ? 'z-10 scale-y-150' : ''
                                  }`}
                                  style={{
                                    left: `${leftOffset}%`,
                                    width: `${percentage}%`,
                                    backgroundColor: categoryColor,
                                    opacity: isHovered ? 0.9 : 0.7
                                  }}
                                />
                              )
                            })}
                          </div>
                          
                          {isOverCapacity && (
                            <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                              <span>⚠️</span>
                              作業時間が超過しています
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  
                  {/* 全体の警告をここに移動 */}
                  {isOverCapacity && (
                    <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <div className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-5 w-5" />
                        <span className="font-medium">作業時間不足の警告</span>
                      </div>
                      <p className="text-sm text-destructive/80 mt-1">
                        タスクの合計時間（{totalTaskHours.toFixed(1)}時間）が利用可能時間（{totalAvailableHours.toFixed(1)}時間）を超えています。
                        期限を延長するか、タスクを調整してください。
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* アクションボタン */}
          <div className="flex gap-3">
            <Button 
              onClick={handleSubmit}
              disabled={isSubmitting || !projectName || !goal || getValidTasks().length === 0}
              className="flex-1 focus-visible"
              tabIndex={100}
            >
              {isSubmitting ? '作成中...' : 'プロジェクトを作成'}
            </Button>
            <Button 
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
  )
}