/**
 * DailyConditionRepository - DailyCondition entity specific repository
 * Handles daily condition CRUD operations with Fitbit data integration
 */

import { Table } from 'dexie'
import { db } from '../database'
import { BaseRepository } from './base-repository'
import { DailyCondition, DailyConditionRepository as IDailyConditionRepository } from '@/types'

export class DailyConditionRepository extends BaseRepository<DailyCondition> implements IDailyConditionRepository {
  protected table: Table<DailyCondition> = db.daily_conditions
  protected entityType = 'daily_condition'

  async getByDate(userId: string, date: string): Promise<DailyCondition | undefined> {
    try {
      return await this.table
        .where('user_id')
        .equals(userId)
        .and(condition => condition.date === date)
        .first()
    } catch (error) {
      throw new Error(`Failed to get daily condition by date: ${error}`)
    }
  }

  async getByDateRange(userId: string, startDate: string, endDate: string): Promise<DailyCondition[]> {
    try {
      return await this.table
        .where('user_id')
        .equals(userId)
        .and(condition => condition.date >= startDate && condition.date <= endDate)
        .sortBy('date')
    } catch (error) {
      throw new Error(`Failed to get daily conditions by date range: ${error}`)
    }
  }

  async getUnsyncedConditions(): Promise<DailyCondition[]> {
    try {
      return await this.table
        .where('fitbit_sync_date')
        .equals('')
        .or('fitbit_sync_date')
        .equals(undefined as any)
        .sortBy('date')
    } catch (error) {
      throw new Error(`Failed to get unsynced conditions: ${error}`)
    }
  }

