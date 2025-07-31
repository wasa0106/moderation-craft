/**
 * WeeklySchedulePage - 週次スケジュール管理画面
 * 来週の計画を立てるためのページ（主に日曜日に使用）
 */

'use client'

import { useState, useMemo, useEffect } from 'react'
import { useWeeklySchedule } from '@/hooks/use-weekly-schedule'
import { useProjects } from '@/hooks/use-projects'
import { useBigTasksByDateRange } from '@/hooks/use-big-tasks'
import { useSmallTasksByDateRange } from '@/hooks/use-small-tasks'
import { useScheduleMemo } from '@/hooks/use-schedule-memo'
import { dateUtils } from '@/lib/utils/date-utils'
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns'
import { WeeklyCalendar } from '@/components/schedule/weekly-calendar'
import { TaskMemo } from '@/components/schedule/task-memo'

// デバッグユーティリティを動的インポート
if (typeof window !== 'undefined') {
  import('@/utils/debug-utils').then(() => {
    console.log('Debug utilities loaded for weekly schedule page')
  })
}

export default function WeeklySchedulePage() {
  const userId = 'current-user' // 仮のユーザーID

  // 統一された週選択状態（タスク一覧とカレンダーで共有）
  const [currentWeek, setCurrentWeek] = useState(new Date())

  // useScheduleMemoフックを使用
  const { content: savedContent, save, isSaving, error } = useScheduleMemo(userId, currentWeek)

  // ローカルステートで編集内容を管理
  const [localContent, setLocalContent] = useState('')
  const [isDirty, setIsDirty] = useState(false)

  // 保存されたコンテンツが変わったらローカルステートを更新
  useEffect(() => {
    setLocalContent(savedContent)
    setIsDirty(false)
  }, [savedContent])

  // 内容変更時のハンドラ
  const handleContentChange = (newContent: string) => {
    setLocalContent(newContent)
    setIsDirty(newContent !== savedContent)
  }

  // 保存ハンドラ
  const handleSave = () => {
    if (isDirty) {
      save(localContent)
      setIsDirty(false)
    }
  }

  // Task Overview Table用のデータ
  const { projects } = useProjects(userId)

  // 週の開始日と終了日を計算
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 })

  // 日付をYYYY-MM-DD形式に変換
  const weekStartStr = dateUtils.toDateString(weekStart)
  const weekEndStr = dateUtils.toDateString(weekEnd)

  // 日付範囲でBigTasksを取得
  const { bigTasks: weekBigTasks } = useBigTasksByDateRange(userId, weekStartStr, weekEndStr)

  // 日付範囲でSmallTasksを取得
  const { smallTasks: weekSmallTasks } = useSmallTasksByDateRange(userId, weekStartStr, weekEndStr)

  // Weekly Calendar用のデータ
  const calendarData = useWeeklySchedule(userId, currentWeek)

  // デバッグ用ログ出力
  useEffect(() => {
    console.log('週が変更されました:', {
      currentWeek: format(currentWeek, 'yyyy-MM-dd'),
      weekStart: format(weekStart, 'yyyy-MM-dd'),
      weekEnd: format(weekEnd, 'yyyy-MM-dd'),
    })
  }, [currentWeek, weekStart, weekEnd])

  // プロジェクトが存在するBigTasksのみをフィルタリング
  const currentWeekBigTasks = useMemo(() => {
    // 存在するプロジェクトIDのセットを作成
    const existingProjectIds = new Set(projects.map(p => p.id))

    console.log('日付範囲でBigTasksを取得:', {
      weekStartStr,
      weekEndStr,
      取得件数: weekBigTasks.length,
      プロジェクト数: projects.length,
    })

    // プロジェクトが存在するタスクのみをフィルタリング
    const filtered = weekBigTasks.filter(task => {
      if (!existingProjectIds.has(task.project_id)) {
        console.log('プロジェクトが存在しないタスク:', task.name, task.project_id)
        return false
      }
      return true
    })

    console.log('フィルタリング後:', filtered.length, '件')
    return filtered
  }, [weekBigTasks, projects, weekStartStr, weekEndStr])

  // デバッグ用：週が変更されたときのログ
  console.log('Week changed:', {
    currentWeek: format(currentWeek, 'yyyy-MM-dd'),
    weekStartDate: calendarData.weeklySchedule.weekStartDate,
    weekEndDate: calendarData.weeklySchedule.weekEndDate,
    bigTasksCount: currentWeekBigTasks.length,
  })

  // 統一された週切り替え関数
  const goToPreviousWeek = () => setCurrentWeek(prev => subWeeks(prev, 1))
  const goToNextWeek = () => setCurrentWeek(prev => addWeeks(prev, 1))

  return (
    <div className="flex flex-1 flex-col">
      {/* Weekly Calendar - Always Visible */}
      <div className="h-[650px]">
          <WeeklyCalendar
            weeklySchedule={calendarData.weeklySchedule}
            onScheduleTask={calendarData.scheduleTask}
            onCreateTask={async data => {
              await calendarData.createSmallTask(data)
            }}
            onUpdateTask={async data => {
              await calendarData.updateSmallTask(data)
            }}
            onDeleteTask={async id => {
              await calendarData.deleteSmallTask(id)
            }}
            projects={calendarData.projects}
            bigTasks={currentWeekBigTasks}
            smallTasks={weekSmallTasks}
            userId={userId}
            weekStart={weekStart}
            onPreviousWeek={goToPreviousWeek}
            onNextWeek={goToNextWeek}
          />
      </div>

      {/* Task Memo */}
      <div className="border-t border-border">
        <TaskMemo
          value={localContent}
          onChange={handleContentChange}
          onSave={handleSave}
          isSaving={isSaving}
          error={error}
          isDirty={isDirty}
        />
      </div>
    </div>
  )
}
