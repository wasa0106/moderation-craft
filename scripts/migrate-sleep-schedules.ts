/**
 * 睡眠スケジュールデータの移行スクリプト
 * 旧形式から新形式（Fitbit API形式）への移行
 */

import { db } from '../src/lib/db/database'
import { format, addDays } from 'date-fns'

interface OldSleepSchedule {
  id: string
  user_id: string
  date: string  // 基準日（YYYY-MM-DD）
  bedtime_hour: number
  bedtime_minute: number
  bedtime_is_next_day: boolean
  wake_time_hour: number
  wake_time_minute: number
  wake_time_is_next_day: boolean
  scheduled_bedtime: string
  scheduled_wake_time: string
  scheduled_duration_minutes: number
  actual_bedtime?: string
  actual_wake_time?: string
  actual_duration_minutes?: number
  sleep_quality?: number
  notes?: string
  created_at: string
  updated_at: string
}

interface NewSleepSchedule {
  id: string
  user_id: string
  date_of_sleep: string  // 起床日（YYYY-MM-DD）
  scheduled_start_time: string
  scheduled_end_time: string
  scheduled_duration_minutes: number
  actual_start_time?: string
  actual_end_time?: string
  actual_duration_minutes?: number
  sleep_quality?: number
  notes?: string
  created_at: string
  updated_at: string
}

/**
 * 旧形式のデータを新形式に変換
 */
function convertToNewFormat(old: OldSleepSchedule): NewSleepSchedule {
  // 就寝時刻の計算
  const bedtimeDate = new Date(old.date)
  if (old.bedtime_is_next_day) {
    bedtimeDate.setDate(bedtimeDate.getDate() + 1)
  }
  bedtimeDate.setHours(old.bedtime_hour, old.bedtime_minute, 0, 0)
  
  // 起床時刻の計算
  const wakeTimeDate = new Date(old.date)
  if (old.wake_time_is_next_day || (!old.bedtime_is_next_day && old.wake_time_hour < old.bedtime_hour)) {
    wakeTimeDate.setDate(wakeTimeDate.getDate() + 1)
  }
  wakeTimeDate.setHours(old.wake_time_hour, old.wake_time_minute, 0, 0)
  
  // 起床日を取得
  const dateOfSleep = format(wakeTimeDate, 'yyyy-MM-dd')
  
  return {
    id: old.id,
    user_id: old.user_id,
    date_of_sleep: dateOfSleep,
    scheduled_start_time: bedtimeDate.toISOString(),
    scheduled_end_time: wakeTimeDate.toISOString(),
    scheduled_duration_minutes: old.scheduled_duration_minutes,
    actual_start_time: old.actual_bedtime,
    actual_end_time: old.actual_wake_time,
    actual_duration_minutes: old.actual_duration_minutes,
    sleep_quality: old.sleep_quality,
    notes: old.notes,
    created_at: old.created_at,
    updated_at: old.updated_at,
  }
}

/**
 * データ移行の実行
 */
async function migrateSleepSchedules() {
  console.log('睡眠スケジュールデータの移行を開始します...')
  
  try {
    // 既存のデータを取得
    const oldSchedules = await db.sleep_schedules.toArray() as any[]
    console.log(`${oldSchedules.length}件のデータを移行します`)
    
    // バックアップテーブルを作成（念のため）
    const backupData = oldSchedules.map(schedule => ({
      ...schedule,
      _backup_date: new Date().toISOString()
    }))
    
    // localStorageにバックアップを保存
    if (typeof window !== 'undefined') {
      localStorage.setItem('sleep_schedules_backup', JSON.stringify(backupData))
      console.log('バックアップをlocalStorageに保存しました')
    }
    
    // 各データを変換して更新
    let successCount = 0
    let errorCount = 0
    
    for (const oldSchedule of oldSchedules) {
      try {
        // 新形式かどうかチェック（既に移行済みの場合はスキップ）
        if ('date_of_sleep' in oldSchedule && 'scheduled_start_time' in oldSchedule) {
          console.log(`ID: ${oldSchedule.id} は既に新形式です。スキップします。`)
          continue
        }
        
        const newSchedule = convertToNewFormat(oldSchedule)
        
        // データベースを更新
        const { id, ...updateData } = newSchedule
        await db.sleep_schedules.update(oldSchedule.id, updateData)
        
        console.log(`✓ ID: ${oldSchedule.id} を移行しました (${oldSchedule.date} → ${newSchedule.date_of_sleep})`)
        successCount++
      } catch (error) {
        console.error(`✗ ID: ${oldSchedule.id} の移行に失敗しました:`, error)
        errorCount++
      }
    }
    
    console.log('\n移行完了:')
    console.log(`  成功: ${successCount}件`)
    console.log(`  失敗: ${errorCount}件`)
    console.log(`  スキップ: ${oldSchedules.length - successCount - errorCount}件`)
    
    if (errorCount === 0) {
      console.log('\n✅ すべてのデータが正常に移行されました！')
    } else {
      console.log('\n⚠️ 一部のデータの移行に失敗しました。バックアップはlocalStorageに保存されています。')
    }
    
  } catch (error) {
    console.error('移行処理中にエラーが発生しました:', error)
    throw error
  }
}

// 実行確認
if (typeof window !== 'undefined') {
  console.log('ブラウザのコンソールでこのスクリプトを実行します。')
  console.log('実行するには、以下のコマンドを入力してください:')
  console.log('migrateSleepSchedules()')
  
  // グローバルに関数を公開
  ;(window as any).migrateSleepSchedules = migrateSleepSchedules
} else {
  // Node.js環境での実行
  migrateSleepSchedules().catch(console.error)
}

export { migrateSleepSchedules }