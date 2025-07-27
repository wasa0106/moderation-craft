/**
 * タイマーページ - 作業時間の記録と管理
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTimer } from '@/hooks/use-timer'
import { useTimerStore } from '@/stores/timer-store'
import { useSmallTasksByDateRange } from '@/hooks/use-small-tasks'
import { useProjects } from '@/hooks/use-projects'
import { useWeeklyTotal } from '@/hooks/use-weekly-total'
import { SmallTask, Project, WorkSession } from '@/types'
import { workSessionRepository } from '@/lib/db/repositories'
import { MoodDialog } from '@/components/timer/mood-dialog'
import { DopamineDialog } from '@/components/timer/dopamine-dialog'
import { FocusDialog } from '@/components/timer/focus-dialog'
import { UnplannedTaskDialog } from '@/components/timer/unplanned-task-dialog'
import { CombinedScheduleView } from '@/components/timer/combined-schedule-view'
import { WorkProgressCard } from '@/components/timer/work-progress-card'
import {
  Play,
  Pause,
  Square,
  Brain,
  Sparkles,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Folder,
  Zap,
} from 'lucide-react'
import { format, addDays, subDays, isToday } from 'date-fns'
import { ja } from 'date-fns/locale'

export default function TimerPage() {
  const { projects } = useProjects('current-user')
  const { startTimer, endTimer } = useTimer('current-user')
  
  const {
    isRunning,
    activeSession,
    currentTask,
    currentProject,
    elapsedTime,
    getFormattedTime,
    setCurrentTask,
    setCurrentProject,
  } = useTimerStore()

  const [showMoodDialog, setShowMoodDialog] = useState(false)
  const [showDopamineDialog, setShowDopamineDialog] = useState(false)
  const [showFocusDialog, setShowFocusDialog] = useState(false)
  const [selectedTask, setSelectedTask] = useState<SmallTask | null>(null)
  const [todaySessions, setTodaySessions] = useState<WorkSession[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showUnplannedDialog, setShowUnplannedDialog] = useState(false)
  const [unplannedTaskName, setUnplannedTaskName] = useState('')
  
  // useWeeklyTotalフックは選択日の後に呼び出す
  const { weeklyTotalFormatted, refresh: refreshWeeklyTotal } = useWeeklyTotal('current-user', selectedDate)
  
  // 日付範囲を計算（選択日の前後7日間のタスクを取得）
  const startDate = subDays(selectedDate, 7)
  const endDate = addDays(selectedDate, 7)
  
  // 日付範囲でタスクを取得
  const { smallTasks, loadTasks } = useSmallTasksByDateRange(
    'current-user',
    startDate.toISOString(),
    endDate.toISOString()
  )
  
  // loadSessions関数を定義
  const loadSessions = useCallback(async () => {
    try {
      const dateString = format(selectedDate, 'yyyy-MM-dd')
      const sessions = await workSessionRepository.getSessionsForDate(
        'current-user',
        dateString
      )
      setTodaySessions(sessions)
    } catch (error) {
      console.error('Failed to load sessions:', error)
    }
  }, [selectedDate])

  // タイマーの更新
  useEffect(() => {
    if (!isRunning) return

    const interval = setInterval(() => {
      const store = useTimerStore.getState()
      if (store.startTime) {
        const elapsed = Math.floor((Date.now() - store.startTime.getTime()) / 1000)
        store.updateElapsedTime(elapsed)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [isRunning])

  // 選択日のセッションを取得
  useEffect(() => {
    loadSessions()
    
    // セッション終了時にリロード
    if (!isRunning && activeSession) {
      loadSessions()
    }
  }, [isRunning, activeSession, loadSessions])

  // タイマー開始時にもセッションを更新
  useEffect(() => {
    console.log('Session update effect triggered:', {
      isRunning,
      activeSessionId: activeSession?.id,
      selectedDate: selectedDate.toISOString()
    })
    
    if (isRunning && activeSession) {
      loadSessions()
    }
  }, [isRunning, activeSession?.id, loadSessions])

  // アクティブセッションのタスクを復元
  useEffect(() => {
    if (activeSession && activeSession.small_task_id && !currentTask) {
      // セッションにタスクIDがあるが、currentTaskが設定されていない場合
      const task = smallTasks.find(t => t.id === activeSession.small_task_id)
      if (task) {
        setCurrentTask(task)
        const project = projects.find(p => p.id === task.project_id)
        if (project) {
          setCurrentProject(project)
        }
      }
    }
  }, [activeSession, smallTasks, projects, currentTask, setCurrentTask, setCurrentProject])

  // 選択日のタスクを取得
  const dayTasks = smallTasks.filter(task => {
    if (!task.scheduled_start) return false
    const taskDate = new Date(task.scheduled_start)
    return (
      taskDate.getDate() === selectedDate.getDate() &&
      taskDate.getMonth() === selectedDate.getMonth() &&
      taskDate.getFullYear() === selectedDate.getFullYear()
    )
  })

  // デバッグ用
  useEffect(() => {
    console.log('Timer page debug:', {
      selectedDate: format(selectedDate, 'yyyy-MM-dd'),
      smallTasksCount: smallTasks.length,
      dayTasksCount: dayTasks.length,
      dateRange: {
        start: format(startDate, 'yyyy-MM-dd'),
        end: format(endDate, 'yyyy-MM-dd')
      },
      sampleTasks: smallTasks.slice(0, 5).map(t => ({
        name: t.name,
        scheduled_start: t.scheduled_start,
        scheduled_end: t.scheduled_end,
        scheduled_date: t.scheduled_start ? format(new Date(t.scheduled_start), 'yyyy-MM-dd') : 'null'
      }))
    })
  }, [selectedDate, smallTasks, dayTasks, startDate, endDate])

  // タスクに紐づくプロジェクトを取得
  const getProjectForTask = (task: SmallTask): Project | undefined => {
    return projects.find(p => p.id === task.project_id)
  }

  const handleStartTimer = async (task?: SmallTask, taskDescription?: string) => {
    try {
      console.log('handleStartTimer called with:', { task, taskDescription })
      if (task) {
        setSelectedTask(task)
        const project = getProjectForTask(task)
        setCurrentTask(task)
        setCurrentProject(project || null)
        console.log('Starting timer with taskId:', task.id)
        await startTimer({ taskId: task.id })
      } else if (taskDescription) {
        // 計画外タスクの場合
        setCurrentTask(null)
        setCurrentProject(null)
        console.log('Starting timer with taskDescription:', taskDescription)
        await startTimer({ taskDescription })
      } else {
        // タスクなしの場合
        console.log('Starting timer without task')
        await startTimer({})
      }
      console.log('Timer started successfully')
      
      // 即座にセッションを再読み込み
      console.log('Reloading sessions immediately after start')
      const dateString = format(selectedDate, 'yyyy-MM-dd')
      console.log('Selected date for query:', dateString)
      const sessions = await workSessionRepository.getSessionsForDate(
        'current-user',
        dateString
      )
      console.log('Sessions after timer start:', sessions)
      
      // 全セッションも確認
      const allSessions = await workSessionRepository.getByUserId('current-user')
      console.log('All sessions for user:', allSessions)
      setTodaySessions(sessions)
    } catch (error) {
      console.error('Failed to start timer:', error)
    }
  }

  const handleStopTimer = async () => {
    // 集中度ダイアログを表示せずに直接停止する場合は以下のコメントを外す
    // await endTimer()
    // return
    
    // 集中度ダイアログを表示する場合
    setShowFocusDialog(true)
  }

  const handleFocusSubmit = async (focusLevel: number) => {
    await endTimer({ focusLevel })
    setShowFocusDialog(false)
    
    // セッション一覧を更新
    const dateString = format(selectedDate, 'yyyy-MM-dd')
    const sessions = await workSessionRepository.getSessionsForDate(
      'current-user',
      dateString
    )
    setTodaySessions(sessions)
    
    // 週間合計も更新
    refreshWeeklyTotal()
  }


  const formatElapsedTime = () => {
    const hours = Math.floor(elapsedTime / 3600)
    const minutes = Math.floor((elapsedTime % 3600) / 60)
    const seconds = elapsedTime % 60

    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  const handleUnplannedTaskConfirm = (taskName: string) => {
    setUnplannedTaskName(taskName)
    handleStartTimer(undefined, taskName)
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* ヘッダー部分 */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              {currentTask ? (
                <div>
                  <CardTitle className="text-2xl">{currentTask.name}</CardTitle>
                  {currentProject && (
                    <p className="text-sm text-muted-foreground mt-1">
                      プロジェクト: {currentProject.name}
                    </p>
                  )}
                </div>
              ) : unplannedTaskName ? (
                <div>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <Zap className="h-6 w-6 text-orange-500" />
                    {unplannedTaskName}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    計画外タスク
                  </p>
                </div>
              ) : (
                <div>
                  <CardTitle className="text-2xl">タイマー</CardTitle>
                  {currentProject && (
                    <p className="text-sm text-muted-foreground mt-1">
                      選択中のプロジェクト: {currentProject.name}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              {/* タイマーコントロールボタン（ヘッダー部分） */}
              {!isRunning && (
                <Button
                  onClick={() => handleStartTimer(currentTask || undefined)}
                  className="bg-[#5E621B] hover:bg-[#464A02] text-white gap-2"
                >
                  <Play className="h-5 w-5" />
                  開始
                </Button>
              )}
              {isRunning && (
                <Button
                  onClick={handleStopTimer}
                  variant="destructive"
                  className="gap-2"
                >
                  <Square className="h-5 w-5" />
                  停止
                </Button>
              )}
              
              {/* タスク選択 */}
              <Select
                value={currentTask?.id || 'none'}
                onValueChange={async (value) => {
                  if (value === 'none') {
                    setCurrentTask(null)
                    setCurrentProject(null)
                  } else if (value === 'unplanned') {
                    // 計画外の作業を選択した場合
                    setShowUnplannedDialog(true)
                  } else {
                    const task = smallTasks.find(t => t.id === value)
                    if (task) {
                      setCurrentTask(task)
                      const project = getProjectForTask(task)
                      setCurrentProject(project || null)
                      
                      // タイマー実行中の場合、セッションを更新
                      if (isRunning && activeSession) {
                        await workSessionRepository.update(activeSession.id, {
                          small_task_id: task.id
                        })
                        // セッション一覧を再読み込みして画面に反映
                        const dateString = format(selectedDate, 'yyyy-MM-dd')
                        const sessions = await workSessionRepository.getSessionsForDate(
                          'current-user',
                          dateString
                        )
                        setTodaySessions(sessions)
                      }
                    }
                  }
                }}
              >
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="タスクを選択">
                    {currentTask ? (
                      <span>{currentTask.name}</span>
                    ) : (
                      <span className="text-muted-foreground">タスクを選択</span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">タスクなし</span>
                  </SelectItem>
                  <SelectItem value="unplanned">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-orange-500" />
                      <span>計画外の作業...</span>
                    </div>
                  </SelectItem>
                  {smallTasks
                    .sort((a, b) => {
                      // 今日のタスクを優先
                      const aIsToday = dayTasks.some(t => t.id === a.id)
                      const bIsToday = dayTasks.some(t => t.id === b.id)
                      if (aIsToday && !bIsToday) return -1
                      if (!aIsToday && bIsToday) return 1
                      // それ以外は名前順
                      return a.name.localeCompare(b.name)
                    })
                    .map((task) => {
                      const project = getProjectForTask(task)
                      const isToday = dayTasks.some(t => t.id === task.id)
                      return (
                        <SelectItem key={task.id} value={task.id}>
                          <div className="flex items-center gap-2">
                            <span className={!isToday ? 'text-muted-foreground' : ''}>
                              {task.name}
                            </span>
                            {project && (
                              <Badge variant={isToday ? "secondary" : "outline"} className="text-xs">
                                {project.name}
                              </Badge>
                            )}
                            {!isToday && task.scheduled_start && (
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(task.scheduled_start), 'M/d')}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      )
                    })}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowMoodDialog(true)}
                title="感情を記録"
              >
                <Brain className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowDopamineDialog(true)}
                title="ドーパミン記録"
              >
                <Sparkles className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl font-mono font-bold">{formatElapsedTime()}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 作業進捗カード */}
      <WorkProgressCard 
        dayTasks={dayTasks} 
        todaySessions={todaySessions} 
        weeklyTotal={weeklyTotalFormatted}
        selectedDate={selectedDate}
      />

      {/* メインコンテンツ */}
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              {isToday(selectedDate) ? '今日' : format(selectedDate, 'M月d日', { locale: ja })}のスケジュール
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setSelectedDate(subDays(selectedDate, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedDate(new Date())}
                disabled={isToday(selectedDate)}
              >
                今日
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0" style={{ height: '70vh', minHeight: '600px' }}>
          <CombinedScheduleView
            tasks={dayTasks}
            sessions={todaySessions}
            projects={projects}
            currentTaskId={currentTask?.id}
            onTaskClick={(task) => {
              if (!isRunning && isToday(selectedDate)) {
                setSelectedTask(task)
                handleStartTimer(task)
              }
            }}
            onTaskStatusChange={() => {
              // タスクの状態が変更されたら再読み込み
              loadTasks()
              loadSessions()
            }}
            date={selectedDate}
          />
        </CardContent>
      </Card>

      {/* ダイアログ */}
      <MoodDialog
        open={showMoodDialog}
        onOpenChange={setShowMoodDialog}
        userId="current-user"
      />
      
      <DopamineDialog
        open={showDopamineDialog}
        onOpenChange={setShowDopamineDialog}
        userId="current-user"
      />
      
      <FocusDialog
        open={showFocusDialog}
        onOpenChange={setShowFocusDialog}
        onSubmit={handleFocusSubmit}
      />
      
      <UnplannedTaskDialog
        open={showUnplannedDialog}
        onOpenChange={setShowUnplannedDialog}
        onConfirm={handleUnplannedTaskConfirm}
      />
    </div>
  )
}