  async createOrUpdateCondition(
    userId: string,
    date: string,
    data: Partial<Omit<DailyCondition, 'id' | 'date' | 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<DailyCondition> {
    try {
      const existing = await this.getByDate(userId, date)
      
      if (existing) {
        return await this.update(existing.id, data)
      } else {
        return await this.create({
          date,
          user_id: userId,
          ...data
        })
      }
    } catch (error) {
      throw new Error(`Failed to create or update daily condition: ${error}`)
    }
  }

  async updateFitbitData(userId: string, date: string, sleepHours?: number, steps?: number): Promise<DailyCondition> {
    try {
      const updateData = {
        sleep_hours: sleepHours,
        steps: steps,
        fitbit_sync_date: new Date().toISOString()
      }

      return await this.createOrUpdateCondition(userId, date, updateData)
    } catch (error) {
      throw new Error(`Failed to update Fitbit data: ${error}`)
    }
  }

  async updateSubjectiveData(
    userId: string,
    date: string,
    subjectiveMood?: 'excellent' | 'good' | 'fair' | 'poor',
    energyLevel?: number,
    notes?: string
  ): Promise<DailyCondition> {
    try {
      const updateData: Partial<DailyCondition> = {}
      
      if (subjectiveMood !== undefined) {
        updateData.subjective_mood = subjectiveMood
      }
      
      if (energyLevel !== undefined) {
        if (energyLevel < 1 || energyLevel > 5) {
          throw new Error('Energy level must be between 1 and 5')
        }
        updateData.energy_level = energyLevel
      }
      
      if (notes !== undefined) {
        updateData.notes = notes
      }

      return await this.createOrUpdateCondition(userId, date, updateData)
    } catch (error) {
      throw new Error(`Failed to update subjective data: ${error}`)
    }
  }

  async getConditionsWithFitbitData(userId: string, startDate: string, endDate: string): Promise<DailyCondition[]> {
    try {
      return await this.table
        .where('user_id')
        .equals(userId)
        .and(condition => 
          condition.date >= startDate && 
          condition.date <= endDate &&
          condition.fitbit_sync_date !== undefined
        )
        .sortBy('date')
    } catch (error) {
      throw new Error(`Failed to get conditions with Fitbit data: ${error}`)
    }
  }

  async getConditionsWithSleepData(userId: string, startDate: string, endDate: string): Promise<DailyCondition[]> {
    try {
      return await this.table
        .where('user_id')
        .equals(userId)
        .and(condition => 
          condition.date >= startDate && 
          condition.date <= endDate &&
          condition.sleep_hours !== undefined
        )
        .sortBy('date')
    } catch (error) {
      throw new Error(`Failed to get conditions with sleep data: ${error}`)
    }
  }

  async getConditionsByEnergyLevel(userId: string, energyLevel: number): Promise<DailyCondition[]> {
    try {
      return await this.table
        .where('user_id')
        .equals(userId)
        .and(condition => condition.energy_level === energyLevel)
        .reverse()
        .sortBy('date')
    } catch (error) {
      throw new Error(`Failed to get conditions by energy level: ${error}`)
    }
  }

  async getConditionsBySubjectiveMood(userId: string, mood: 'excellent' | 'good' | 'fair' | 'poor'): Promise<DailyCondition[]> {
    try {
      return await this.table
        .where('user_id')
        .equals(userId)
        .and(condition => condition.subjective_mood === mood)
        .reverse()
        .sortBy('date')
    } catch (error) {
      throw new Error(`Failed to get conditions by subjective mood: ${error}`)
    }
  }

  async getAverageSleepForPeriod(userId: string, startDate: string, endDate: string): Promise<number> {
    try {
      const conditions = await this.getConditionsWithSleepData(userId, startDate, endDate)
      
      if (conditions.length === 0) {
        return 0
      }

      const totalSleep = conditions.reduce((sum, condition) => sum + (condition.sleep_hours || 0), 0)
      return Math.round((totalSleep / conditions.length) * 100) / 100
    } catch (error) {
      throw new Error(`Failed to get average sleep for period: ${error}`)
    }
  }

  async getAverageStepsForPeriod(userId: string, startDate: string, endDate: string): Promise<number> {
    try {
      const conditions = await this.getByDateRange(userId, startDate, endDate)
      const conditionsWithSteps = conditions.filter(condition => condition.steps !== undefined)
      
      if (conditionsWithSteps.length === 0) {
        return 0
      }

      const totalSteps = conditionsWithSteps.reduce((sum, condition) => sum + (condition.steps || 0), 0)
      return Math.round(totalSteps / conditionsWithSteps.length)
    } catch (error) {
      throw new Error(`Failed to get average steps for period: ${error}`)
    }
  }

  async getAverageEnergyForPeriod(userId: string, startDate: string, endDate: string): Promise<number> {
    try {
      const conditions = await this.getByDateRange(userId, startDate, endDate)
      const conditionsWithEnergy = conditions.filter(condition => condition.energy_level !== undefined)
      
      if (conditionsWithEnergy.length === 0) {
        return 0
      }

      const totalEnergy = conditionsWithEnergy.reduce((sum, condition) => sum + (condition.energy_level || 0), 0)
      return Math.round((totalEnergy / conditionsWithEnergy.length) * 100) / 100
    } catch (error) {
      throw new Error(`Failed to get average energy for period: ${error}`)
    }
  }

  async getSleepTrend(userId: string, days: number = 7): Promise<{
    date: string
    sleepHours: number
    steps: number
    energyLevel: number
    subjectiveMood: string
  }[]> {
    try {
      const endDate = new Date()
      const startDate = new Date(endDate)
      startDate.setDate(startDate.getDate() - days)

      const conditions = await this.getByDateRange(
        userId,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      )

      return conditions.map(condition => ({
        date: condition.date,
        sleepHours: condition.sleep_hours || 0,
        steps: condition.steps || 0,
        energyLevel: condition.energy_level || 0,
        subjectiveMood: condition.subjective_mood || 'unknown'
      }))
    } catch (error) {
      throw new Error(`Failed to get sleep trend: ${error}`)
    }
  }

  async getConditionStatistics(userId: string, startDate: string, endDate: string): Promise<{
    totalDays: number
    daysWithFitbitData: number
    daysWithSleepData: number
    daysWithStepsData: number
    daysWithEnergyData: number
    daysWithSubjectiveMood: number
    averageSleepHours: number
    averageSteps: number
    averageEnergyLevel: number
    moodDistribution: Record<string, number>
  }> {
    try {
      const conditions = await this.getByDateRange(userId, startDate, endDate)
      
      const stats = conditions.reduce((acc, condition) => {
        acc.totalDays++
        
        if (condition.fitbit_sync_date) {
          acc.daysWithFitbitData++
        }
        
        if (condition.sleep_hours !== undefined) {
          acc.daysWithSleepData++
          acc.totalSleep += condition.sleep_hours
        }
        
        if (condition.steps !== undefined) {
          acc.daysWithStepsData++
          acc.totalSteps += condition.steps
        }
        
        if (condition.energy_level !== undefined) {
          acc.daysWithEnergyData++
          acc.totalEnergy += condition.energy_level
        }
        
        if (condition.subjective_mood) {
          acc.daysWithSubjectiveMood++
          acc.moodDistribution[condition.subjective_mood] = (acc.moodDistribution[condition.subjective_mood] || 0) + 1
        }
        
        return acc
      }, {
        totalDays: 0,
        daysWithFitbitData: 0,
        daysWithSleepData: 0,
        daysWithStepsData: 0,
        daysWithEnergyData: 0,
        daysWithSubjectiveMood: 0,
        totalSleep: 0,
        totalSteps: 0,
        totalEnergy: 0,
        moodDistribution: {} as Record<string, number>
      })

      return {
        totalDays: stats.totalDays,
        daysWithFitbitData: stats.daysWithFitbitData,
        daysWithSleepData: stats.daysWithSleepData,
        daysWithStepsData: stats.daysWithStepsData,
        daysWithEnergyData: stats.daysWithEnergyData,
        daysWithSubjectiveMood: stats.daysWithSubjectiveMood,
        averageSleepHours: stats.daysWithSleepData > 0 ? Math.round((stats.totalSleep / stats.daysWithSleepData) * 100) / 100 : 0,
        averageSteps: stats.daysWithStepsData > 0 ? Math.round(stats.totalSteps / stats.daysWithStepsData) : 0,
        averageEnergyLevel: stats.daysWithEnergyData > 0 ? Math.round((stats.totalEnergy / stats.daysWithEnergyData) * 100) / 100 : 0,
        moodDistribution: stats.moodDistribution
      }
    } catch (error) {
      throw new Error(`Failed to get condition statistics: ${error}`)
    }
  }

  async getRecentConditions(userId: string, limit: number = 7): Promise<DailyCondition[]> {
    try {
      return await this.table
        .where('user_id')
        .equals(userId)
        .reverse()
        .sortBy('date')
        .then(conditions => conditions.slice(0, limit))
    } catch (error) {
      throw new Error(`Failed to get recent conditions: ${error}`)
    }
  }

  async getConditionsNeedingSync(maxAge: number = 7): Promise<DailyCondition[]> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - maxAge)
      const cutoffDateString = cutoffDate.toISOString().split('T')[0]

