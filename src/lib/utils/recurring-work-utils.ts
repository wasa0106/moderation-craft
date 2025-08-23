/**
 * 定期作業（RecurringWork）に関するユーティリティ関数
 */

import { RecurringWork } from '@/types'
import {
  format,
  addMinutes,
  getDay,
  eachDayOfInterval
} from 'date-fns'

/**
 * 定期作業の発生日を計算
 */
export interface RecurringInstance {
  date: string // YYYY-MM-DD
  startDateTime: string // ISO 8601
  endDateTime: string // ISO 8601
  dayOfWeek: number // 0-6
}

/**
 * 定期作業からプロジェクト期間内の全発生日を計算
 */
export function calculateRecurringInstances(
  work: RecurringWork,
  projectStartDate: Date,
  projectEndDate: Date,
  excludeDates: string[] = []
): RecurringInstance[] {
  const instances: RecurringInstance[] = []
  
  // プロジェクト期間の全日を取得
  const allDays = eachDayOfInterval({
    start: projectStartDate,
    end: projectEndDate
  })

  for (const day of allDays) {
    const dayOfWeek = getDay(day)
    const dateStr = format(day, 'yyyy-MM-dd')
    
    // 除外日チェック
    if (excludeDates.includes(dateStr)) {
      continue
    }

    // パターンマッチング
    let isScheduled = false
    
    if (work.pattern.freq === 'DAILY') {
      // 毎日の場合は全日が対象
      isScheduled = true
    } else if (work.pattern.freq === 'WEEKLY' && work.pattern.byWeekday) {
      // 毎週特定曜日の場合
      isScheduled = work.pattern.byWeekday.includes(dayOfWeek)
    }

    if (isScheduled) {
      // 開始・終了時刻を計算
      const [startHour, startMinute] = work.startTime.split(':').map(Number)
      const startDateTime = new Date(day)
      startDateTime.setHours(startHour, startMinute, 0, 0)
      
      const endDateTime = addMinutes(startDateTime, work.durationMinutes)
      
      instances.push({
        date: dateStr,
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
        dayOfWeek
      })
    }
  }

  return instances
}

/**
 * 定期作業の期間内の合計時間を計算
 */
export function calculateTotalRecurringHours(
  work: RecurringWork,
  projectStartDate: Date,
  projectEndDate: Date,
  excludeDates: string[] = []
): number {
  const instances = calculateRecurringInstances(
    work,
    projectStartDate,
    projectEndDate,
    excludeDates
  )
  
  return instances.length * (work.durationMinutes / 60)
}

/**
 * 定期作業の説明文を生成
 */
export function formatRecurringDescription(work: RecurringWork): string {
  let description = ''
  
  if (work.pattern.freq === 'DAILY') {
    description = '毎日'
  } else if (work.pattern.freq === 'WEEKLY' && work.pattern.byWeekday) {
    const weekdays = ['日', '月', '火', '水', '木', '金', '土']
    const days = work.pattern.byWeekday
      .sort()
      .map(d => weekdays[d])
      .join('・')
    description = `毎週${days}曜日`
  }
  
  const hours = Math.floor(work.durationMinutes / 60)
  const minutes = work.durationMinutes % 60
  const duration = hours > 0 
    ? (minutes > 0 ? `${hours}時間${minutes}分` : `${hours}時間`)
    : `${minutes}分`
  
  description += ` ${work.startTime}から${duration}`
  
  if (work.kind === 'hard') {
    description += '（固定）'
  } else {
    description += '（調整可能）'
  }
  
  return description
}

/**
 * 定期作業から生成されるBigTaskの名前を作成
 */
export function generateRecurringBigTaskName(
  work: RecurringWork,
  instanceDate: Date
): string {
  const dateStr = format(instanceDate, 'MM/dd')
  return `${work.title} (${dateStr})`
}

/**
 * 定期作業グループIDを生成
 */
export function generateRecurringGroupId(
  projectId: string,
  workId: string
): string {
  return `recurring_${projectId}_${workId}`
}