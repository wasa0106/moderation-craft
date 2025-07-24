/**
 * WeeklySchedulePage - 週次スケジュール管理画面
 * 来週の計画を立てるためのページ（主に日曜日に使用）
 */

'use client'

import { useState, useMemo, useEffect } from 'react'
import { useWeeklySchedule } from '@/hooks/use-weekly-schedule'
import { useProjects } from '@/hooks/use-projects'
import { useBigTasks } from '@/hooks/use-big-tasks'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns'
import { ja } from 'date-fns/locale'
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
  const [memoContent, setMemoContent] = useState(() => {
    // localStorageから保存されたメモを読み込み
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('weeklyScheduleMemo')
      return saved || ''
    }
    return ''
  })

  // メモ保存ハンドラ
  const handleMemoSave = (content: string) => {
    setMemoContent(content)
    if (typeof window !== 'undefined') {
      localStorage.setItem('weeklyScheduleMemo', content)
    }
  }

  // Task Overview Table用のデータ
  const { projects } = useProjects(userId)
  const { bigTasks: allBigTasks } = useBigTasks(userId)

  // 週の開始日と終了日を計算
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 })

  // Weekly Calendar用のデータ
  const calendarData = useWeeklySchedule(userId, currentWeek)
  
  // デバッグ用ログ出力
  useEffect(() => {
    console.log('週が変更されました:', {
      currentWeek: format(currentWeek, 'yyyy-MM-dd'),
      weekStart: format(weekStart, 'yyyy-MM-dd'),
      weekEnd: format(weekEnd, 'yyyy-MM-dd')
    })
  }, [currentWeek, weekStart, weekEnd])

  // 現在の週に対応するBigTasksをフィルタリング
  const currentWeekBigTasks = useMemo(() => {
    // 存在するプロジェクトIDのセットを作成
    const existingProjectIds = new Set(projects.map(p => p.id))
    
    // weekStartとweekEndは既に上で計算済み
    
    console.log('ページ側: カレンダー週の変更', {
      currentWeek: format(currentWeek, 'yyyy-MM-dd'),
      weekStart: format(weekStart, 'yyyy-MM-dd'),
      weekEnd: format(weekEnd, 'yyyy-MM-dd'),
      全BigTasks数: allBigTasks.length,
      プロジェクト数: projects.length
    })
    
    // 全てのBigTaskをデバッグ出力
    console.log('BigTasksの詳細:', allBigTasks.map(task => ({
      name: task.name,
      project_id: task.project_id,
      week_start_date: task.week_start_date,
      week_end_date: task.week_end_date,
      week_number: task.week_number
    })))
    
    const filtered = allBigTasks.filter(task => {
      // 存在しないプロジェクトのタスクを除外
      if (!existingProjectIds.has(task.project_id)) {
        console.log('プロジェクトが存在しないタスク:', task.name, task.project_id)
        return false
      }
      
      // week_start_dateとweek_end_dateがある場合
      if (task.week_start_date && task.week_end_date) {
        const taskStart = new Date(task.week_start_date)
        const taskEnd = new Date(task.week_end_date)
        
        // タスクの期間が選択された週と重なっているかチェック
        const isInWeek = (
          (taskStart >= weekStart && taskStart <= weekEnd) ||
          (taskEnd >= weekStart && taskEnd <= weekEnd) ||
          (taskStart <= weekStart && taskEnd >= weekEnd)
        )
        
        if (isInWeek) {
          console.log('週に含まれるタスク:', task.name)
        }
        
        return isInWeek
      }
      
      console.log('日付情報がないタスク:', task.name)
      return false
    })
    
    console.log('フィルタリング結果:', filtered.length, '件')
    return filtered
  }, [allBigTasks, weekStart, weekEnd, projects, currentWeek])
  
  // デバッグ用：週が変更されたときのログ
  console.log('Week changed:', {
    currentWeek: format(currentWeek, 'yyyy-MM-dd'),
    weekStartDate: calendarData.weeklySchedule.weekStartDate,
    weekEndDate: calendarData.weeklySchedule.weekEndDate,
    allBigTasksCount: allBigTasks.length,
    filteredBigTasksCount: currentWeekBigTasks.length
  })

  // 統一された週切り替え関数
  const goToPreviousWeek = () => setCurrentWeek(prev => subWeeks(prev, 1))
  const goToNextWeek = () => setCurrentWeek(prev => addWeeks(prev, 1))


  return (
    <div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-6">
        <div className="space-y-6">

          {/* Weekly Calendar - Always Visible */}
          <Card className="bg-[#E5E3D2] border border-[#C9C7B6] shadow-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-[#C9C7B6]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#1C1C14] flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#3C6659]" />
                  週間カレンダー
                </h2>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={goToPreviousWeek}
                    variant="ghost"
                    size="sm"
                    className="text-[#47473B] hover:bg-[#D4D5C0]"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>

                  <span className="px-3 py-1 text-sm font-medium text-[#47473B]">
                    {format(weekStart, 'yyyy年M月d日(E)', { locale: ja })} ~ {format(weekEnd, 'M月d日(E)', { locale: ja })}
                  </span>

                  <Button
                    onClick={goToNextWeek}
                    variant="ghost"
                    size="sm"
                    className="text-[#47473B] hover:bg-[#D4D5C0]"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="h-[600px]">
              <WeeklyCalendar
                weeklySchedule={calendarData.weeklySchedule}
                onScheduleTask={calendarData.scheduleTask}
                onUnscheduleTask={calendarData.unscheduleTask}
                onCreateTask={calendarData.createSmallTask}
                onUpdateTask={calendarData.updateSmallTask}
                onDeleteTask={calendarData.deleteSmallTask}
                projects={calendarData.projects}
                bigTasks={currentWeekBigTasks}
                userId={userId}
              />
            </div>
          </Card>

          {/* Task Memo */}
          <Card className="bg-[#E5E3D2] border border-[#C9C7B6] shadow-lg overflow-hidden">
            <TaskMemo
              value={memoContent}
              onChange={handleMemoSave}
            />
          </Card>
        </div>
      </div>
    </div>
  )
}