      return await this.table
        .where('date')
        .above(cutoffDateString)
        .and(condition => condition.fitbit_sync_date === undefined)
        .sortBy('date')
    } catch (error) {
      throw new Error(`Failed to get conditions needing sync: ${error}`)
    }
  }

  async markFitbitSyncCompleted(userId: string, date: string): Promise<DailyCondition> {
    try {
      return await this.createOrUpdateCondition(userId, date, {
        fitbit_sync_date: new Date().toISOString()
      })
    } catch (error) {
      throw new Error(`Failed to mark Fitbit sync completed: ${error}`)
    }
  }

  async getBestSleepDays(userId: string, startDate: string, endDate: string, limit: number = 5): Promise<DailyCondition[]> {
    try {
      const conditions = await this.getConditionsWithSleepData(userId, startDate, endDate)
      return conditions
        .sort((a, b) => (b.sleep_hours || 0) - (a.sleep_hours || 0))
        .slice(0, limit)
    } catch (error) {
      throw new Error(`Failed to get best sleep days: ${error}`)
    }
  }

  async getWorstSleepDays(userId: string, startDate: string, endDate: string, limit: number = 5): Promise<DailyCondition[]> {
    try {
      const conditions = await this.getConditionsWithSleepData(userId, startDate, endDate)
      return conditions
        .sort((a, b) => (a.sleep_hours || 0) - (b.sleep_hours || 0))
        .slice(0, limit)
    } catch (error) {
      throw new Error(`Failed to get worst sleep days: ${error}`)
    }
  }

  async getConditionsWithNotes(userId: string): Promise<DailyCondition[]> {
    try {
      return await this.table
        .where('user_id')
        .equals(userId)
        .and(condition => Boolean(condition.notes) && condition.notes!.trim().length > 0)
        .reverse()
        .sortBy('date')
    } catch (error) {
      throw new Error(`Failed to get conditions with notes: ${error}`)
    }
  }

  async searchConditionsByNotes(userId: string, searchTerm: string): Promise<DailyCondition[]> {
    try {
      const searchQuery = searchTerm.toLowerCase()
      return await this.table
        .where('user_id')
        .equals(userId)
        .and(condition => Boolean(condition.notes) && condition.notes!.toLowerCase().includes(searchQuery))
        .reverse()
        .sortBy('date')
    } catch (error) {
      throw new Error(`Failed to search conditions by notes: ${error}`)
    }
  }
}

export const dailyConditionRepository = new DailyConditionRepository()
export { dailyConditionRepository as conditionRepository }
export default dailyConditionRepository