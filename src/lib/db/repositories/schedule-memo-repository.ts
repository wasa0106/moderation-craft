/**
 * Repository for managing schedule memos
 * Handles CRUD operations for weekly schedule memos
 */

import { BaseRepository } from './base-repository'
import { ScheduleMemo, ScheduleMemoRepository as IScheduleMemoRepository } from '@/types'
import { db } from '../database'

export class ScheduleMemoRepositoryImpl extends BaseRepository<ScheduleMemo> implements IScheduleMemoRepository {
  protected table = db.schedule_memos
  protected entityType = 'schedule_memo'

  /**
   * Get schedule memo for a specific week
   */
  async getByWeek(userId: string, weekStartDate: string): Promise<ScheduleMemo | undefined> {
    try {
      return await this.table
        .where('[user_id+week_start_date]')
        .equals([userId, weekStartDate])
        .first()
    } catch (error) {
      throw new Error(`Failed to get schedule memo by week: ${error}`)
    }
  }

  /**
   * Create or update schedule memo for a specific week
   */
  async upsertByWeek(userId: string, weekStartDate: string, content: string): Promise<ScheduleMemo> {
    try {
      // Check if memo already exists
      const existingMemo = await this.getByWeek(userId, weekStartDate)

      if (existingMemo) {
        // Update existing memo
        return await this.update(existingMemo.id, { content })
      } else {
        // Create new memo
        return await this.create({
          user_id: userId,
          week_start_date: weekStartDate,
          content
        })
      }
    } catch (error) {
      throw new Error(`Failed to upsert schedule memo: ${error}`)
    }
  }

  /**
   * Get recent schedule memos
   */
  async getRecent(userId: string, limit: number = 10): Promise<ScheduleMemo[]> {
    try {
      return await this.table
        .where('user_id')
        .equals(userId)
        .reverse()
        .sortBy('week_start_date')
        .then(memos => memos.slice(0, limit))
    } catch (error) {
      throw new Error(`Failed to get recent schedule memos: ${error}`)
    }
  }

  /**
   * Search schedule memos by content
   */
  async searchByContent(userId: string, query: string): Promise<ScheduleMemo[]> {
    try {
      const allMemos = await this.table
        .where('user_id')
        .equals(userId)
        .toArray()

      // Case-insensitive search
      const lowerQuery = query.toLowerCase()
      return allMemos.filter(memo => 
        memo.content.toLowerCase().includes(lowerQuery)
      )
    } catch (error) {
      throw new Error(`Failed to search schedule memos: ${error}`)
    }
  }
}

export const scheduleMemoRepository = new ScheduleMemoRepositoryImpl()