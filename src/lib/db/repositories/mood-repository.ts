/**
 * MoodEntryRepository - MoodEntry entity specific repository
 * Handles mood entry CRUD operations with date-based queries
 */

import { Table } from 'dexie'
import { db } from '../database'
import { BaseRepository } from './base-repository'
import { MoodEntry, MoodEntryRepository as IMoodEntryRepository } from '@/types'

export class MoodEntryRepository extends BaseRepository<MoodEntry> implements IMoodEntryRepository {
  protected table: Table<MoodEntry> = db.mood_entries
  protected entityType = 'mood_entry'

  async getByDateRange(userId: string, startDate: string, endDate: string): Promise<MoodEntry[]> {
    try {
      return await this.table
        .where('user_id')
        .equals(userId)
        .and(entry => entry.timestamp >= startDate && entry.timestamp <= endDate)
        .sortBy('timestamp')
    } catch (error) {
      throw new Error(`Failed to get mood entries by date range: ${error}`)
    }
  }

  async getLatestEntry(userId: string): Promise<MoodEntry | undefined> {
    try {
      return await this.table
        .where('user_id')
        .equals(userId)
        .reverse()
        .sortBy('timestamp')
        .then(entries => entries[0])
    } catch (error) {
      throw new Error(`Failed to get latest mood entry: ${error}`)
    }
  }

  async getEntriesForDate(userId: string, date: string): Promise<MoodEntry[]> {
    try {
      const startOfDay = `${date}T00:00:00.000Z`
      const endOfDay = `${date}T23:59:59.999Z`
      
      return await this.table
        .where('user_id')
        .equals(userId)
        .and(entry => entry.timestamp >= startOfDay && entry.timestamp <= endOfDay)
        .sortBy('timestamp')
    } catch (error) {
      throw new Error(`Failed to get mood entries for date: ${error}`)
    }
  }

  async getEntriesByMoodLevel(userId: string, moodLevel: number): Promise<MoodEntry[]> {
    try {
      return await this.table
        .where('user_id')
        .equals(userId)
        .and(entry => entry.mood_level === moodLevel)
        .reverse()
        .sortBy('timestamp')
    } catch (error) {
      throw new Error(`Failed to get mood entries by mood level: ${error}`)
    }
  }

  async getEntriesByMoodRange(userId: string, minMood: number, maxMood: number): Promise<MoodEntry[]> {
    try {
      return await this.table
        .where('user_id')
        .equals(userId)
        .and(entry => entry.mood_level >= minMood && entry.mood_level <= maxMood)
        .reverse()
        .sortBy('timestamp')
    } catch (error) {
      throw new Error(`Failed to get mood entries by mood range: ${error}`)
    }
  }

  async getEntriesWithNotes(userId: string): Promise<MoodEntry[]> {
    try {
      return await this.table
        .where('user_id')
        .equals(userId)
        .and(entry => Boolean(entry.notes) && entry.notes!.trim().length > 0)
        .reverse()
        .sortBy('timestamp')
    } catch (error) {
      throw new Error(`Failed to get mood entries with notes: ${error}`)
    }
  }

  async getRecentEntries(userId: string, limit: number = 10): Promise<MoodEntry[]> {
    try {
      return await this.table
        .where('user_id')
        .equals(userId)
        .reverse()
        .sortBy('timestamp')
        .then(entries => entries.slice(0, limit))
    } catch (error) {
      throw new Error(`Failed to get recent mood entries: ${error}`)
    }
  }

  async createEntry(userId: string, moodLevel: number, notes?: string, timestamp?: string): Promise<MoodEntry> {
    try {
      if (moodLevel < 1 || moodLevel > 9) {
        throw new Error('Mood level must be between 1 and 9')
      }

      const entryData = {
        user_id: userId,
        mood_level: moodLevel,
        timestamp: timestamp || new Date().toISOString(),
        notes: notes
      }

      return await this.create(entryData)
    } catch (error) {
      throw new Error(`Failed to create mood entry: ${error}`)
    }
  }

