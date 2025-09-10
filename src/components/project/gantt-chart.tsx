/**
 * GanttChart - プロジェクトのタスクをガントチャート形式で表示
 */

'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Task, WeeklyAllocation, SchedulingResult } from '@/stores/project-creation-store'
import { BigTask } from '@/types'
import { format, eachDayOfInterval, differenceInDays, getDay, addDays } from 'date-fns'
import { ja } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { dateUtils } from '@/lib/utils/date-utils'
import { CheckCircle2, Clock, Square, CheckSquare } from 'lucide-react'
import { getHolidaysOfYear } from 'holiday-jp-since'
import { useSmallTasks } from '@/hooks/use-small-tasks'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

const CURRENT_USER_ID = 'current-user'

// 逐次スケジューラ用の型定義
type DayUsage = Map<number, number>

// ヘルパー関数: 日付キャッシュを必要に応じて延長
function ensureCapacityIndex(
  idx: number,
  startDate: Date,
  daysCache: Date[],
  getDailyCapacity: (d: Date) => number
): Date {
  while (idx >= daysCache.length) {
    const next = addDays(daysCache[daysCache.length - 1], 1)
    daysCache.push(next)
  }
  return daysCache[idx]
}

// ヘルパー関数: 次の利用可能な日を探す
function advanceToNextAvailableIndex(
  startIdx: number,
  daysCache: Date[],
  getDailyCapacity: (d: Date) => number,
  usage: DayUsage
): number {
  const from = Math.max(0, startIdx)
  for (let i = from; i < daysCache.length; i++) {
    const d = daysCache[i]
    const cap = getDailyCapacity(d)
    const used = usage.get(i) ?? 0
    if (cap - used > 0.0001) return i
  }
  return daysCache.length - 1
}

// 逐次スケジューラ本体
function scheduleSequentially(
  source: GanttTask[],
  startDate: Date,
  endDate: Date,
  daysCache: Date[], // 既存 useMemo の days をコピーして渡す。必要なら延長される
  getDailyCapacity: (d: Date) => number,
  initialUsage?: DayUsage,   // カテゴリ外の固定分などを seed
): { tasks: GanttTask[], lastDayIndex: number } {
  const tasks = [...source].sort((a, b) => a.order - b.order)

  // 初期使用量をベースにする（カテゴリ外を固定として先に埋める想定）
  const usage: DayUsage = new Map(initialUsage ? Array.from(initialUsage.entries()) : [])

  let cursor = 0
  let globalLastIdx = 0
  const scheduled: GanttTask[] = []

  for (const t of tasks) {
    let remaining = Math.max(0, t.estimatedHours ?? 0)
    const daily = new Map<number, number>()

    const minStartRaw = Math.max(cursor, differenceInDays(t.actual_start_date, startDate))
    let di = Math.max(0, minStartRaw)
    let firstIdx: number | null = null
    let lastIdx: number | null = null

    while (remaining > 0.0001) {
      const dateAtIndex = ensureCapacityIndex(di, startDate, daysCache, getDailyCapacity)
      const cap = getDailyCapacity(dateAtIndex)
      const used = usage.get(di) ?? 0
      const free = Math.max(0, cap - used)

      if (free > 0.0001) {
        const put = Math.min(free, remaining)
        daily.set(di, (daily.get(di) ?? 0) + put)
        usage.set(di, used + put)
        remaining -= put
        if (firstIdx === null) firstIdx = di
        lastIdx = di
      }

      di += 1
      if (firstIdx !== null) {
        cursor = Math.max(cursor, firstIdx)
      }
    }

    const startIdx = Math.max(0, firstIdx ?? di)
    const endIdx = Math.max(startIdx, lastIdx ?? startIdx)
    globalLastIdx = Math.max(globalLastIdx, endIdx)

    scheduled.push({
      ...t,
      dailyHours: daily,
      date_start: startIdx,
      date_end: endIdx,
      actual_start_date: addDays(startDate, startIdx),
      actual_end_date: addDays(startDate, endIdx),
    })

    cursor = advanceToNextAvailableIndex(cursor, daysCache, getDailyCapacity, usage)
  }

  return { tasks: scheduled, lastDayIndex: globalLastIdx }
}

export interface GanttTask extends Task {
  date_start: number // 日付インデックス（プロジェクト開始日からの日数）
  date_end: number   // 日付インデックス（プロジェクト開始日からの日数）
  actual_start_date: Date // 実際の開始日
  actual_end_date: Date   // 実際の終了日
  dailyHours: Map<number, number> // 日ごとの実際の配分時間
}

interface GanttChartProps {
  // 既存のprops（後方互換性）
  tasks?: Task[]
  weeklyAvailableHours?: number // 非推奨、後方互換性のためオプショナルに
  weeklyAllocations?: WeeklyAllocation[] // 非推奨、後方互換性のためオプショナルに
  onTaskUpdate?: (taskId: string, weekStart: number, weekEnd: number) => void

  // 新しいprops（BigTasksベース）
  bigTasks?: BigTask[]

  // 共通props
  startDate: Date
  endDate: Date
  totalTaskHours: number
  totalAvailableHours: number

