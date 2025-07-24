/**
 * Dopamine Entry Repository
 * Handles database operations for dopamine entries
 */

import { db } from '../database'
import { BaseRepository } from './base-repository'
import {
  DopamineEntry,
  CreateDopamineEntryData,
  UpdateDopamineEntryData,
  DopamineEntryRepository as IDopamineEntryRepository,
} from '@/types'

export interface DopamineEntryRepository extends IDopamineEntryRepository {
  getByDateRange(userId: string, startDate: string, endDate: string): Promise<DopamineEntry[]>
  getLatestEntry(userId: string): Promise<DopamineEntry | undefined>
  getTodayEntries(userId: string): Promise<DopamineEntry[]>
}

export class DopamineEntryRepositoryImpl
  extends BaseRepository<DopamineEntry>
  implements DopamineEntryRepository
{
  protected table = db.dopamine_entries
  protected entityType = 'dopamine_entries'

  async getByDateRange(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<DopamineEntry[]> {
    try {
      const entries = await this.table
        .where('user_id')
        .equals(userId)
        .and(entry => entry.timestamp >= startDate && entry.timestamp <= endDate)
        .toArray()

      return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    } catch (error) {
      console.error('Failed to get dopamine entries by date range:', error)
      throw error
    }
  }

  async getLatestEntry(userId: string): Promise<DopamineEntry | undefined> {
    try {
      const entries = await this.table
        .where('user_id')
        .equals(userId)
        .reverse()
        .sortBy('timestamp')

      return entries[0]
    } catch (error) {
      console.error('Failed to get latest dopamine entry:', error)
      throw error
    }
  }

  async getTodayEntries(userId: string): Promise<DopamineEntry[]> {
    try {
      const today = new Date()
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString()

      return this.getByDateRange(userId, startOfDay, endOfDay)
    } catch (error) {
      console.error('Failed to get today\'s dopamine entries:', error)
      throw error
    }
  }

  async create(data: CreateDopamineEntryData): Promise<DopamineEntry> {
    // Ensure timestamp is set
    const entryData = {
      ...data,
      timestamp: data.timestamp || new Date().toISOString(),
    }

    return super.create(entryData)
  }
}

export const dopamineEntryRepository = new DopamineEntryRepositoryImpl()