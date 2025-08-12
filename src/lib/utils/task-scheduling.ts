/**
 * Task scheduling utility functions
 * カンバンとスケジュール画面でのタスク管理をサポート
 */

import { SmallTask } from '@/types'

/**
 * タスクがスケジュール済みかどうかを判定
 * @param task SmallTaskオブジェクト
 * @returns スケジュール済みの場合true
 */
export function isScheduled(task: SmallTask): boolean {
  return task.scheduled_start != null && task.scheduled_end != null
}

/**
 * タスクがカンバン上にあるかどうかを判定
 * @param task SmallTaskオブジェクト
 * @returns カンバン上にある場合true
 */
export function isOnKanban(task: SmallTask): boolean {
  return task.kanban_column != null
}

/**
 * タスクをカンバンタブに表示すべきかどうかを判定
 * @param task SmallTaskオブジェクト
 * @returns カンバンタブに表示すべき場合true
 */
export function shouldShowInKanban(task: SmallTask): boolean {
  return isOnKanban(task) && !isScheduled(task)
}

/**
 * 未スケジュールタスクをフィルタリング
 * @param tasks SmallTaskの配列
 * @returns 未スケジュールタスクのみの配列
 */
export function filterUnscheduledTasks(tasks: SmallTask[]): SmallTask[] {
  return tasks.filter(task => !isScheduled(task))
}

/**
 * カンバンタブに表示するタスクをフィルタリング
 * @param tasks SmallTaskの配列
 * @returns カンバンタブに表示すべきタスクの配列
 */
export function filterKanbanTasks(tasks: SmallTask[]): SmallTask[] {
  return tasks.filter(shouldShowInKanban)
}

/**
 * 日付文字列を正規化（1970年日付をnullに変換）
 * @param dateStr 日付文字列
 * @returns 正規化された日付文字列またはnull
 */
export function normalizeDate(dateStr: string | null | undefined): string | null {
  if (!dateStr || dateStr === '1970-01-01T00:00:00.000Z' || dateStr.startsWith('1970-01-01')) {
    return null
  }
  return dateStr
}

/**
 * タスクに時間を設定してスケジュール化
 * @param task SmallTaskオブジェクト
 * @param scheduledStart 開始時刻
 * @param scheduledEnd 終了時刻
 * @param estimatedMinutes 見積時間（分）
 * @returns 更新されたタスクオブジェクト
 */
export function scheduleTask(
  task: SmallTask,
  scheduledStart: string,
  scheduledEnd: string,
  estimatedMinutes: number
): SmallTask {
  return {
    ...task,
    scheduled_start: scheduledStart,
    scheduled_end: scheduledEnd,
    estimated_minutes: estimatedMinutes,
  }
}

/**
 * タスクの時間をリセットして未スケジュール化
 * @param task SmallTaskオブジェクト
 * @returns 未スケジュール化されたタスクオブジェクト
 */
export function unscheduleTask(task: SmallTask): SmallTask {
  return {
    ...task,
    scheduled_start: null,
    scheduled_end: null,
    estimated_minutes: 0,
  }
}