  // プロジェクト作業設定（日付単位表示用）
  workableWeekdays?: boolean[] // [月,火,水,木,金,土,日]の7要素配列
  weekdayHours?: number[] // [月,火,水,木,金,土,日]の各曜日の作業時間（7要素配列）
  excludeHolidays?: boolean // 祝日を作業不可日とするか
  holidayWorkHours?: number // 祝日に作業する場合の時間

  // 日付変更用のコールバック
  onTaskDateUpdate?: (taskId: string, startDate: Date, endDate: Date) => void

  // 容量超過警告の表示制御（デフォルト: false）
  showCapacityWarnings?: boolean

  // BigTaskステータス変更（新規追加）
  allowStatusChange?: boolean // デフォルト: false
  onBigTaskStatusUpdate?: (taskId: string, status: 'completed' | 'active') => void

  // 時間編集用のコールバック
  onBigTaskHoursUpdate?: (taskId: string, estimatedHours: number) => void
  onTaskHoursUpdate?: (taskId: string, estimatedHours: number) => void // 旧Task用（任意）
  
  // FlowWork/RecurringWork統合表示
  schedulingResult?: SchedulingResult | null
  showLayers?: boolean
  // 日付更新用のコールバック（時間変更による再配置時）
  onBigTaskDateUpdate?: (taskId: string, startDate: Date, endDate: Date) => void
  
  // 連鎖再配置のスコープ（デフォルト: 'category'）
  reflowScope?: 'category' | 'all' | 'none'
}

