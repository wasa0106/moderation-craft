/**
 * タイマーページ - 作業時間の記録と管理
 */

'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { useTimer } from '@/hooks/use-timer'
import { useTimerStore } from '@/stores/timer-store'
import { useSmallTasksByDateRange, useCreateSmallTask } from '@/hooks/use-small-tasks'
import { useProjects } from '@/hooks/use-projects'
import { SmallTask, Project, WorkSession } from '@/types'
import { workSessionRepository } from '@/lib/db/repositories'
import { MoodDialog } from '@/components/timer/mood-dialog'
import { DopamineDialog } from '@/components/timer/dopamine-dialog'
import { FocusDialog } from '@/components/timer/focus-dialog'
import { UnplannedTaskDialog, UnplannedTaskData } from '@/components/timer/unplanned-task-dialog'
import { CombinedScheduleView } from '@/components/timer/combined-schedule-view'
import { WorkProgressCard } from '@/components/timer/work-progress-card'
import { TimerTaskDisplay, TimerTaskDisplayRef } from '@/components/timer/timer-task-display'
import { TimerControls } from '@/components/timer/timer-controls'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, addDays, subDays, isToday } from 'date-fns'
import { ja } from 'date-fns/locale'

export default function TimerPage() {
  const { projects } = useProjects('current-user')
  const { startTimer, endTimer } = useTimer('current-user')

  const { isRunning, activeSession, currentTask, setCurrentTask, setCurrentProject } =
    useTimerStore()

  const [showMoodDialog, setShowMoodDialog] = useState(false)
  const [showDopamineDialog, setShowDopamineDialog] = useState(false)
  const [showFocusDialog, setShowFocusDialog] = useState(false)
  const [todaySessions, setTodaySessions] = useState<WorkSession[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showUnplannedDialog, setShowUnplannedDialog] = useState(false)
  const timerTaskDisplayRef = useRef<TimerTaskDisplayRef>(null)

  // 日付範囲を計算（選択日の前後7日間のタスクを取得）
  const startDate = subDays(selectedDate, 7)
  const endDate = addDays(selectedDate, 7)

  // 日付範囲でタスクを取得
  const { smallTasks, loadTasks } = useSmallTasksByDateRange(
    'current-user',
    startDate.toISOString(),
    endDate.toISOString()
  )

  // タスク作成フック
  const { createSmallTask } = useCreateSmallTask('current-user')

  // loadSessions関数を定義
  const loadSessions = useCallback(async () => {
    try {
      const dateString = format(selectedDate, 'yyyy-MM-dd')
      const sessions = await workSessionRepository.getSessionsForDate('current-user', dateString)
      setTodaySessions(sessions)
    } catch (error) {
      console.error('Failed to load sessions:', error)
    }
  }, [selectedDate])

  // タイマーの更新はuseTimerフック内で管理されるため、ここでは不要

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
    if (isRunning && activeSession) {
      loadSessions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // 選択日のタスクを取得（緊急タスクは除外）
  const dayTasks = smallTasks.filter(task => {
    if (!task.scheduled_start) return false
    if (task.is_emergency) return false // 緊急タスクは予定エリアに表示しない
    const taskDate = new Date(task.scheduled_start)
    return (
      taskDate.getDate() === selectedDate.getDate() &&
      taskDate.getMonth() === selectedDate.getMonth() &&
      taskDate.getFullYear() === selectedDate.getFullYear()
    )
  })

  // タスクに紐づくプロジェクトを取得
  const getProjectForTask = (task: SmallTask): Project | undefined => {
    return projects.find(p => p.id === task.project_id)
  }

  const handleStartTimer = (task?: SmallTask, taskDescription?: string) => {
    if (task) {
      const project = getProjectForTask(task)
      setCurrentTask(task)
      setCurrentProject(project || null)
      startTimer({ taskId: task.id })
    } else if (taskDescription) {
      // 計画外タスクの場合
      setCurrentTask(null)
      setCurrentProject(null)
      startTimer({ taskDescription })
    } else {
      // タスクなしの場合 - ポップオーバーを開く
      timerTaskDisplayRef.current?.openPopover()
      return // タイマーは開始しない
    }

    // 即座にセッションを再読み込み
    setTimeout(() => {
      loadSessions()
    }, 100)
  }

  const handleStopTimer = () => {
    // 集中度ダイアログを表示せずに直接停止する場合は以下のコメントを外す
    // endTimer()
    // return

    // 集中度ダイアログを表示する場合
    setShowFocusDialog(true)
  }

  const handleFocusSubmit = (focusLevel: number) => {
    endTimer({ focusLevel })
    setShowFocusDialog(false)

    // タスク選択をクリア
    setCurrentTask(null)
    setCurrentProject(null)

    // セッション一覧を更新
    setTimeout(() => {
      loadSessions()
    }, 100)
  }

  const handleUnplannedTaskConfirm = async (taskData: UnplannedTaskData) => {
    try {
      const now = new Date()
      const endTime = new Date(now.getTime() + 30 * 60 * 1000) // 30分後

      // 緊急SmallTaskを作成
      const smallTask = await createSmallTask({
        project_id: taskData.projectId,
        user_id: 'current-user',
        name: taskData.name,
        estimated_minutes: 30,
        scheduled_start: now.toISOString(),
        scheduled_end: endTime.toISOString(),
        is_emergency: true,
        status: 'pending',
      })

      handleStartTimer(smallTask)
    } catch (error) {
      console.error('Failed to create emergency task:', error)
      // エラーハンドリング（必要に応じてトーストなどで通知）
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 bg-surface-0">
      {/* Header */}
      <div className="overflow-hidden bg-surface-2 border-t border-border">
        <div className="px-4 md:px-6 py-7">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <TimerTaskDisplay
                ref={timerTaskDisplayRef}
                smallTasks={smallTasks}
                projects={projects}
                dayTasks={dayTasks}
                onUnplannedTaskClick={() => setShowUnplannedDialog(true)}
                onTaskChange={async task => {
                  if (isRunning && activeSession && task) {
                    await workSessionRepository.update(activeSession.id, {
                      small_task_id: task.id,
                    })
                    await loadSessions()
                  }
                }}
              />
            </div>
            <div className="flex items-center gap-4">
              <TimerControls
                onStartTimer={handleStartTimer}
                onStopTimer={handleStopTimer}
                onMoodClick={() => setShowMoodDialog(true)}
                onDopamineClick={() => setShowDopamineDialog(true)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* メインコンテンツエリア - 横並びレイアウト */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px]">
        {/* 左側：スケジュールセクション */}
        <div className="overflow-hidden bg-surface-1 shadow-surface-1 border border-border h-[650px]">
          <div style={{ height: '650px', position: 'relative' }}>
            <CombinedScheduleView
              tasks={dayTasks}
              sessions={todaySessions}
              projects={projects}
              currentTaskId={currentTask?.id}
              onTaskClick={task => {
                if (!isRunning && isToday(selectedDate)) {
                  handleStartTimer(task)
                }
              }}
              onTaskStatusChange={() => {
                // タスクの状態が変更されたら再読み込み
                loadTasks()
                loadSessions()
              }}
              date={selectedDate}
              userId="current-user"
            />
          </div>
        </div>

        {/* 右側：作業進捗セクション */}
        <div className="lg:sticky lg:top-0 lg:h-fit">
          {/* 日付送りコントロール */}
          <div className="bg-card p-3 border border-border">
            <div className="flex items-center justify-between">
              <Button
                onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:bg-surface-2"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <div className="text-center flex-1">
                <div className="text-lg font-medium text-foreground">
                  {format(selectedDate, 'yyyy年M月d日', { locale: ja })}
                </div>
              </div>

              <Button
                onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:bg-surface-2"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <WorkProgressCard
            dayTasks={dayTasks}
            todaySessions={todaySessions}
            projects={projects}
            selectedDate={selectedDate}
          />
        </div>
      </div>

      {/* ダイアログ */}
      <MoodDialog open={showMoodDialog} onOpenChange={setShowMoodDialog} userId="current-user" />

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
        projects={projects}
      />
    </div>
  )
}
