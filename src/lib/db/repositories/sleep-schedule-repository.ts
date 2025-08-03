/**
 * SleepScheduleRepository - 睡眠スケジュールのデータアクセス層
 */

import {
  SleepSchedule,
  CreateSleepScheduleData,
  UpdateSleepScheduleData,
  SleepScheduleRepository as ISleepScheduleRepository,
} from '@/types'
import { db } from '../database'
import { BaseRepository } from './base-repository'

class SleepScheduleRepositoryImpl
  extends BaseRepository<SleepSchedule>
  implements ISleepScheduleRepository
{
  protected table = db.sleep_schedules
  protected entityType = 'sleep_schedule'

  constructor() {
    super()
  }

  /**
   * 特定の起床日の睡眠スケジュールを取得
   */
  async getByDateOfSleep(userId: string, dateOfSleep: string): Promise<SleepSchedule | undefined> {
    return await this.table.where('[user_id+date_of_sleep]').equals([userId, dateOfSleep]).first()
  }

  /**
   * 日付範囲で睡眠スケジュールを取得
   */
  async getByDateRange(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<SleepSchedule[]> {
    return await this.table
      .where('user_id')
      .equals(userId)
      .and(schedule => schedule.date_of_sleep >= startDate && schedule.date_of_sleep <= endDate)
      .toArray()
  }

  /**
   * 起床日でupsert（存在すれば更新、なければ作成）
   */
  async upsertByDateOfSleep(
    userId: string,
    dateOfSleep: string,
    data: Partial<SleepSchedule>
  ): Promise<SleepSchedule> {
    const existing = await this.getByDateOfSleep(userId, dateOfSleep)

    if (existing) {
      // 更新時は睡眠時間を再計算
      const updatedData = { ...data }

      // 時刻が変更された場合は睡眠時間を再計算
      if (updatedData.scheduled_start_time && updatedData.scheduled_end_time) {
        const startTime = new Date(updatedData.scheduled_start_time)
        const endTime = new Date(updatedData.scheduled_end_time)
        updatedData.scheduled_duration_minutes = Math.round(
          (endTime.getTime() - startTime.getTime()) / (1000 * 60)
        )
      }

      return await this.update(existing.id, updatedData)
    } else {
      // 新規作成
      const createData: CreateSleepScheduleData = {
        user_id: userId,
        date_of_sleep: dateOfSleep,
        scheduled_start_time: data.scheduled_start_time || '',
        scheduled_end_time: data.scheduled_end_time || '',
        scheduled_duration_minutes: 0, // フックで計算される
        notes: data.notes,
      }

      return await this.create(createData)
    }
  }

  /**
   * 最近の睡眠スケジュールを取得
   */
  async getRecentSchedules(userId: string, limit: number = 7): Promise<SleepSchedule[]> {
    return await this.table
      .where('user_id')
      .equals(userId)
      .reverse()
      .sortBy('date_of_sleep')
      .then(schedules => schedules.slice(0, limit))
  }

  /**
   * 実際の睡眠データを更新（Fitbit連携用）
   */
  async updateActualSleepData(
    scheduleId: string,
    actualData: {
      actual_start_time?: string
      actual_end_time?: string
      actual_duration_minutes?: number
      sleep_quality?: number
    }
  ): Promise<SleepSchedule> {
    return await this.update(scheduleId, actualData)
  }

  /**
   * Fitbitデータを含む実績データを更新
   */
  async updateActualData(
    scheduleId: string,
    data: {
      actual_start_time?: string
      actual_end_time?: string
      actual_duration_minutes?: number
      minutes_asleep?: number
      minutes_awake?: number
      time_in_bed?: number
      sleep_efficiency?: number
      actual_data_source?: 'manual' | 'fitbit' | 'import'
      actual_data_synced_at?: string
    }
  ): Promise<SleepSchedule> {
    // 同期日時を自動設定
    if (data.actual_data_source && !data.actual_data_synced_at) {
      data.actual_data_synced_at = new Date().toISOString()
    }

    return await this.update(scheduleId, data)
  }
}

export const sleepScheduleRepository = new SleepScheduleRepositoryImpl()
export { SleepScheduleRepositoryImpl }
