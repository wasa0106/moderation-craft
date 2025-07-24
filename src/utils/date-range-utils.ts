/**
 * 日付範囲によるタスク管理のユーティリティ関数
 */

import { BigTask, Project } from '@/types'
import { startOfWeek, endOfWeek, format, isWithinInterval } from 'date-fns'

/**
 * タスクが指定された週に属するかを日付範囲で判定
 */
export function isTaskInWeek(task: BigTask, weekStart: Date): boolean {
  // 既存のweek_start_dateとweek_end_dateがある場合はそれを使用
  if (task.week_start_date && task.week_end_date) {
    const taskStart = new Date(task.week_start_date)
    const taskEnd = new Date(task.week_end_date)
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })

    // タスクの期間と週の期間が重なっているかチェック
    return (
      isWithinInterval(taskStart, { start: weekStart, end: weekEnd }) ||
      isWithinInterval(taskEnd, { start: weekStart, end: weekEnd }) ||
      (taskStart <= weekStart && taskEnd >= weekEnd)
    )
  }

  // 日付範囲がない場合は従来のweek_numberベースの判定にフォールバック
  return false
}

/**
 * プロジェクトの週次配分に基づいて日付範囲を計算
 */
export function calculateWeekDateRange(
  project: Project,
  weekNumber: number
): { start: Date; end: Date } {
  const projectStart = new Date(project.created_at)
  const projectWeekStart = startOfWeek(projectStart, { weekStartsOn: 1 })

  // プロジェクト開始週から指定週数後の週を計算
  const targetWeekStart = new Date(projectWeekStart)
  targetWeekStart.setDate(targetWeekStart.getDate() + (weekNumber - 1) * 7)

  const targetWeekEnd = endOfWeek(targetWeekStart, { weekStartsOn: 1 })

  return {
    start: targetWeekStart,
    end: targetWeekEnd,
  }
}

/**
 * BigTaskに日付範囲を設定するヘルパー関数
 */
export function addDateRangeToBigTask(task: BigTask, project: Project): BigTask {
  const dateRange = calculateWeekDateRange(project, task.week_number)

  return {
    ...task,
    week_start_date: dateRange.start.toISOString(),
    week_end_date: dateRange.end.toISOString(),
  }
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
    // 日付範囲がある場合はそれを優先
    if (task.week_start_date && task.week_end_date) {
      const taskStart = new Date(task.week_start_date)
      const taskEnd = new Date(task.week_end_date)

      // タスクの期間と週の期間が重なっているかチェック
      return (
        (taskStart >= weekStart && taskStart <= weekEnd) ||
        (taskEnd >= weekStart && taskEnd <= weekEnd) ||
        (taskStart <= weekStart && taskEnd >= weekEnd)
      )
    }

    // 日付範囲がない場合は従来のロジックにフォールバック
    // （このケースは移行期間中のみ発生）
    return false
  })
}
