/**
 * WorkSessionRepository - WorkSession entity specific repository
 * Handles work session CRUD operations with timer and sync specific queries
 */

import { Table } from 'dexie'
import { db } from '../database'
import { BaseRepository } from './base-repository'
import { WorkSession, WorkSessionRepository as IWorkSessionRepository } from '@/types'

export class WorkSessionRepository
  extends BaseRepository<WorkSession>
  implements IWorkSessionRepository
{
  protected table: Table<WorkSession> = db.work_sessions
  protected entityType = 'work_session'

  async getByUserId(userId: string): Promise<WorkSession[]> {
    try {
      return await this.table.where('user_id').equals(userId).reverse().sortBy('start_time')
    } catch (error) {
      throw new Error(`Failed to get work sessions by user ID: ${error}`)
    }
  }

  async getByTaskId(taskId: string): Promise<WorkSession[]> {
    try {
      return await this.table.where('small_task_id').equals(taskId).sortBy('start_time')
    } catch (error) {
      throw new Error(`Failed to get work sessions by task ID: ${error}`)
    }
  }

  async getByDateRange(userId: string, startDate: string, endDate: string): Promise<WorkSession[]> {
    try {
      return await this.table
        .where('user_id')
        .equals(userId)
        .and(session => session.start_time >= startDate && session.start_time <= endDate)
        .sortBy('start_time')
    } catch (error) {
      throw new Error(`Failed to get work sessions by date range: ${error}`)
    }
  }

  async getActiveSession(userId: string): Promise<WorkSession | undefined> {
    try {
      // userIdが無効な場合は早期リターン
      if (!userId || typeof userId !== 'string') {
        console.warn('Invalid userId provided to getActiveSession:', userId)
        return undefined
      }
      
      const sessions = await this.table
        .where('user_id')
        .equals(userId)
        .toArray()
      
      // アクティブなセッション（開始時刻があり、終了時刻がない）を探す
      return sessions.find(session => session.start_time && !session.end_time)
    } catch (error) {
      console.error('getActiveSession error:', error)
      throw new Error(`Failed to get active session: ${error}`)
    }
  }

  async getUnsyncedSessions(): Promise<WorkSession[]> {
    try {
      return await this.table.where('is_synced').equals(0).sortBy('start_time')
    } catch (error) {
      throw new Error(`Failed to get unsynced sessions: ${error}`)
    }
  }

  async getSessionsForDate(userId: string, date: string): Promise<WorkSession[]> {
    try {
      const startOfDay = `${date}T00:00:00.000Z`
      const endOfDay = `${date}T23:59:59.999Z`

      return await this.table
        .where('user_id')
        .equals(userId)
        .and(session => session.start_time >= startOfDay && session.start_time <= endOfDay)
        .sortBy('start_time')
    } catch (error) {
      throw new Error(`Failed to get sessions for date: ${error}`)
    }
  }

  async getCompletedSessions(userId: string): Promise<WorkSession[]> {
    try {
      return await this.table
        .where('user_id')
        .equals(userId)
        .and(session => session.end_time !== undefined)
        .reverse()
        .sortBy('end_time')
    } catch (error) {
      throw new Error(`Failed to get completed sessions: ${error}`)
    }
  }

  async getSessionsByFocusLevel(userId: string, minFocusLevel: number): Promise<WorkSession[]> {
    try {
      return await this.table
        .where('user_id')
        .equals(userId)
        .and(session => session.focus_level !== undefined && session.focus_level >= minFocusLevel)
        .reverse()
        .sortBy('start_time')
    } catch (error) {
      throw new Error(`Failed to get sessions by focus level: ${error}`)
    }
  }

  async getSessionsByDuration(
    userId: string,
    minDuration: number,
    maxDuration?: number
  ): Promise<WorkSession[]> {
    try {
      return await this.table
        .where('user_id')
        .equals(userId)
        .and(session => {
          if (maxDuration !== undefined) {
            return (
              session.duration_minutes >= minDuration && session.duration_minutes <= maxDuration
            )
          }
          return session.duration_minutes >= minDuration
        })
        .reverse()
        .sortBy('start_time')
    } catch (error) {
      throw new Error(`Failed to get sessions by duration: ${error}`)
    }
  }

  async startSession(userId: string, taskId?: string, startTime?: string, taskDescription?: string): Promise<WorkSession> {
    try {
      const activeSession = await this.getActiveSession(userId)
      if (activeSession) {
        throw new Error('Another session is already active')
      }

      const sessionData = {
        user_id: userId,
        small_task_id: taskId,
        start_time: startTime || new Date().toISOString(),
        duration_minutes: 0,
        task_description: taskDescription,
        is_synced: false,
      }

      return await this.create(sessionData)
    } catch (error) {
      throw new Error(`Failed to start session: ${error}`)
    }
  }

  async endSession(sessionId: string, endTime?: string, focusLevel?: number): Promise<WorkSession> {
    try {
      const session = await this.getById(sessionId)
      if (!session) {
        throw new Error('Session not found')
      }

      if (session.end_time) {
        throw new Error('Session is already ended')
      }

      const actualEndTime = endTime || new Date().toISOString()
      const durationMinutes = Math.round(
        (new Date(actualEndTime).getTime() - new Date(session.start_time).getTime()) / (1000 * 60)
      )

      const updates: Partial<WorkSession> = {
        end_time: actualEndTime,
        duration_minutes: durationMinutes,
        is_synced: false,
      }

      if (focusLevel !== undefined) {
        updates.focus_level = focusLevel
      }

      return await this.update(sessionId, updates)
    } catch (error) {
      throw new Error(`Failed to end session: ${error}`)
    }
  }

  async pauseSession(sessionId: string): Promise<WorkSession> {
    try {
      const session = await this.getById(sessionId)
      if (!session) {
        throw new Error('Session not found')
      }

      if (session.end_time) {
        throw new Error('Session is already ended')
      }

      const pauseTime = new Date().toISOString()
      const currentDuration = Math.round(
        (new Date(pauseTime).getTime() - new Date(session.start_time).getTime()) / (1000 * 60)
      )

      return await this.update(sessionId, {
        duration_minutes: currentDuration,
        is_synced: false,
      })
    } catch (error) {
      throw new Error(`Failed to pause session: ${error}`)
    }
  }

  async resumeSession(sessionId: string): Promise<WorkSession> {
    try {
      const session = await this.getById(sessionId)
      if (!session) {
        throw new Error('Session not found')
      }

      if (session.end_time) {
        throw new Error('Cannot resume ended session')
      }

      return await this.update(sessionId, {
        start_time: new Date().toISOString(),
        is_synced: false,
      })
    } catch (error) {
      throw new Error(`Failed to resume session: ${error}`)
    }
  }

  async addMoodNotes(sessionId: string, moodNotes: string): Promise<WorkSession> {
    try {
      return await this.update(sessionId, {
        mood_notes: moodNotes,
        is_synced: false,
      })
    } catch (error) {
      throw new Error(`Failed to add mood notes: ${error}`)
    }
  }

  async updateFocusLevel(sessionId: string, focusLevel: number): Promise<WorkSession> {
    try {
      if (focusLevel < 1 || focusLevel > 9) {
        throw new Error('Focus level must be between 1 and 9')
      }

      return await this.update(sessionId, {
        focus_level: focusLevel,
        is_synced: false,
      })
    } catch (error) {
      throw new Error(`Failed to update focus level: ${error}`)
    }
  }

  async markAsSynced(sessionId: string): Promise<WorkSession> {
    try {
      return await this.update(sessionId, { is_synced: true })
    } catch (error) {
      throw new Error(`Failed to mark session as synced: ${error}`)
    }
  }

  async bulkMarkAsSynced(sessionIds: string[]): Promise<WorkSession[]> {
    try {
      const updates = sessionIds.map(id => ({
        id,
        data: { is_synced: true },
      }))

      return await this.bulkUpdate(updates)
    } catch (error) {
      throw new Error(`Failed to bulk mark sessions as synced: ${error}`)
    }
  }

  async getSessionStatistics(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    totalSessions: number
    totalDuration: number
    averageDuration: number
    averageFocusLevel: number
    sessionsWithTasks: number
    sessionsWithoutTasks: number
    syncedSessions: number
    unsyncedSessions: number
  }> {
    try {
      const sessions = await this.getByDateRange(userId, startDate, endDate)

      const stats = sessions.reduce(
        (acc, session) => {
          acc.totalSessions++
          acc.totalDuration += session.duration_minutes

          if (session.focus_level !== undefined) {
            acc.focusLevelSum += session.focus_level
            acc.focusLevelCount++
          }

          if (session.small_task_id) {
            acc.sessionsWithTasks++
          } else {
            acc.sessionsWithoutTasks++
          }

          if (session.is_synced) {
            acc.syncedSessions++
          } else {
            acc.unsyncedSessions++
          }

          return acc
        },
        {
          totalSessions: 0,
          totalDuration: 0,
          focusLevelSum: 0,
          focusLevelCount: 0,
          sessionsWithTasks: 0,
          sessionsWithoutTasks: 0,
          syncedSessions: 0,
          unsyncedSessions: 0,
        }
      )

      return {
        totalSessions: stats.totalSessions,
        totalDuration: stats.totalDuration,
        averageDuration: stats.totalSessions > 0 ? stats.totalDuration / stats.totalSessions : 0,
        averageFocusLevel:
          stats.focusLevelCount > 0 ? stats.focusLevelSum / stats.focusLevelCount : 0,
        sessionsWithTasks: stats.sessionsWithTasks,
        sessionsWithoutTasks: stats.sessionsWithoutTasks,
        syncedSessions: stats.syncedSessions,
        unsyncedSessions: stats.unsyncedSessions,
      }
    } catch (error) {
      throw new Error(`Failed to get session statistics: ${error}`)
    }
  }

  async getSessionsByTask(userId: string, taskId: string): Promise<WorkSession[]> {
    try {
      return await this.table
        .where('user_id')
        .equals(userId)
        .and(session => session.small_task_id === taskId)
        .sortBy('start_time')
    } catch (error) {
      throw new Error(`Failed to get sessions by task: ${error}`)
    }
  }

  async getTotalWorkTime(userId: string, startDate: string, endDate: string): Promise<number> {
    try {
      const sessions = await this.getByDateRange(userId, startDate, endDate)
      return sessions
        .filter(session => session.end_time)
        .reduce((total, session) => total + session.duration_minutes, 0)
    } catch (error) {
      throw new Error(`Failed to get total work time: ${error}`)
    }
  }

  async getSessionsWithMood(userId: string): Promise<WorkSession[]> {
    try {
      return await this.table
        .where('user_id')
        .equals(userId)
        .and(session => Boolean(session.mood_notes) && session.mood_notes!.trim().length > 0)
        .reverse()
        .sortBy('start_time')
    } catch (error) {
      throw new Error(`Failed to get sessions with mood notes: ${error}`)
    }
  }

  async getRecentSessions(userId: string, limit: number = 10): Promise<WorkSession[]> {
    try {
      return await this.table
        .where('user_id')
        .equals(userId)
        .reverse()
        .sortBy('start_time')
        .then(sessions => sessions.slice(0, limit))
    } catch (error) {
      throw new Error(`Failed to get recent sessions: ${error}`)
    }
  }

  async getDailySessionCount(userId: string, date: string): Promise<number> {
    try {
      const sessions = await this.getSessionsForDate(userId, date)
      return sessions.length
    } catch (error) {
      throw new Error(`Failed to get daily session count: ${error}`)
    }
  }

  async getLongestSession(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<WorkSession | undefined> {
    try {
      const sessions = await this.getByDateRange(userId, startDate, endDate)
      return sessions
        .filter(session => session.end_time)
        .reduce(
          (longest, session) =>
            !longest || session.duration_minutes > longest.duration_minutes ? session : longest,
          undefined as WorkSession | undefined
        )
    } catch (error) {
      throw new Error(`Failed to get longest session: ${error}`)
    }
  }
}

export const workSessionRepository = new WorkSessionRepository()
export { workSessionRepository as sessionRepository }
export default workSessionRepository
