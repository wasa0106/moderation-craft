/**
 * TimeEntry Repository
 * 手動入力による実績時間の管理
 */

import { TimeEntry } from '@/types'
import { BaseRepository } from './base-repository'
import { db } from '../database'
import { Table } from 'dexie'

export class TimeEntryRepository extends BaseRepository<TimeEntry> {
  protected table: Table<TimeEntry> = db.time_entries
  protected entityType = 'time_entries'

  /**
   * 指定日のTimeEntryを取得
   */
  async getByDate(userId: string, date: string): Promise<TimeEntry[]> {
    return this.table
      .where('[user_id+date]')
      .equals([userId, date])
      .toArray()
  }

  /**
   * 日付範囲でTimeEntryを取得
   */
  async getByDateRange(
    userId: string, 
    startDate: string, 
    endDate: string
  ): Promise<TimeEntry[]> {
    return this.table
      .where('user_id')
      .equals(userId)
      .and(entry => entry.date >= startDate && entry.date <= endDate)
      .toArray()
  }

  /**
   * プロジェクト別のTimeEntryを取得
   */
  async getByProject(
    userId: string, 
    projectId: string
  ): Promise<TimeEntry[]> {
    return this.table
      .where('user_id')
      .equals(userId)
      .and(entry => entry.project_id === projectId)
      .toArray()
  }

  /**
   * BigTask別のTimeEntryを取得
   */
  async getByBigTask(
    userId: string,
    bigTaskId: string
  ): Promise<TimeEntry[]> {
    return this.table
      .where('user_id')
      .equals(userId)
      .and(entry => entry.big_task_id === bigTaskId)
      .toArray()
  }

  /**
   * SmallTask別のTimeEntryを取得
   */
  async getBySmallTask(
    userId: string,
    smallTaskId: string
  ): Promise<TimeEntry[]> {
    return this.table
      .where('user_id')
      .equals(userId)
      .and(entry => entry.small_task_id === smallTaskId)
      .toArray()
  }

  /**
   * TimeEntryの作成（時間の重複チェック付き）
   */
  async create(data: Omit<TimeEntry, 'id' | 'created_at' | 'updated_at'>): Promise<TimeEntry> {
    // 時間の重複チェック
    const overlapping = await this.checkTimeOverlap(
      data.user_id as string,
      data.date as string,
      data.start_time as string,
      data.end_time as string
    )
    
    if (overlapping.length > 0) {
      console.warn('TimeEntry overlaps with existing entries:', overlapping)
      // 警告のみで、エラーにはしない（ユーザーが意図的に重複させる場合がある）
    }

    // duration_minutesを計算
    if (!data.duration_minutes && data.start_time && data.end_time) {
      const startTime = new Date(data.start_time as string)
      const endTime = new Date(data.end_time as string)
      data.duration_minutes = Math.round(
        (endTime.getTime() - startTime.getTime()) / (1000 * 60)
      )
    }

    return super.create(data)
  }

  /**
   * TimeEntryの更新（時間の重複チェック付き）
   */
  async update(
    id: string, 
    data: Partial<Omit<TimeEntry, 'id' | 'created_at'>>
  ): Promise<TimeEntry> {
    const existing = await this.getById(id)
    if (!existing) {
      throw new Error(`TimeEntry with id ${id} not found`)
    }

    // 時間が変更される場合は重複チェック
    if (data.start_time || data.end_time) {
      const startTime = data.start_time ?? existing.start_time
      const endTime = data.end_time ?? existing.end_time
      const date = data.date ?? existing.date
      
      const overlapping = await this.checkTimeOverlap(
        existing.user_id,
        date as string,
        startTime as string,
        endTime as string,
        id // 自分自身は除外
      )
      
      if (overlapping.length > 0) {
        console.warn('TimeEntry update would overlap with existing entries:', overlapping)
      }

      // duration_minutesを再計算
      if (startTime && endTime) {
        const start = new Date(startTime as string)
        const end = new Date(endTime as string)
        data.duration_minutes = Math.round(
          (end.getTime() - start.getTime()) / (1000 * 60)
        )
      }
    }

    return super.update(id, data)
  }

  /**
   * 時間の重複をチェック
   */
  private async checkTimeOverlap(
    userId: string,
    date: string,
    startTime: string,
    endTime: string,
    excludeId?: string
  ): Promise<TimeEntry[]> {
    const entries = await this.getByDate(userId, date)
    
    return entries.filter(entry => {
      // 自分自身は除外
      if (excludeId && entry.id === excludeId) return false
      
      const entryStart = new Date(entry.start_time)
      const entryEnd = new Date(entry.end_time)
      const newStart = new Date(startTime)
      const newEnd = new Date(endTime)
      
      // 重複チェック
      return (
        (newStart >= entryStart && newStart < entryEnd) || // 新規開始が既存の範囲内
        (newEnd > entryStart && newEnd <= entryEnd) || // 新規終了が既存の範囲内
        (newStart <= entryStart && newEnd >= entryEnd) // 新規が既存を完全に含む
      )
    })
  }

  /**
   * 日別の合計時間を取得
   */
  async getDailySummary(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<{ date: string; totalMinutes: number }[]> {
    const entries = await this.getByDateRange(userId, startDate, endDate)
    
    const summaryMap = new Map<string, number>()
    entries.forEach(entry => {
      const current = summaryMap.get(entry.date) || 0
      summaryMap.set(entry.date, current + entry.duration_minutes)
    })
    
    return Array.from(summaryMap.entries()).map(([date, totalMinutes]) => ({
      date,
      totalMinutes
    }))
  }

  /**
   * プロジェクト別の合計時間を取得
   */
  async getProjectSummary(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<{ projectId: string; totalMinutes: number }[]> {
    const entries = await this.getByDateRange(userId, startDate, endDate)
    
    const summaryMap = new Map<string, number>()
    entries.forEach(entry => {
      if (entry.project_id) {
        const current = summaryMap.get(entry.project_id) || 0
        summaryMap.set(entry.project_id, current + entry.duration_minutes)
      }
    })
    
    return Array.from(summaryMap.entries()).map(([projectId, totalMinutes]) => ({
      projectId,
      totalMinutes
    }))
  }
}

export const timeEntryRepository = new TimeEntryRepository()