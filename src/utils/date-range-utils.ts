/**
 * 日付範囲によるタスク管理のユーティリティ関数
 */

import { BigTask, Project } from '@/types'
import { startOfWeek, endOfWeek, format, isWithinInterval } from 'date-fns'

/**
 * タスクが指定された週に属するかを日付範囲で判定
 */
export function isTaskInWeek(task: BigTask, weekStart: Date): boolean {
  const taskStart = new Date(task.start_date)
  const taskEnd = new Date(task.end_date)
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })

  // タスクの期間と週の期間が重なっているかチェック
  return (
    isWithinInterval(taskStart, { start: weekStart, end: weekEnd }) ||
    isWithinInterval(taskEnd, { start: weekStart, end: weekEnd }) ||
    (taskStart <= weekStart && taskEnd >= weekEnd)
  )
}


/**
 * 週番号の表示を日付範囲表示に変換
 */
export function formatWeekDateRange(weekStart: Date): string {
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
  return `${format(weekStart, 'M/d')} - ${format(weekEnd, 'M/d')}`
}

/**
 * タスクをフィルタリングする改良版関数
 */
export function filterTasksByDateRange(tasks: BigTask[], weekStart: Date): BigTask[] {
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })

  return tasks.filter(task => {
    const taskStart = new Date(task.start_date)
    const taskEnd = new Date(task.end_date)

    // タスクの期間と週の期間が重なっているかチェック
    return (
      (taskStart >= weekStart && taskStart <= weekEnd) ||
      (taskEnd >= weekStart && taskEnd <= weekEnd) ||
      (taskStart <= weekStart && taskEnd >= weekEnd)
    )
  })
}