export function GanttChart({
  tasks,
  bigTasks,
  startDate,
  endDate,
  weeklyAvailableHours,
  weeklyAllocations,
  onTaskUpdate,
  onTaskDateUpdate,
  totalTaskHours,
  totalAvailableHours,
  workableWeekdays = [true, true, true, true, true, false, false], // デフォルト: 月-金
  weekdayHours = [8, 8, 8, 8, 8, 0, 0], // デフォルト: 平日8時間、土日休み
  excludeHolidays = true,
  holidayWorkHours = 0,
  showCapacityWarnings = false, // デフォルト: 警告非表示
  allowStatusChange = false, // デフォルト: ステータス変更不可
  onBigTaskStatusUpdate,
  onBigTaskHoursUpdate,
  onTaskHoursUpdate,
  onBigTaskDateUpdate,
  reflowScope = 'category', // デフォルト: カテゴリ内で連鎖再配置
  schedulingResult,
  showLayers = false,
}: GanttChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [ganttTasks, setGanttTasks] = useState<GanttTask[]>([])
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<'start' | 'end' | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [taskStatuses, setTaskStatuses] = useState<Map<string, 'completed' | 'active'>>(new Map())
  const [editingHoursTaskId, setEditingHoursTaskId] = useState<string | null>(null)
  const [tempHours, setTempHours] = useState<string>('') // 入力中の値（文字列）
  
  // SmallTasksを取得（選択されたBigTaskがある場合のみ）
  const { smallTasks } = useSmallTasks(CURRENT_USER_ID, selectedTaskId || undefined)

  // 祝日データのキャッシュ（年ごと）
  const holidayCache = useRef<Map<number, Array<{ date: Date; name: string }>>>(new Map())
  
  const getHolidaysForYear = useCallback((year: number) => {
    if (!holidayCache.current.has(year)) {
      const holidays = getHolidaysOfYear(year)
      // holiday-jp-sinceの形式をDateオブジェクトに変換
      const formattedHolidays = holidays.map(h => ({
        date: new Date(year, h.month - 1, h.day), // monthは0-indexed
        name: h.name
      }))
      holidayCache.current.set(year, formattedHolidays)
    }
    return holidayCache.current.get(year)!
  }, [])

  // プロジェクト終了日の日付インデックスを計算
  const projectEndDayIndex = useMemo(() => {
    return differenceInDays(endDate, startDate)
  }, [endDate, startDate])

  // 実際に必要な日数を計算（タスクが完了するまで）
  const actualTotalDays = useMemo(() => {
    const projectDays = differenceInDays(endDate, startDate) + 1

    if (ganttTasks.length === 0) {
      return Math.max(1, projectDays)
    }
    // 最後のタスクの終了日を取得
    const maxDateEnd = Math.max(...ganttTasks.map(task => task.date_end))
    return Math.max(maxDateEnd + 1, projectDays)
  }, [ganttTasks, endDate, startDate])

  // 日付の計算
  const days = useMemo(() => {
    const endDay = addDays(startDate, actualTotalDays - 1)
    return eachDayOfInterval({ start: startDate, end: endDay })
  }, [startDate, actualTotalDays])

  // 月ごとのグループ化情報を計算
  const monthGroups = useMemo(() => {
    const groups: { month: string; startIndex: number; count: number }[] = []
    let currentMonth = ''
    let currentStartIndex = 0
    let currentCount = 0

    days.forEach((day, index) => {
      const monthStr = format(day, 'M月', { locale: ja })
      if (monthStr !== currentMonth) {
        if (currentMonth) {
          groups.push({ month: currentMonth, startIndex: currentStartIndex, count: currentCount })
        }
        currentMonth = monthStr
        currentStartIndex = index
        currentCount = 1
      } else {
        currentCount++
      }
    })

    if (currentMonth) {
      groups.push({ month: currentMonth, startIndex: currentStartIndex, count: currentCount })
    }

    return groups
  }, [days])

  // 曜日の1文字表記を取得
  const getDayOfWeekChar = (date: Date): string => {
    const dayChars = ['日', '月', '火', '水', '木', '金', '土']
    return dayChars[getDay(date)]
  }

  // 日付ごとの作業可能時間を計算
  const getDailyCapacity = useCallback((date: Date): number => {
    // 祝日判定
    const holidays = getHolidaysForYear(date.getFullYear())
    const dateStr = format(date, 'yyyy-MM-dd')
    const isHoliday = holidays.some(h => 
      format(h.date, 'yyyy-MM-dd') === dateStr
    )
    
    if (isHoliday) {
      if (excludeHolidays) {
        return 0 // 祝日を作業不可日とする場合は0
      } else {
        return holidayWorkHours // 祝日でも作業する場合はholidayWorkHours
      }
    }
    
    const dayOfWeek = getDay(date) // 0=日, 1=月...6=土
    
    // weekdayHoursの配列インデックスに変換
    // [月,火,水,木,金,土,日] なので
    const weekdayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    
    if (!weekdayHours || !workableWeekdays || !workableWeekdays[weekdayIndex]) {
      return 0
    }
    
    // 各曜日の設定時間を返す
    return weekdayHours[weekdayIndex]
  }, [workableWeekdays, weekdayHours, excludeHolidays, holidayWorkHours, getHolidaysForYear])


  // 時間変更の確定処理（逐次スケジューラ使用）
  const commitHoursChange = useCallback((taskId: string, newHoursNum: number) => {
    setGanttTasks(prev => {
      const edited = prev.map(t => t.id === taskId ? { ...t, estimatedHours: newHoursNum } : t)

      // スコープ決定
      let targetIds: string[]
      if (reflowScope === 'none') {
        targetIds = [taskId]
      } else if (reflowScope === 'category') {
        const cat = edited.find(t => t.id === taskId)?.category || 'その他'
        targetIds = edited.filter(t => (t.category || 'その他') === cat).map(t => t.id)
      } else {
        targetIds = edited.map(t => t.id) // 'all'
      }

      // スコープ外の "固定" 使用量を seed（同日の残キャパを正しく差し引く）
      const baseline: Map<number, number> = new Map()
      edited
        .filter(t => !targetIds.includes(t.id))
        .forEach(t => {
          t.dailyHours.forEach((h, di) => {
            baseline.set(di, (baseline.get(di) ?? 0) + h)
          })
        })

      const scoped = edited
        .filter(t => targetIds.includes(t.id))
        .sort((a, b) => a.order - b.order)

      const daysCache = [...days]
      const { tasks: rescheduled } = scheduleSequentially(
        scoped,
        startDate,
        endDate,
        daysCache,
        getDailyCapacity,
        baseline, // カテゴリ外を固定化
      )

      // マージ
      const mapById = new Map(rescheduled.map(t => [t.id, t] as const))
      const merged = edited.map(t => mapById.get(t.id) ?? t)

      // 既存コールバック
      if (bigTasks && bigTasks.length > 0 && onBigTaskHoursUpdate) onBigTaskHoursUpdate(taskId, newHoursNum)
      else if (!bigTasks && onTaskHoursUpdate) onTaskHoursUpdate(taskId, newHoursNum)

      if (onBigTaskDateUpdate && bigTasks && bigTasks.length > 0) {
        for (const t of rescheduled) onBigTaskDateUpdate(t.id, t.actual_start_date, t.actual_end_date)
      } else if (onTaskDateUpdate) {
        for (const t of rescheduled) onTaskDateUpdate(t.id, t.actual_start_date, t.actual_end_date)
      }

      return merged
    })

    setEditingHoursTaskId(null)
    setTempHours('')
  }, [bigTasks, days, endDate, getDailyCapacity, onBigTaskDateUpdate, onBigTaskHoursUpdate, onTaskDateUpdate, onTaskHoursUpdate, reflowScope, startDate])

  // タスクの日付変更ハンドラー
  const handleTaskDateChange = useCallback((taskId: string, type: 'start' | 'end', value: string) => {
    const newDate = new Date(value)

    setGanttTasks(prevTasks => {
      return prevTasks.map(task => {
        if (task.id !== taskId) return task

        const updatedTask = { ...task }

        if (type === 'start') {
          updatedTask.actual_start_date = newDate
          updatedTask.date_start = differenceInDays(newDate, startDate)

          // 開始日が終了日より後の場合、終了日も調整
          if (newDate > task.actual_end_date) {
            updatedTask.actual_end_date = newDate
            updatedTask.date_end = updatedTask.date_start
          }
        } else {
          updatedTask.actual_end_date = newDate
          updatedTask.date_end = differenceInDays(newDate, startDate)

          // 終了日が開始日より前の場合、開始日も調整
          if (newDate < task.actual_start_date) {
            updatedTask.actual_start_date = newDate
            updatedTask.date_start = updatedTask.date_end
          }
        }

        // 親コンポーネントに変更を通知
        if (onTaskDateUpdate) {
          onTaskDateUpdate(taskId, updatedTask.actual_start_date, updatedTask.actual_end_date)
        }

        return updatedTask
      })
    })
  }, [startDate, onTaskDateUpdate])

  // 平日/休日判定ヘルパー
  const isWeekend = useCallback((date: Date): boolean => {
    const day = getDay(date)
    return day === 0 || day === 6 // 日曜日(0)または土曜日(6)
  }, [])
  
  // 祝日判定ヘルパー
  const getHolidayName = useCallback((date: Date): string | null => {
    if (!excludeHolidays) return null
    
    const holidays = getHolidaysForYear(date.getFullYear())
    const dateStr = format(date, 'yyyy-MM-dd')
    const holiday = holidays.find(h => 
      format(h.date, 'yyyy-MM-dd') === dateStr
    )
    
    return holiday ? holiday.name : null
  }, [excludeHolidays, getHolidaysForYear])

  // カテゴリごとにタスクをグループ化（order順を維持）
  const tasksByCategory = useMemo(() => {
    // まずorder順でソート
    const sortedTasks = [...ganttTasks].sort((a, b) => a.order - b.order)

    // カテゴリの最初の出現順序を記録
    const categoryFirstAppearance = new Map<string, number>()
    sortedTasks.forEach((task, index) => {
      const category = task.category || 'その他'
      if (!categoryFirstAppearance.has(category)) {
        categoryFirstAppearance.set(category, index)
      }
    })

    // カテゴリごとにグループ化
    const grouped = new Map<string, GanttTask[]>()
    sortedTasks.forEach(task => {
      const category = task.category || 'その他'
      if (!grouped.has(category)) {
        grouped.set(category, [])
      }
      grouped.get(category)!.push(task)
    })

    // カテゴリの初出順でソート（EditableTaskTableの順序を維持）
    // 「その他」カテゴリは除外
    return Array.from(grouped.entries())
      .filter(([category]) => category !== 'その他')
      .sort(
        ([a], [b]) => categoryFirstAppearance.get(a)! - categoryFirstAppearance.get(b)!
      )
  }, [ganttTasks])

  // タスクの自動配置
  useEffect(() => {
    // useEffect内でのインライン関数（無限ループ防止）
    const getCapacity = (date: Date): number => {
      // 祝日判定
      const year = date.getFullYear()
      // 祝日データを直接取得
      if (!holidayCache.current.has(year)) {
        const holidays = getHolidaysOfYear(year)
        const formattedHolidays = holidays.map(h => ({
          date: new Date(year, h.month - 1, h.day),
          name: h.name
        }))
        holidayCache.current.set(year, formattedHolidays)
      }
      const holidays = holidayCache.current.get(year)!
      
      const dateStr = format(date, 'yyyy-MM-dd')
      const isHoliday = holidays.some(h => 
        format(h.date, 'yyyy-MM-dd') === dateStr
      )
      
      if (isHoliday) {
        if (excludeHolidays) {
          return 0 // 祝日を作業不可日とする場合は0
        } else {
          return holidayWorkHours // 祝日でも作業する場合はholidayWorkHours
        }
      }
      
      const dayOfWeek = getDay(date)
      const weekdayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      
      if (!workableWeekdays || !workableWeekdays[weekdayIndex]) {
        return 0
      }
      
      // 各曜日の設定時間を返す
      if (!weekdayHours) {
        return 0
      }
      return weekdayHours[weekdayIndex]
    }

    // BigTasksベースの新しい実装（逐次スケジューラを使用）
    if (bigTasks && bigTasks.length > 0) {
      const seed: GanttTask[] = bigTasks
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((bt, index) => {
          const s = dateUtils.toJSTDate(bt.start_date)
          const e = dateUtils.toJSTDate(bt.end_date)
          return {
            id: bt.id,
            name: bt.name,
            category: bt.category || 'その他',
            estimatedHours: bt.estimated_hours,
            order: bt.order ?? index,
            date_start: Math.max(0, differenceInDays(s, startDate)),
            date_end: Math.max(0, differenceInDays(e, startDate)),
            actual_start_date: s,
            actual_end_date: e,
            dailyHours: new Map(),
          } as GanttTask
        })

      const daysCache = [...days] // ヘッダ days をコピー（必要に応じて延長可）

      const { tasks: scheduled } = scheduleSequentially(
        seed,
        startDate,
        endDate,
        daysCache,
        getCapacity,
      )

      setGanttTasks(scheduled)
      
      // BigTaskのステータスを初期化
      const statusMap = new Map<string, 'completed' | 'active'>()
      bigTasks.forEach(bigTask => {
        statusMap.set(bigTask.id, bigTask.status === 'completed' ? 'completed' : 'active')
      })
      setTaskStatuses(statusMap)
      
      return
    }

    // 既存のtasksベースの実装（後方互換性） - 日付単位に変換
    if (!tasks || tasks.length === 0) {
      setGanttTasks([])
      return
    }

    const allocated: GanttTask[] = []
    const dayHours: Map<number, number> = new Map()

    const sortedTasks = [...tasks].sort((a, b) => a.order - b.order)

    // プロジェクト期間を計算（actualTotalDaysの代わりに直接計算）
    const projectDays = differenceInDays(endDate, startDate) + 1
    const avgHoursPerDay = weekdayHours ? weekdayHours.reduce((sum, h) => sum + h, 0) / weekdayHours.filter(h => h > 0).length : 8
    const estimatedDaysNeeded = Math.ceil(sortedTasks.reduce((sum, task) => sum + task.estimatedHours, 0) / avgHoursPerDay) * 2 // 概算で2倍の余裕を持たせる
    const totalDaysForAllocation = Math.max(projectDays, estimatedDaysNeeded)

    sortedTasks.forEach(task => {
      let bestDay = 0
      let minUsage = Infinity

      // 最も空いている日を探す
      for (let d = 0; d < totalDaysForAllocation; d++) {
        const currentDate = addDays(startDate, d)
        const capacity = getCapacity(currentDate)
        if (capacity > 0) {
          const currentHours = dayHours.get(d) || 0
          if (currentHours < minUsage) {
            minUsage = currentHours
            bestDay = d
          }
        }
      }

      // タスクの日数を計算（作業可能日のみ）
      let remainingHours = task.estimatedHours
      const taskDailyHours = new Map<number, number>()
      let currentDay = bestDay
      const taskStartDay = bestDay
      let taskEndDay = bestDay

      while (remainingHours > 0 && currentDay < totalDaysForAllocation) {
        const currentDate = addDays(startDate, currentDay)
        const capacity = getCapacity(currentDate)

        if (capacity > 0) {
          const currentUsage = dayHours.get(currentDay) || 0
          const availableHours = Math.max(0, capacity - currentUsage)
          const hoursToAllocate = Math.min(remainingHours, availableHours)

          if (hoursToAllocate > 0) {
            dayHours.set(currentDay, currentUsage + hoursToAllocate)
            taskDailyHours.set(currentDay, hoursToAllocate)
            remainingHours -= hoursToAllocate
            taskEndDay = currentDay
          }
        }

        currentDay++
      }

      allocated.push({
        ...task,
        date_start: taskStartDay,
        date_end: taskEndDay,
        actual_start_date: addDays(startDate, taskStartDay),
        actual_end_date: addDays(startDate, taskEndDay),
        dailyHours: taskDailyHours,
      })

      // 全てのタスクを配置できなかった場合の処理
      if (remainingHours > 0) {
        console.warn(`タスク「${task.name}」の${remainingHours}時間分が配置できませんでした`)
      }
    })

    setGanttTasks(allocated)
  }, [tasks, bigTasks, weeklyAllocations, weeklyAvailableHours, startDate, endDate, workableWeekdays, weekdayHours, excludeHolidays, holidayWorkHours, days])

  // 日ごとの作業時間を計算（実際の配分に基づく）
  const dailyWorkload = useMemo(() => {
    const workload = new Array(actualTotalDays).fill(0)

    ganttTasks.forEach(task => {
      // タスクのdailyHoursから実際の配分を取得
      task.dailyHours.forEach((hours, dayIndex) => {
        if (dayIndex < actualTotalDays) {
          workload[dayIndex] += hours
        }
      })
    })

    return workload
  }, [ganttTasks, actualTotalDays])

  if ((!tasks && !bigTasks) || (tasks?.length === 0 && bigTasks?.length === 0)) {
    return null
  }

  return (
    <div className="w-full max-w-full md:max-w-[calc(100vw-18rem)] overflow-hidden">
      <div className="border rounded-lg overflow-hidden">
        <div className="relative z-0 overflow-x-auto max-h-[80vh] scrollbar-thin scrollbar-thumb-border scrollbar-track-muted" ref={containerRef}>
          <table className="border-collapse" style={{ minWidth: `${328 + days.length * 40}px` }}>
            <thead>
              {/* 月の行 */}
              <tr className="bg-muted">
                <th rowSpan={4} className="sticky left-0 z-[5] bg-muted border-r border-b px-2 py-2 text-left text-xs font-medium" style={{ width: '160px', minWidth: '160px', maxWidth: '160px' }}>
                  タスク名
                </th>
                <th rowSpan={4} className="sticky z-[5] bg-muted border-r border-b px-2 py-2 text-center text-xs font-medium" style={{ left: '160px', width: '60px' }}>
                  開始日
                </th>
                <th rowSpan={4} className="sticky z-[5] bg-muted border-r border-b px-2 py-2 text-center text-xs font-medium" style={{ left: '220px', width: '60px' }}>
                  終了日
                </th>
                <th rowSpan={4} className="sticky z-[5] bg-muted border-r border-b px-2 py-2 text-center text-xs font-medium" style={{ left: '280px', width: '48px' }}>
                  時間
                </th>
                {monthGroups.map((group, i) => (
                  <th
                    key={`month-${i}`}
                    colSpan={group.count}
                    className="border-r border-b px-1 py-1 text-center text-xs font-semibold text-foreground bg-muted/80"
                  >
                    {group.month}
                  </th>
                ))}
              </tr>
              {/* 日付の行 */}
              <tr className="bg-muted">
                {days.map((day, i) => (
                  <th
                    key={`day-${i}`}
                    className="border-r border-b px-1 py-1 text-center text-xs font-semibold text-foreground"
                    style={{ minWidth: '40px', width: '40px' }}
                  >
                    {format(day, 'd')}
                  </th>
                ))}
              </tr>
              {/* 曜日の行 */}
              <tr className="bg-muted">
                {days.map((day, i) => {
                  const dayCapacity = getDailyCapacity(day)
                  const dayChar = getDayOfWeekChar(day)
                  const isWeekendDay = isWeekend(day)
                  const holidayName = getHolidayName(day)
                  return (
                    <th
                      key={`weekday-${i}`}
                      className={cn(
                        "border-r border-b px-1 py-1 text-center text-xs font-medium relative",
                        holidayName ? "text-red-600" :                  // 1. 祝日は常に赤文字
                        dayCapacity === 0 ? "text-muted-foreground" :  // 2. 作業しない日：グレー文字
                        isWeekendDay ? "text-red-600" :                 // 3. 作業する週末：赤文字
                        "text-blue-600"                                 // 4. 作業する平日：青文字
                      )}
                      style={{ minWidth: '40px', width: '40px' }}
                      title={holidayName || undefined}
                    >
                      <div>{dayChar}</div>
                    </th>
                  )
                })}
              </tr>
              {/* 作業可能時間の行 */}
              <tr className="bg-muted">
                {days.map((day, i) => {
                  const dayCapacity = getDailyCapacity(day)
                  const holidayName = getHolidayName(day)
                  const isWeekendDay = isWeekend(day)
                  return (
                    <th
                      key={`capacity-${i}`}
                      className={cn(
                        "border-r border-b px-1 py-1 text-center text-[10px] font-normal",
                        holidayName ? "text-red-600" :                // 祝日は赤文字
                        dayCapacity === 0 ? "text-muted-foreground" : // 作業しない日はグレー
                        isWeekendDay ? "text-red-600" :               // 週末は赤文字
                        "text-blue-600"                               // 平日は青文字
                      )}
                      style={{ minWidth: '40px', width: '40px' }}
                    >
                      {dayCapacity > 0 ? `${dayCapacity}h` : '-'}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {tasksByCategory.map(([category, categoryTasks]) => (
                <React.Fragment key={`category-group-${category}`}>
                  {/* カテゴリ行 */}
                  <tr key={`category-${category}`} className="bg-muted">
                    <td className="sticky left-0 z-[2] bg-muted border-r px-2 py-1 text-xs font-semibold text-foreground/70 shadow-sm break-words whitespace-normal" style={{ width: '160px', minWidth: '160px', maxWidth: '160px' }}>
                      {category}
                    </td>
                    <td className="sticky z-[2] bg-muted border-r px-2 py-1 text-center text-xs shadow-sm" style={{ left: '160px', width: '60px' }}>
                      {/* 開始日列は空欄 */}
                    </td>
                    <td className="sticky z-[2] bg-muted border-r px-2 py-1 text-center text-xs shadow-sm" style={{ left: '220px', width: '60px' }}>
                      {/* 終了日列は空欄 */}
                    </td>
                    <td className="sticky z-[2] bg-muted border-r px-2 py-1 text-center text-xs shadow-sm" style={{ left: '280px', width: '48px' }}>
                      {/* 時間列は空欄 */}
                    </td>
                    {days.map((_, dayIndex) => (
                      <td
                        key={`category-${category}-day-${dayIndex}`}
                        className="bg-muted border-r h-8"
                        style={{ minWidth: '40px', width: '40px' }}
                      >
                        {/* ガントバーは表示しない */}
                      </td>
                    ))}
                  </tr>
                  {/* タスク行 */}
                  {categoryTasks.map(task => (
                    <tr key={`task-${task.id}`} className="border-b hover:bg-accent">
                      <td className="sticky left-0 z-[2] bg-background border-r px-2 py-1 text-xs shadow-sm break-words whitespace-normal" style={{ width: '160px', minWidth: '160px', maxWidth: '160px' }}>
                        {bigTasks && bigTasks.length > 0 ? (
                          <div className="flex items-center gap-2">
                            {/* ステータスチェックボックス（allowStatusChangeがtrueの場合のみ表示） */}
                            {allowStatusChange && (
                              <button
                                onClick={() => {
                                  const currentStatus = taskStatuses.get(task.id) || 'active'
                                  const newStatus = currentStatus === 'completed' ? 'active' : 'completed'
                                  setTaskStatuses(prev => {
                                    const newMap = new Map(prev)
                                    newMap.set(task.id, newStatus)
                                    return newMap
                                  })
                                  if (onBigTaskStatusUpdate) {
                                    onBigTaskStatusUpdate(task.id, newStatus)
                                  }
                                }}
                                className="flex-shrink-0"
                              >
                                {taskStatuses.get(task.id) === 'completed' ? (
                                  <CheckSquare className="h-4 w-4 text-gray-600" />
                                ) : (
                                  <Square className="h-4 w-4 text-muted-foreground" />
                                )}
                              </button>
                            )}
                            <Popover open={popoverOpen && selectedTaskId === task.id} onOpenChange={(open) => {
                              setPopoverOpen(open)
                              if (open) {
                                setSelectedTaskId(task.id)
                              }
                            }}>
                              <PopoverTrigger asChild>
                                <button
                                  className={cn(
                                    "text-left w-full hover:text-primary cursor-pointer flex items-center gap-1",
                                    taskStatuses.get(task.id) === 'completed' && "line-through opacity-70"
                                  )}
                                  onClick={() => {
                                    setSelectedTaskId(task.id)
                                    setPopoverOpen(true)
                                  }}
                                >
                                  <span>{task.name}</span>
                                  {taskStatuses.get(task.id) === 'completed' && (
                                    <CheckCircle2 className="h-3 w-3 text-gray-600 ml-1" />
                                  )}
                                </button>
                              </PopoverTrigger>
                            <PopoverContent className="w-80" align="start">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 pb-2 border-b">
                                  <h4 className="font-medium text-sm">{task.name}</h4>
                                  <span className="text-xs text-muted-foreground">({smallTasks?.length || 0} タスク)</span>
                                </div>
                                {smallTasks && smallTasks.length > 0 ? (
                                  <div className="space-y-1 max-h-[300px] overflow-y-auto">
                                    {smallTasks.map((smallTask) => {
                                      const isCompleted = smallTask.status === 'completed' || (smallTask.actual_minutes && smallTask.actual_minutes > 0)
                                      return (
                                        <div
                                          key={smallTask.id}
                                          className={cn(
                                            "flex items-start gap-2 p-2 rounded-md hover:bg-accent/50 transition-colors",
                                            isCompleted && "opacity-60"
                                          )}
                                        >
                                          <div className="mt-0.5">
                                            {isCompleted ? (
                                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                                            ) : (
                                              <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                                            )}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className={cn(
                                              "text-sm",
                                              isCompleted && "line-through text-muted-foreground"
                                            )}>
                                              {smallTask.name}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1">
                                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                予定: {smallTask.estimated_minutes}分
                                              </span>
                                              {smallTask.actual_minutes && (
                                                <span className="text-xs text-muted-foreground">
                                                  実績: {smallTask.actual_minutes}分
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground py-4 text-center">
                                    まだ小タスクがありません
                                  </p>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                          </div>
                        ) : (
                          <span className="pl-2 block">{task.name}</span>
                        )}
                      </td>
                      <td className="sticky z-[2] bg-background border-r px-1 py-1 text-center text-xs shadow-sm" style={{ left: '160px', width: '60px' }}>
                        {editingTaskId === task.id && editingField === 'start' ? (
                          <input
                            type="date"
                            value={format(task.actual_start_date, 'yyyy-MM-dd')}
                            onChange={(e) => handleTaskDateChange(task.id, 'start', e.target.value)}
                            onBlur={() => { setEditingTaskId(null); setEditingField(null); }}
                            className="w-full px-1 py-0.5 bg-transparent border border-border rounded text-center text-[10px] focus:outline-none focus:ring-1 focus:ring-primary"
                            autoFocus
                          />
                        ) : (
                          <div
                            className="cursor-pointer hover:bg-accent rounded px-1 py-0.5"
                            onClick={() => { setEditingTaskId(task.id); setEditingField('start'); }}
                          >
                            {format(task.actual_start_date, 'MM/dd')}
                          </div>
                        )}
                      </td>
                      <td className="sticky z-[2] bg-background border-r px-1 py-1 text-center text-xs shadow-sm" style={{ left: '220px', width: '60px' }}>
                        {editingTaskId === task.id && editingField === 'end' ? (
                          <input
                            type="date"
                            value={format(task.actual_end_date, 'yyyy-MM-dd')}
                            onChange={(e) => handleTaskDateChange(task.id, 'end', e.target.value)}
                            onBlur={() => { setEditingTaskId(null); setEditingField(null); }}
                            className="w-full px-1 py-0.5 bg-transparent border border-border rounded text-center text-[10px] focus:outline-none focus:ring-1 focus:ring-primary"
                            autoFocus
                          />
                        ) : (
                          <div
                            className="cursor-pointer hover:bg-accent rounded px-1 py-0.5"
                            onClick={() => { setEditingTaskId(task.id); setEditingField('end'); }}
                          >
                            {format(task.actual_end_date, 'MM/dd')}
                          </div>
                        )}
                      </td>
                      <td className="sticky z-[2] bg-background border-r px-1 py-1 text-center text-xs shadow-sm" style={{ left: '280px', width: '48px' }}>
                        {editingHoursTaskId === task.id ? (
                          <input
                            type="number"
                            min={0}
                            step={0.25}
                            value={tempHours}
                            onChange={(e) => setTempHours(e.target.value)}
                            onBlur={() => {
                              const v = Number(tempHours)
                              if (!Number.isFinite(v) || v < 0) {
                                setEditingHoursTaskId(null)
                                setTempHours('')
                                return
                              }
                              commitHoursChange(task.id, v)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const v = Number(tempHours)
                                if (!Number.isFinite(v) || v < 0) return
                                commitHoursChange(task.id, v)
                              } else if (e.key === 'Escape') {
                                setEditingHoursTaskId(null)
                                setTempHours('')
                              }
                            }}
                            className="w-full px-1 py-0.5 bg-transparent border border-border rounded text-center text-[10px] focus:outline-none focus:ring-1 focus:ring-primary"
                            autoFocus
                          />
                        ) : (
                          <div
                            className="cursor-pointer hover:bg-accent rounded px-1 py-0.5"
                            title="クリックで予定工数を編集"
                            onClick={() => {
                              setEditingHoursTaskId(task.id)
                              setTempHours(String(task.estimatedHours ?? 0))
                            }}
                          >
                            {task.estimatedHours ?? 0}
                          </div>
                        )}
                      </td>
                      {days.map((day, dayIndex) => {
                        const isInRange = dayIndex >= task.date_start && dayIndex <= task.date_end
                        const isStart = dayIndex === task.date_start
                        const isEnd = dayIndex === task.date_end
                        const dayCapacity = getDailyCapacity(day)
                        const isOverCapacity = showCapacityWarnings && dayCapacity > 0 && (dailyWorkload[dayIndex] - dayCapacity) > 0.1
                        const isAfterProjectEnd = dayIndex > projectEndDayIndex

                        return (
                          <td
                            key={`task-${task.id}-day-${dayIndex}`}
                            className={cn(
                              'relative border-r h-10',
                              isOverCapacity && 'bg-destructive/10',
                              isAfterProjectEnd && isInRange && 'bg-warning/10',
                              dayCapacity === 0 && 'bg-muted/50' // 非作業日は薄いグレー背景
                            )}
                            style={{ minWidth: '40px', width: '40px' }}
                          >
                            {isInRange && (
                              <div
                                className={cn(
                                  'absolute inset-y-1',
                                  // タスクタイプによって表示を変える
                                  task.task_type === 'recurring' 
                                    ? 'bg-amber-500 opacity-50 border-2 border-dashed border-amber-600' // 定期タスクは点線表示
                                    : totalTaskHours > totalAvailableHours && isAfterProjectEnd
                                    ? 'bg-red-500'
                                    : taskStatuses.get(task.id) === 'completed'
                                    ? 'bg-gray-400' // 完了タスクはグレー
                                    : 'bg-primary', // 未完了タスクは青色
                                  isStart && 'rounded-l',
                                  isEnd && 'rounded-r',
                                  taskStatuses.get(task.id) === 'completed' && 'opacity-80' // 完了タスクは少し透明に
                                )}
                                style={{
                                  left: isStart ? '4px' : '0',
                                  right: isEnd ? '4px' : '0',
                                }}
                              />
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FlowWork/RecurringWorkレイヤー表示 */}
      {showLayers && schedulingResult && (
        <div className="mt-6 p-4 border rounded-lg">
          <h3 className="text-sm font-medium mb-3">統合スケジュール</h3>
          
          {/* レイヤー説明 */}
          <div className="flex items-center gap-4 mb-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded" />
              <span>フロー作業</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 opacity-80 rounded" />
              <span>固定作業（動かせない）</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 opacity-60 border-2 border-dashed border-green-600 rounded" />
              <span>調整可能作業</span>
            </div>
          </div>
          
          {/* 統計情報 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-xs">
              <span className="text-muted-foreground">フロー作業:</span>
              <span className="ml-1 font-medium">{schedulingResult.stats.totalFlowHours.toFixed(1)}h</span>
            </div>
            <div className="text-xs">
              <span className="text-muted-foreground">定期作業:</span>
              <span className="ml-1 font-medium">{schedulingResult.stats.totalRecurringHours.toFixed(1)}h</span>
            </div>
            <div className="text-xs">
              <span className="text-muted-foreground">利用率:</span>
              <span className="ml-1 font-medium">{schedulingResult.stats.utilizationRate.toFixed(1)}%</span>
            </div>
            <div className="text-xs">
              <span className="text-muted-foreground">未配置:</span>
              <span className="ml-1 font-medium text-orange-600">{schedulingResult.unplaced.length}件</span>
            </div>
          </div>
          
          {/* 未配置作業の警告 */}
          {schedulingResult.unplaced.length > 0 && (
            <div className="p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg mb-4">
              <p className="text-xs font-medium text-orange-800 dark:text-orange-200 mb-1">
                未配置の調整可能作業
              </p>
              <ul className="text-xs text-orange-700 dark:text-orange-300 space-y-0.5">
                {schedulingResult.unplaced.map((work, index) => (
                  <li key={index}>• {work.title}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