  async updateEntry(entryId: string, moodLevel?: number, notes?: string): Promise<MoodEntry> {
    try {
      const updates: Partial<MoodEntry> = {}

      if (moodLevel !== undefined) {
        if (moodLevel < 1 || moodLevel > 9) {
          throw new Error('Mood level must be between 1 and 9')
        }
        updates.mood_level = moodLevel
      }

      if (notes !== undefined) {
        updates.notes = notes
      }

      return await this.update(entryId, updates)
    } catch (error) {
      throw new Error(`Failed to update mood entry: ${error}`)
    }
  }

  async getAverageMoodForPeriod(userId: string, startDate: string, endDate: string): Promise<number> {
    try {
      const entries = await this.getByDateRange(userId, startDate, endDate)
      
      if (entries.length === 0) {
        return 0
      }

      const totalMood = entries.reduce((sum, entry) => sum + entry.mood_level, 0)
      return Math.round((totalMood / entries.length) * 100) / 100
    } catch (error) {
      throw new Error(`Failed to get average mood for period: ${error}`)
    }
  }

  async getMoodTrend(userId: string, days: number = 7): Promise<{
    date: string
    averageMood: number
    entryCount: number
  }[]> {
    try {
      const endDate = new Date()
      const startDate = new Date(endDate)
      startDate.setDate(startDate.getDate() - days)

      const entries = await this.getByDateRange(
        userId,
        startDate.toISOString(),
        endDate.toISOString()
      )

      const trendData: Record<string, { totalMood: number; count: number }> = {}

      entries.forEach(entry => {
        const date = entry.timestamp.split('T')[0]
        if (!trendData[date]) {
          trendData[date] = { totalMood: 0, count: 0 }
        }
        trendData[date].totalMood += entry.mood_level
        trendData[date].count += 1
      })

      return Object.entries(trendData).map(([date, data]) => ({
        date,
        averageMood: Math.round((data.totalMood / data.count) * 100) / 100,
        entryCount: data.count
      })).sort((a, b) => a.date.localeCompare(b.date))
    } catch (error) {
      throw new Error(`Failed to get mood trend: ${error}`)
    }
  }

  async getMoodDistribution(userId: string, startDate: string, endDate: string): Promise<{
    moodLevel: number
    count: number
    percentage: number
  }[]> {
    try {
      const entries = await this.getByDateRange(userId, startDate, endDate)
      
      if (entries.length === 0) {
        return []
      }

      const distribution: Record<number, number> = {}
      
      entries.forEach(entry => {
        distribution[entry.mood_level] = (distribution[entry.mood_level] || 0) + 1
      })

      return Object.entries(distribution).map(([moodLevel, count]) => ({
        moodLevel: parseInt(moodLevel),
        count,
        percentage: Math.round((count / entries.length) * 100)
      })).sort((a, b) => a.moodLevel - b.moodLevel)
    } catch (error) {
      throw new Error(`Failed to get mood distribution: ${error}`)
    }
  }

  async getHighestMoodEntry(userId: string, startDate: string, endDate: string): Promise<MoodEntry | undefined> {
    try {
      const entries = await this.getByDateRange(userId, startDate, endDate)
      return entries.reduce((highest, entry) => 
        !highest || entry.mood_level > highest.mood_level ? entry : highest
      , undefined as MoodEntry | undefined)
    } catch (error) {
      throw new Error(`Failed to get highest mood entry: ${error}`)
    }
  }

  async getLowestMoodEntry(userId: string, startDate: string, endDate: string): Promise<MoodEntry | undefined> {
    try {
      const entries = await this.getByDateRange(userId, startDate, endDate)
      return entries.reduce((lowest, entry) => 
        !lowest || entry.mood_level < lowest.mood_level ? entry : lowest
      , undefined as MoodEntry | undefined)
    } catch (error) {
      throw new Error(`Failed to get lowest mood entry: ${error}`)
    }
  }

