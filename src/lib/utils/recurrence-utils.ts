/**
 * recurrence-utils.ts - 繰り返しタスク生成ユーティリティ
 * タスクの繰り返しパターンに基づいて、複数のタスクを生成する
 */

import { RecurrencePattern, CreateSmallTaskData } from '@/types'
import { addDays, addWeeks, addMonths, setHours, setMinutes, parseISO } from 'date-fns'

/**
 * 繰り返しパターンに基づいて次回実行日を計算
 * @param pattern 繰り返しパターン
 * @param currentDate 現在の日付
 * @returns 次回実行日（終了条件に達した場合はnull）
 */
export function getNextOccurrence(
  pattern: RecurrencePattern,
  currentDate: Date
): Date | null {
  // 終了条件をチェック
  if (pattern.end_condition.type === 'date' && pattern.end_condition.value) {
    const endDate = parseISO(pattern.end_condition.value as string)
    if (currentDate >= endDate) {
      return null
    }
  }

  let nextDate: Date

  switch (pattern.type) {
    case 'daily':
      nextDate = addDays(currentDate, pattern.interval)
      break

    case 'weekly':
      if (pattern.weekdays && pattern.weekdays.length > 0) {
        // 曜日指定がある場合
        nextDate = findNextWeekday(currentDate, pattern.weekdays, pattern.interval)
      } else {
        // 曜日指定がない場合は単純に週を加算
        nextDate = addWeeks(currentDate, pattern.interval)
      }
      break

    case 'monthly':
      nextDate = addMonths(currentDate, pattern.interval)
      break

    default:
      return null
  }

  // 終了日チェック
  if (pattern.end_condition.type === 'date' && pattern.end_condition.value) {
    const endDate = parseISO(pattern.end_condition.value as string)
    if (nextDate > endDate) {
      return null
    }
  }

  return nextDate
}

/**
 * 指定された曜日の中から次の日付を見つける
 * @param currentDate 現在の日付
 * @param weekdays 曜日リスト（0=日曜, 6=土曜）
 * @param weekInterval 週の間隔
 * @returns 次の該当日
 */
function findNextWeekday(
  currentDate: Date,
  weekdays: number[],
  weekInterval: number
): Date {
  const sortedWeekdays = [...weekdays].sort((a, b) => a - b)
  const currentDay = currentDate.getDay()
  
  // 同じ週内で次の曜日を探す
  for (const weekday of sortedWeekdays) {
    if (weekday > currentDay) {
      const daysToAdd = weekday - currentDay
      return addDays(currentDate, daysToAdd)
    }
  }
  
  // 次の週（またはその先）の最初の曜日
  const daysToNextWeek = 7 - currentDay + (weekInterval - 1) * 7 + sortedWeekdays[0]
  return addDays(currentDate, daysToNextWeek)
}

/**
 * 繰り返しパターンに基づいて複数のタスクを生成
 * @param baseTask ベースとなるタスク
 * @param pattern 繰り返しパターン
 * @param limit 生成する最大タスク数（デフォルト: 52週分）
 * @returns 生成されたタスクの配列
 */
export function generateRecurringTasks(
  baseTask: CreateSmallTaskData,
  pattern: RecurrencePattern,
  limit: number = 52
): CreateSmallTaskData[] {
  const tasks: CreateSmallTaskData[] = []
  
  // 親タスクIDを生成（実際のIDは保存時に生成される）
  const parentTaskId = crypto.randomUUID()
  
  // 開始日時と終了日時を取得
  const startDateTime = parseISO(baseTask.scheduled_start as string)
  const endDateTime = parseISO(baseTask.scheduled_end as string)
  const duration = endDateTime.getTime() - startDateTime.getTime()
  
  // 開始日を設定
  let currentDate = parseISO(pattern.start_date)
  currentDate = setHours(currentDate, startDateTime.getHours())
  currentDate = setMinutes(currentDate, startDateTime.getMinutes())
  
  let count = 0
  
  // 終了条件に基づいてタスクを生成
  while (count < limit) {
    // 終了条件のチェック
    if (pattern.end_condition.type === 'count') {
      const maxCount = pattern.end_condition.value as number
      if (count >= maxCount) {
        break
      }
    } else if (pattern.end_condition.type === 'date' && pattern.end_condition.value) {
      const endDate = parseISO(pattern.end_condition.value as string)
      if (currentDate > endDate) {
        break
      }
    }
    
    // 週単位で曜日指定がある場合
    if (pattern.type === 'weekly' && pattern.weekdays && pattern.weekdays.length > 0) {
      const currentWeekday = currentDate.getDay()
      if (pattern.weekdays.includes(currentWeekday)) {
        // タスクを生成
        const newTask: CreateSmallTaskData = {
          ...baseTask,
          scheduled_start: currentDate.toISOString(),
          scheduled_end: new Date(currentDate.getTime() + duration).toISOString(),
          recurrence_enabled: false, // 子タスクは繰り返し設定を持たない
          recurrence_parent_id: parentTaskId,
        }
        tasks.push(newTask)
        count++
      }
    } else {
      // その他のパターン（日単位、月単位、週単位で曜日指定なし）
      const newTask: CreateSmallTaskData = {
        ...baseTask,
        scheduled_start: currentDate.toISOString(),
        scheduled_end: new Date(currentDate.getTime() + duration).toISOString(),
        recurrence_enabled: false, // 子タスクは繰り返し設定を持たない
        recurrence_parent_id: parentTaskId,
      }
      tasks.push(newTask)
      count++
    }
    
    // 次の日付を計算
    const nextDate = getNextOccurrence(pattern, currentDate)
    if (!nextDate) {
      break
    }
    
    // 時刻を保持
    nextDate.setHours(startDateTime.getHours())
    nextDate.setMinutes(startDateTime.getMinutes())
    currentDate = nextDate
  }
  
  return tasks
}

/**
 * 繰り返しパターンの説明文を生成
 * @param pattern 繰り返しパターン
 * @returns 人間が読みやすい説明文
 */
export function getRecurrenceDescription(pattern: RecurrencePattern): string {
  let description = ''
  
  // 繰り返し単位と間隔
  switch (pattern.type) {
    case 'daily':
      description = pattern.interval === 1 
        ? '毎日' 
        : `${pattern.interval}日ごと`
      break
      
    case 'weekly':
      if (pattern.weekdays && pattern.weekdays.length > 0) {
        const weekdayNames = ['日', '月', '火', '水', '木', '金', '土']
        const days = pattern.weekdays.map(d => weekdayNames[d]).join('・')
        description = pattern.interval === 1
          ? `毎週 ${days}曜日`
          : `${pattern.interval}週間ごと ${days}曜日`
      } else {
        description = pattern.interval === 1
          ? '毎週'
          : `${pattern.interval}週間ごと`
      }
      break
      
    case 'monthly':
      description = pattern.interval === 1
        ? '毎月'
        : `${pattern.interval}ヶ月ごと`
      break
  }
  
  // 終了条件
  if (pattern.end_condition.type === 'date' && pattern.end_condition.value) {
    const endDate = parseISO(pattern.end_condition.value as string)
    description += ` (${endDate.getFullYear()}年${endDate.getMonth() + 1}月${endDate.getDate()}日まで)`
  } else if (pattern.end_condition.type === 'count' && pattern.end_condition.value) {
    description += ` (${pattern.end_condition.value}回まで)`
  }
  
  return description
}