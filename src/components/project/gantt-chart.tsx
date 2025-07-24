/**
 * GanttChart - プロジェクトのタスクをガントチャート形式で表示
 */

'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Task, WeeklyAllocation } from '@/stores/project-creation-store'
import { format, startOfWeek, addWeeks, differenceInWeeks } from 'date-fns'
import { ja } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { AlertTriangle } from 'lucide-react'

export interface GanttTask extends Task {
  week_start: number
  week_end: number
  weeklyHours: Map<number, number>  // 週ごとの実際の配分時間
}


interface GanttChartProps {
  tasks: Task[]
  startDate: Date
  endDate: Date
  weeklyAvailableHours?: number  // 非推奨、後方互換性のためオプショナルに
  weeklyAllocations?: WeeklyAllocation[]  // 新規追加
  categoryColors: Map<string, string>
  onTaskUpdate: (taskId: string, weekStart: number, weekEnd: number) => void
  totalTaskHours: number
  totalAvailableHours: number
}

export function GanttChart({
  tasks,
  startDate,
  endDate,
  weeklyAvailableHours,
  weeklyAllocations,
  categoryColors,
  onTaskUpdate,
  totalTaskHours,
  totalAvailableHours,
}: GanttChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [ganttTasks, setGanttTasks] = useState<GanttTask[]>([])

  // プロジェクト終了日を含む週のインデックスを計算
  const projectEndWeekIndex = useMemo(() => {
    const projectEndWeek = startOfWeek(endDate, { weekStartsOn: 1 })
    return Math.floor(
      differenceInWeeks(projectEndWeek, startOfWeek(startDate, { weekStartsOn: 1 }))
    )
  }, [endDate, startDate])

  // 実際に必要な週数を計算（タスクが完了するまで）
  const actualTotalWeeks = useMemo(() => {
    if (ganttTasks.length === 0) {
      return Math.max(1, Math.ceil(differenceInWeeks(endDate, startDate)) + 1)
    }
    // 最後のタスクの終了週を取得
    const maxWeekEnd = Math.max(...ganttTasks.map(task => task.week_end))
    return Math.max(maxWeekEnd + 1, Math.ceil(differenceInWeeks(endDate, startDate)) + 1)
  }, [ganttTasks, endDate, startDate])

  // 週の計算
  const weekStart = startOfWeek(startDate, { weekStartsOn: 1 })
  const weeks = Array.from({ length: actualTotalWeeks }, (_, i) => addWeeks(weekStart, i))

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
    return Array.from(grouped.entries()).sort(([a], [b]) => 
      categoryFirstAppearance.get(a)! - categoryFirstAppearance.get(b)!
    )
  }, [ganttTasks])

  // タスクの自動配置
  useEffect(() => {
    if (tasks.length === 0) {
      setGanttTasks([])
      return
    }

    // weeklyAllocationsがない場合は旧ロジックを使用（後方互換性）
    if (!weeklyAllocations || weeklyAllocations.length === 0) {
      // 旧ロジック: 固定の週間利用可能時間を使用
      const allocated: GanttTask[] = []
      const weekHours: Map<number, number> = new Map()
      const fixedWeeklyHours = weeklyAvailableHours || 40

      const sortedTasks = [...tasks].sort((a, b) => a.order - b.order)

      sortedTasks.forEach(task => {
        let bestWeek = 0
        let minUsage = Infinity

        // 最も空いている週を探す
        for (let w = 0; w < actualTotalWeeks; w++) {
          const currentHours = weekHours.get(w) || 0
          if (currentHours < minUsage) {
            minUsage = currentHours
            bestWeek = w
          }
        }

        // タスクの週数を計算
        const weeksNeeded = Math.max(1, Math.ceil(task.estimatedHours / fixedWeeklyHours))
        
        // タスクを配置
        for (let w = 0; w < weeksNeeded; w++) {
          const weekIndex = bestWeek + w
          const currentHours = weekHours.get(weekIndex) || 0
          const hoursPerWeek = task.estimatedHours / weeksNeeded
          weekHours.set(weekIndex, currentHours + hoursPerWeek)
        }

        // 旧ロジックでもweeklyHoursを設定（均等割り）
        const taskWeeklyHours = new Map<number, number>()
        const hoursPerWeek = task.estimatedHours / weeksNeeded
        for (let w = 0; w < weeksNeeded; w++) {
          taskWeeklyHours.set(bestWeek + w, hoursPerWeek)
        }
        
        allocated.push({
          ...task,
          week_start: bestWeek,
          week_end: bestWeek + weeksNeeded - 1,
          weeklyHours: taskWeeklyHours,
        })
      })

      setGanttTasks(allocated)
      return
    }

    const allocated: GanttTask[] = []
    const weekHours: Map<number, number> = new Map()
    
    // 週ごとの利用可能時間をマップに格納
    const weekCapacities = new Map<number, number>()
    weeklyAllocations.forEach((allocation, index) => {
      weekCapacities.set(index, allocation.availableHours)
    })

    // タスクをorder順でソート（入力順序を維持）
    const sortedTasks = [...tasks].sort((a, b) => a.order - b.order)
    
    // 現在の週のインデックス（タスクを順次配置）
    let currentWeekIndex = 0
    let remainingWeekHours = weekCapacities.get(0) || 0

    sortedTasks.forEach(task => {
      let remainingTaskHours = task.estimatedHours
      const taskStartWeek = currentWeekIndex
      let taskEndWeek = currentWeekIndex
      const taskWeeklyHours = new Map<number, number>()
      
      // タスクを週に配分
      while (remainingTaskHours > 0 && currentWeekIndex < weeklyAllocations.length) {
        const availableHours = remainingWeekHours
        const hoursToAllocate = Math.min(remainingTaskHours, availableHours)
        
        if (hoursToAllocate > 0) {
          const currentHours = weekHours.get(currentWeekIndex) || 0
          weekHours.set(currentWeekIndex, currentHours + hoursToAllocate)
          
          // タスクの週ごとの時間を記録
          taskWeeklyHours.set(currentWeekIndex, hoursToAllocate)
          
          remainingTaskHours -= hoursToAllocate
          remainingWeekHours -= hoursToAllocate
          taskEndWeek = currentWeekIndex
        }
        
        // 現在の週の容量を使い切った場合、次の週へ
        if (remainingWeekHours === 0 || hoursToAllocate === 0) {
          currentWeekIndex++
          if (currentWeekIndex < weeklyAllocations.length) {
            remainingWeekHours = weekCapacities.get(currentWeekIndex) || 0
          }
        }
      }
      
      // タスクの配置情報を記録
      allocated.push({
        ...task,
        week_start: taskStartWeek,
        week_end: taskEndWeek,
        weeklyHours: taskWeeklyHours,
      })
      
      // 全てのタスクを配置できなかった場合の処理
      if (remainingTaskHours > 0) {
        console.warn(`タスク「${task.name}」の${remainingTaskHours}時間分が配置できませんでした`)
      }
    })

    setGanttTasks(allocated)
  }, [tasks, weeklyAllocations, weeklyAvailableHours, actualTotalWeeks])

  // 週ごとの作業時間を計算（実際の配分に基づく）
  const weeklyWorkload = useMemo(() => {
    const workload = new Array(actualTotalWeeks).fill(0)

    ganttTasks.forEach(task => {
      // タスクのweeklyHoursから実際の配分を取得
      task.weeklyHours.forEach((hours, weekIndex) => {
        if (weekIndex < actualTotalWeeks) {
          workload[weekIndex] += hours
        }
      })
    })

    return workload
  }, [ganttTasks, actualTotalWeeks])

  if (tasks.length === 0) {
    return null
  }

  return (
    <div className="w-full">
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto" ref={containerRef}>
          <table className="border-collapse" style={{ minWidth: `${336 + weeks.length * 80}px` }}>
            <thead>
              <tr className="bg-gray-50">
                <th className="sticky left-0 z-20 bg-gray-50 border-r border-b px-3 py-2 text-left text-sm font-medium w-64">
                  タスク名
                </th>
                <th className="sticky left-64 z-20 bg-gray-50 border-r border-b px-3 py-2 text-center text-sm font-medium w-20">
                  時間
                </th>
                {weeks.map((week, i) => {
                  const weekCapacity = weeklyAllocations?.[i]?.availableHours || weeklyAvailableHours || 40
                  return (
                    <th
                      key={i}
                      className="border-b px-2 py-2 text-center text-sm font-medium"
                      style={{ minWidth: '80px', width: '80px' }}
                    >
                      <div>{format(week, 'M/d')}</div>
                      <div className="text-xs font-normal text-muted-foreground">
                        {weekCapacity}h
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {tasksByCategory.map(([category, categoryTasks]) => (
                <React.Fragment key={`category-group-${category}`}>
                  {/* カテゴリ行 */}
                  <tr key={`category-${category}`} className="bg-[#E3E892]">
                    <td className="sticky left-0 z-10 bg-[#E3E892] border-r px-3 py-1 text-sm font-medium text-[#464A02] w-64">
                      {category}
                    </td>
                    <td className="sticky left-64 z-10 bg-[#E3E892] border-r px-3 py-1 text-center text-sm w-20">
                      {/* 時間列は空欄 */}
                    </td>
                    {weeks.map((_, weekIndex) => (
                      <td
                        key={`category-${category}-week-${weekIndex}`}
                        className="bg-[#E3E892] border-r h-8"
                        style={{ minWidth: '80px', width: '80px' }}
                      >
                        {/* ガントバーは表示しない */}
                      </td>
                    ))}
                  </tr>
                  {/* タスク行 */}
                  {categoryTasks.map(task => (
                    <tr key={`task-${task.id}`} className="border-b hover:bg-gray-50">
                      <td className="sticky left-0 z-10 bg-white border-r px-3 py-2 text-sm w-64">
                        <span className="pl-4">{task.name}</span>
                      </td>
                      <td className="sticky left-64 z-10 bg-white border-r px-3 py-2 text-center text-sm w-20">
                        {task.estimatedHours}h
                      </td>
                      {weeks.map((_, weekIndex) => {
                        const isInRange = weekIndex >= task.week_start && weekIndex <= task.week_end
                        const isStart = weekIndex === task.week_start
                        const isEnd = weekIndex === task.week_end
                        const weekCapacity = weeklyAllocations?.[weekIndex]?.availableHours || weeklyAvailableHours || 40
                        const isOverCapacity = weeklyWorkload[weekIndex] > weekCapacity
                        const isAfterProjectEnd = weekIndex > projectEndWeekIndex

                        return (
                          <td
                            key={`task-${task.id}-week-${weekIndex}`}
                            className={cn(
                              'relative border-r h-10',
                              isOverCapacity && 'bg-red-50',
                              isAfterProjectEnd && isInRange && 'bg-orange-50'
                            )}
                            style={{ minWidth: '80px', width: '80px' }}
                          >
                            {isInRange && (
                              <div
                                className={cn(
                                  'absolute inset-y-1',
                                  // タスク合計時間が超過している場合、プロジェクト終了日後は赤色
                                  totalTaskHours > totalAvailableHours && isAfterProjectEnd
                                    ? 'bg-[#BA1A1A]'
                                    : 'bg-[#5E621B]',
                                  isStart && 'rounded-l',
                                  isEnd && 'rounded-r'
                                )}
                                style={{
                                  left: isStart ? '4px' : '0',
                                  right: isEnd ? '4px' : '0',
                                }}
                              />
                            )}
                            {isOverCapacity && (
                              <div
                                className="absolute top-0 right-0 m-1 group"
                                title={`超過: ${(weeklyWorkload[weekIndex] - (weeklyAllocations?.[weekIndex]?.availableHours || weeklyAvailableHours || 40)).toFixed(1)}時間`}
                              >
                                <AlertTriangle className="h-3 w-3 text-red-600" />
                                <div className="absolute bottom-full right-0 mb-1 hidden group-hover:block bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-50">
                                  超過:{' '}
                                  {(weeklyWorkload[weekIndex] - (weeklyAllocations?.[weekIndex]?.availableHours || weeklyAvailableHours || 40)).toFixed(1)}
                                  時間
                                </div>
                              </div>
                            )}
                            {isAfterProjectEnd && isInRange && (
                              <div
                                className="absolute bottom-0 right-0 m-1 group"
                                title="プロジェクト期間外"
                              >
                                <AlertTriangle className="h-3 w-3 text-white" />
                                <div className="absolute bottom-full right-0 mb-1 hidden group-hover:block bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-50">
                                  プロジェクト期間外
                                </div>
                              </div>
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
    </div>
  )
}