  async getMoodStatistics(userId: string, startDate: string, endDate: string): Promise<{
    totalEntries: number
    averageMood: number
    highestMood: number
    lowestMood: number
    moodVariance: number
    entriesWithNotes: number
    goodMoodDays: number
    badMoodDays: number
  }> {
    try {
      const entries = await this.getByDateRange(userId, startDate, endDate)
      
      if (entries.length === 0) {
        return {
          totalEntries: 0,
          averageMood: 0,
          highestMood: 0,
          lowestMood: 0,
          moodVariance: 0,
          entriesWithNotes: 0,
          goodMoodDays: 0,
          badMoodDays: 0
        }
      }

      const moodLevels = entries.map(entry => entry.mood_level)
      const totalMood = moodLevels.reduce((sum, mood) => sum + mood, 0)
      const averageMood = totalMood / entries.length

      const moodVariance = moodLevels.reduce((sum, mood) => {
        const diff = mood - averageMood
        return sum + (diff * diff)
      }, 0) / entries.length

      const entriesWithNotes = entries.filter(entry => entry.notes && entry.notes.trim().length > 0).length
      const goodMoodDays = entries.filter(entry => entry.mood_level >= 7).length
      const badMoodDays = entries.filter(entry => entry.mood_level <= 3).length

      return {
        totalEntries: entries.length,
        averageMood: Math.round(averageMood * 100) / 100,
        highestMood: Math.max(...moodLevels),
        lowestMood: Math.min(...moodLevels),
        moodVariance: Math.round(moodVariance * 100) / 100,
        entriesWithNotes,
        goodMoodDays,
        badMoodDays
      }
    } catch (error) {
      throw new Error(`Failed to get mood statistics: ${error}`)
    }
  }

  async getDailyMoodSummary(userId: string, date: string): Promise<{
    date: string
    entryCount: number
    averageMood: number
    highestMood: number
    lowestMood: number
    notes: string[]
  }> {
    try {
      const entries = await this.getEntriesForDate(userId, date)
      
      if (entries.length === 0) {
        return {
          date,
          entryCount: 0,
          averageMood: 0,
          highestMood: 0,
          lowestMood: 0,
          notes: []
        }
      }

      const moodLevels = entries.map(entry => entry.mood_level)
      const averageMood = moodLevels.reduce((sum, mood) => sum + mood, 0) / entries.length
      const notes = entries.filter(entry => entry.notes).map(entry => entry.notes!)

      return {
        date,
        entryCount: entries.length,
        averageMood: Math.round(averageMood * 100) / 100,
        highestMood: Math.max(...moodLevels),
        lowestMood: Math.min(...moodLevels),
        notes
      }
    } catch (error) {
      throw new Error(`Failed to get daily mood summary: ${error}`)
    }
  }

  async searchEntriesByNotes(userId: string, searchTerm: string): Promise<MoodEntry[]> {
    try {
      const searchQuery = searchTerm.toLowerCase()
      return await this.table
        .where('user_id')
        .equals(userId)
        .and(entry => Boolean(entry.notes) && entry.notes!.toLowerCase().includes(searchQuery))
        .reverse()
        .sortBy('timestamp')
    } catch (error) {
      throw new Error(`Failed to search mood entries by notes: ${error}`)
    }
  }

  async getEntriesAroundTime(userId: string, timestamp: string, hoursBefore: number = 2, hoursAfter: number = 2): Promise<MoodEntry[]> {
    try {
      const centerTime = new Date(timestamp)
      const startTime = new Date(centerTime.getTime() - (hoursBefore * 60 * 60 * 1000))
      const endTime = new Date(centerTime.getTime() + (hoursAfter * 60 * 60 * 1000))

      return await this.getByDateRange(userId, startTime.toISOString(), endTime.toISOString())
    } catch (error) {
      throw new Error(`Failed to get mood entries around time: ${error}`)
    }
  }
}

export const moodEntryRepository = new MoodEntryRepository()
export { moodEntryRepository as moodRepository }
export default moodEntryRepository