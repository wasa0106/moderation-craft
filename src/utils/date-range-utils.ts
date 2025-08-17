/**
 * 日付範囲によるタスク管理のユーティリティ関数
 */

import { BigTask, Project, SmallTask } from '@/types'
import { startOfWeek, endOfWeek, format, isWithinInterval } from 'date-fns'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'

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
 * タスクをフィルタリングする改良版関数（後方互換性のため残す）
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

/**
 * アプリケーションのデフォルトタイムゾーン
 */
export const APP_TIMEZONE = 'Asia/Tokyo'

/**
 * 重なり判定によるタスクフィルタリング（汎用版）
 * 排他的上限を使用した正確な重なり判定
 * 
 * @param tasks フィルタリング対象のタスク配列
 * @param rangeStartISO 範囲開始（UTC ISO文字列、含む）
 * @param rangeEndExclusiveISO 範囲終了（UTC ISO文字列、含まない）
 * @returns 範囲と重なるタスクの配列
 */
export function filterTasksByOverlap<T extends { 
  scheduled_start?: string | null
  scheduled_end?: string | null 
}>(
  tasks: T[],
  rangeStartISO: string,
  rangeEndExclusiveISO: string
): T[] {
  const rangeStart = new Date(rangeStartISO)
  const rangeEndEx = new Date(rangeEndExclusiveISO)

  return tasks.filter(task => {
    // スケジュールされていないタスクは除外
    if (!task.scheduled_start || !task.scheduled_end) return false
    
    const taskStart = new Date(task.scheduled_start)
    const taskEnd = new Date(task.scheduled_end)
    
    // 重なり判定: [taskStart, taskEnd) vs [rangeStart, rangeEndEx)
    // タスクが範囲と重なる条件：
    // - タスク開始が範囲終了より前 AND
    // - タスク終了が範囲開始より後
    return taskStart < rangeEndEx && taskEnd > rangeStart
  })
}

/**
 * BigTask用の重なり判定フィルタリング
 * 
 * @param tasks BigTaskの配列
 * @param rangeStartISO 範囲開始（UTC ISO文字列）
 * @param rangeEndExclusiveISO 範囲終了（UTC ISO文字列、排他）
 */
export function filterBigTasksByOverlap(
  tasks: BigTask[],
  rangeStartISO: string,
  rangeEndExclusiveISO: string
): BigTask[] {
  const rangeStart = new Date(rangeStartISO)
  const rangeEndEx = new Date(rangeEndExclusiveISO)

  return tasks.filter(task => {
    const taskStart = new Date(task.start_date)
    const taskEnd = new Date(task.end_date)
    
    // 重なり判定
    return taskStart < rangeEndEx && taskEnd > rangeStart
  })
}

/**
 * 週の境界をUTC ISO文字列で取得
 * 
 * @param date 基準日
 * @param timezone タイムゾーン（デフォルト: Asia/Tokyo）
 * @returns { startISO: 週開始のUTC ISO, endExclusiveISO: 翌週開始のUTC ISO }
 */
export function getWeekBoundariesUTC(
  date: Date,
  timezone: string = APP_TIMEZONE
): { startISO: string; endExclusiveISO: string } {
  // 週の開始（月曜00:00、ローカル時間）
  const weekStartLocal = startOfWeek(date, { weekStartsOn: 1 })
  
  // 週の終了（翌週月曜00:00、ローカル時間）= 排他的上限
  const weekEndLocal = new Date(weekStartLocal)
  weekEndLocal.setDate(weekEndLocal.getDate() + 7)
  
  // UTC変換（fromZonedTime: タイムゾーン付き時刻をUTCに変換）
  const weekStartUTC = fromZonedTime(weekStartLocal, timezone)
  const weekEndUTC = fromZonedTime(weekEndLocal, timezone)
  
  return {
    startISO: weekStartUTC.toISOString(),
    endExclusiveISO: weekEndUTC.toISOString()
  }
}

/**
 * タスクが週の範囲外に移動したかチェック
 * 
 * @param taskStart タスク開始時刻（ISO文字列）
 * @param taskEnd タスク終了時刻（ISO文字列）
 * @param weekStartISO 週開始（UTC ISO文字列）
 * @param weekEndExclusiveISO 週終了（UTC ISO文字列、排他）
 * @returns 範囲外の場合true
 */
export function isTaskOutOfWeekRange(
  taskStart: string,
  taskEnd: string,
  weekStartISO: string,
  weekEndExclusiveISO: string
): boolean {
  const start = new Date(taskStart)
  const end = new Date(taskEnd)
  const weekStart = new Date(weekStartISO)
  const weekEndEx = new Date(weekEndExclusiveISO)
  
  // タスク全体が週の範囲内にあるかチェック
  // 範囲外の条件：
  // - タスク終了が週開始以前 OR
  // - タスク開始が週終了以降
  return end <= weekStart || start >= weekEndEx
}
