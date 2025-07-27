/**
 * TaskRepository - BigTask and SmallTask entity specific repositories
 * Handles task CRUD operations with project and schedule specific queries
 */

import { Table } from 'dexie'
import { db } from '../database'
import { BaseRepository } from './base-repository'
import {
  BigTask,
  SmallTask,
  SmallTaskStatus,
  BigTaskRepository as IBigTaskRepository,
  SmallTaskRepository as ISmallTaskRepository,
  WorkSession,
} from '@/types'
import { dateUtils } from '@/lib/utils/date-utils'
import {
  isTaskActive,
  isTaskCompleted,
  getTaskTotalMinutes,
  enrichTasksWithSessions,
} from '@/lib/utils/task-session-utils'

export class BigTaskRepository extends BaseRepository<BigTask> implements IBigTaskRepository {
  protected table: Table<BigTask> = db.big_tasks
  protected entityType = 'big_task'

  async getByProjectId(projectId: string): Promise<BigTask[]> {
    try {
      return await this.table.where('project_id').equals(projectId).sortBy('week_number')
    } catch (error) {
      throw new Error(`Failed to get big tasks by project ID: ${error}`)
    }
  }

  async getByWeekNumber(projectId: string, weekNumber: number): Promise<BigTask[]> {
    try {
      return await this.table
        .where('project_id')
        .equals(projectId)
        .and(task => task.week_number === weekNumber)
        .reverse()
        .sortBy('created_at')
    } catch (error) {
      throw new Error(`Failed to get big tasks by week number: ${error}`)
    }
  }

  async getByStatus(projectId: string, status: BigTask['status']): Promise<BigTask[]> {
    try {
      return await this.table
        .where('project_id')
        .equals(projectId)
        .and(task => task.status === status)
        .reverse()
        .sortBy('updated_at')
    } catch (error) {
      throw new Error(`Failed to get big tasks by status: ${error}`)
    }
  }

  async getActiveTasksByProject(projectId: string): Promise<BigTask[]> {
    try {
      return await this.table
        .where('project_id')
        .equals(projectId)
        .and(task => task.status === 'active')
        .reverse()
        .sortBy('updated_at')
    } catch (error) {
      throw new Error(`Failed to get active big tasks: ${error}`)
    }
  }

  async getTasksByUser(userId: string): Promise<BigTask[]> {
    try {
      return await this.table.where('user_id').equals(userId).reverse().sortBy('updated_at')
    } catch (error) {
      throw new Error(`Failed to get big tasks by user: ${error}`)
    }
  }

  async getTasksByWeekRange(
    projectId: string,
    startWeek: number,
    endWeek: number
  ): Promise<BigTask[]> {
    try {
      return await this.table
        .where('project_id')
        .equals(projectId)
        .and(task => task.week_number >= startWeek && task.week_number <= endWeek)
        .sortBy('week_number')
    } catch (error) {
      throw new Error(`Failed to get big tasks by week range: ${error}`)
    }
  }

  async updateTaskStatus(taskId: string, status: BigTask['status']): Promise<BigTask> {
    try {
      return await this.update(taskId, { status })
    } catch (error) {
      throw new Error(`Failed to update big task status: ${error}`)
    }
  }

  async updateActualHours(taskId: string, actualHours: number): Promise<BigTask> {
    try {
      return await this.update(taskId, { actual_hours: actualHours })
    } catch (error) {
      throw new Error(`Failed to update actual hours: ${error}`)
    }
  }

  async getTaskProgress(taskId: string): Promise<{
    totalSmallTasks: number
    completedSmallTasks: number
    progressPercentage: number
    estimatedMinutes: number
    actualMinutes: number
  }> {
    try {
      const smallTasks = await db.small_tasks.where('big_task_id').equals(taskId).toArray()

      const progress = smallTasks.reduce(
        (acc, task) => {
          acc.totalSmallTasks++
          if (task.actual_end) {
            acc.completedSmallTasks++
          }
          acc.estimatedMinutes += task.estimated_minutes
          acc.actualMinutes += task.actual_minutes || 0
          return acc
        },
        {
          totalSmallTasks: 0,
          completedSmallTasks: 0,
          progressPercentage: 0,
          estimatedMinutes: 0,
          actualMinutes: 0,
        }
      )

      progress.progressPercentage =
        progress.totalSmallTasks > 0
          ? Math.round((progress.completedSmallTasks / progress.totalSmallTasks) * 100)
          : 0

      return progress
    } catch (error) {
      throw new Error(`Failed to get task progress: ${error}`)
    }
  }

  async getOverdueTasks(userId: string): Promise<BigTask[]> {
    try {
      const projects = await db.projects.where('user_id').equals(userId).toArray()
      const projectIds = projects.map(p => p.id)

      const allTasks = await this.table
        .where('project_id')
        .anyOf(projectIds)
        .and(task => task.status !== 'completed')
        .toArray()

      const currentWeek = this.getCurrentWeekNumber()

      return allTasks.filter(task => {
        const project = projects.find(p => p.id === task.project_id)
        if (!project) return false

        const projectStartWeek = this.getProjectStartWeek(project.created_at)
        const taskAbsoluteWeek = projectStartWeek + task.week_number - 1

        return taskAbsoluteWeek < currentWeek
      })
    } catch (error) {
      throw new Error(`Failed to get overdue tasks: ${error}`)
    }
  }

  private getCurrentWeekNumber(): number {
    const now = new Date()
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const pastDaysOfYear = Math.floor(
      (now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)
    )
    return Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7)
  }

  private getProjectStartWeek(projectCreatedAt: string): number {
    const createdDate = new Date(projectCreatedAt)
    const startOfYear = new Date(createdDate.getFullYear(), 0, 1)
    const pastDaysOfYear = Math.floor(
      (createdDate.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)
    )
    return Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7)
  }

  async getScheduledForDate(userId: string, date: string): Promise<SmallTask[]> {
    const smallTaskRepo = new SmallTaskRepository()
    return await smallTaskRepo.getScheduledForDate(userId, date)
  }

  async getByDateRange(userId: string, startDate: string, endDate: string): Promise<BigTask[]> {
    try {
      // 日付フォーマットの簡易チェック
      if (!dateUtils.isValidDateString(startDate) || !dateUtils.isValidDateString(endDate)) {
        throw new Error('Invalid date format. Expected YYYY-MM-DD')
      }

      return await this.table
        .where('user_id')
        .equals(userId)
        .and(task => {
          // start_dateとend_dateが存在しない場合は後方互換性のためスキップ
          if (!task.start_date || !task.end_date) return false
          
          // タスクの期間が指定された日付範囲と重なるかチェック
          const taskStart = dateUtils.toJSTDate(task.start_date).getTime()
          const taskEnd = dateUtils.toJSTDate(task.end_date).getTime()
          const rangeStart = dateUtils.toJSTDate(startDate).getTime()
          const rangeEnd = dateUtils.toJSTDate(endDate).getTime()
          
          // タスクが日付範囲と重なる場合
          return taskStart <= rangeEnd && taskEnd >= rangeStart
        })
        .sortBy('start_date')
    } catch (error) {
      throw new Error(`Failed to get big tasks by date range: ${error}`)
    }
  }
}

export class SmallTaskRepository extends BaseRepository<SmallTask> implements ISmallTaskRepository {
  protected table: Table<SmallTask> = db.small_tasks
  protected entityType = 'small_task'

  async getScheduledForDate(userId: string, date: string): Promise<SmallTask[]> {
    try {
      const startOfDay = `${date}T00:00:00.000Z`
      const endOfDay = `${date}T23:59:59.999Z`

      return await this.table
        .where('user_id')
        .equals(userId)
        .and(task => task.scheduled_start >= startOfDay && task.scheduled_start <= endOfDay)
        .sortBy('scheduled_start')
    } catch (error) {
      throw new Error(`Failed to get tasks scheduled for date: ${error}`)
    }
  }

  async getByBigTaskId(bigTaskId: string): Promise<SmallTask[]> {
    try {
      return await this.table.where('big_task_id').equals(bigTaskId).sortBy('scheduled_start')
    } catch (error) {
      throw new Error(`Failed to get small tasks by big task ID: ${error}`)
    }
  }

  async getByDateRange(userId: string, startDate: string, endDate: string): Promise<SmallTask[]> {
    try {
      // startDateとendDateをISO形式の日時に変換
      const startDateTime = `${startDate}T00:00:00.000Z`
      const endDateTime = `${endDate}T23:59:59.999Z`
      
      console.log('getByDateRange:', {
        userId,
        startDate,
        endDate,
        startDateTime,
        endDateTime
      })
      
      const tasks = await this.table
        .where('user_id')
        .equals(userId)
        .and(task => {
          // scheduled_startがnullまたは空文字の場合はスキップ
          if (!task.scheduled_start) return false
          
          // ISO形式の日時として比較
          return task.scheduled_start >= startDateTime && task.scheduled_start <= endDateTime
        })
        .sortBy('scheduled_start')
        
      console.log(`Found ${tasks.length} tasks for date range`)
      return tasks
    } catch (error) {
      throw new Error(`Failed to get small tasks by date range: ${error}`)
    }
  }

  async getEmergencyTasks(userId: string): Promise<SmallTask[]> {
    try {
      return await this.table
        .where('user_id')
        .equals(userId)
        .and(task => task.is_emergency === true)
        .reverse()
        .sortBy('created_at')
    } catch (error) {
      throw new Error(`Failed to get emergency tasks: ${error}`)
    }
  }

  async getActiveTasks(userId: string): Promise<SmallTask[]> {
    try {
      const tasks = await this.table.where('user_id').equals(userId).toArray()
      const sessions = await db.work_sessions.where('user_id').equals(userId).toArray()
      
      // Filter tasks that have active sessions
      const activeTasks = tasks.filter(task => isTaskActive(task.id, sessions))
      
      // Sort by the start time of the active session
      return activeTasks.sort((a, b) => {
        const aSession = sessions.find(s => s.small_task_id === a.id && !s.end_time)
        const bSession = sessions.find(s => s.small_task_id === b.id && !s.end_time)
        return (aSession?.start_time || '').localeCompare(bSession?.start_time || '')
      })
    } catch (error) {
      throw new Error(`Failed to get active tasks: ${error}`)
    }
  }

  async getCompletedTasks(userId: string): Promise<SmallTask[]> {
    try {
      const tasks = await this.table.where('user_id').equals(userId).toArray()
      const sessions = await db.work_sessions.where('user_id').equals(userId).toArray()
      
      // Filter tasks that have completed sessions
      const completedTasks = tasks.filter(task => isTaskCompleted(task.id, sessions))
      
      // Sort by the latest end time
      return completedTasks.sort((a, b) => {
        const aEndTime = sessions
          .filter(s => s.small_task_id === a.id && s.end_time)
          .sort((x, y) => (y.end_time || '').localeCompare(x.end_time || ''))[0]?.end_time || ''
        const bEndTime = sessions
          .filter(s => s.small_task_id === b.id && s.end_time)
          .sort((x, y) => (y.end_time || '').localeCompare(x.end_time || ''))[0]?.end_time || ''
        return bEndTime.localeCompare(aEndTime)
      })
    } catch (error) {
      throw new Error(`Failed to get completed tasks: ${error}`)
    }
  }

  async getTasksByFocusLevel(userId: string, minFocusLevel: number): Promise<SmallTask[]> {
    try {
      // Focus level is now tracked in WorkSession, not SmallTask
      const tasks = await this.table.where('user_id').equals(userId).toArray()
      const sessions = await db.work_sessions
        .where('user_id')
        .equals(userId)
        .and(session => session.focus_level !== undefined && session.focus_level >= minFocusLevel)
        .toArray()
      
      // Get unique task IDs from sessions with high focus level
      const taskIds = new Set(sessions.map(s => s.small_task_id).filter(Boolean))
      
      return tasks
        .filter(task => taskIds.has(task.id))
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    } catch (error) {
      throw new Error(`Failed to get tasks by focus level: ${error}`)
    }
  }

  async getOverdueTasks(userId: string): Promise<SmallTask[]> {
    try {
      const now = new Date().toISOString()
      const tasks = await this.table
        .where('user_id')
        .equals(userId)
        .and(task => task.scheduled_end < now)
        .toArray()
      const sessions = await db.work_sessions.where('user_id').equals(userId).toArray()
      
      // Filter out completed tasks
      const overdueTasks = tasks.filter(task => !isTaskCompleted(task.id, sessions))
      
      return overdueTasks.sort((a, b) => a.scheduled_end.localeCompare(b.scheduled_end))
    } catch (error) {
      throw new Error(`Failed to get overdue tasks: ${error}`)
    }
  }

  async getTasksByVarianceRatio(
    userId: string,
    minRatio: number,
    maxRatio: number
  ): Promise<SmallTask[]> {
    try {
      const tasks = await this.table.where('user_id').equals(userId).toArray()
      const sessions = await db.work_sessions.where('user_id').equals(userId).toArray()
      
      // Calculate variance ratio based on sessions
      const tasksWithVariance = tasks.filter(task => {
        const totalMinutes = getTaskTotalMinutes(task.id, sessions)
        if (totalMinutes === 0) return false
        
        const varianceRatio = totalMinutes / task.estimated_minutes
        return varianceRatio >= minRatio && varianceRatio <= maxRatio
      })
      
      return tasksWithVariance.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    } catch (error) {
      throw new Error(`Failed to get tasks by variance ratio: ${error}`)
    }
  }

  // Deprecated: Use WorkSessionRepository.startSession instead
  async startTask(taskId: string, startTime?: string): Promise<SmallTask> {
    console.warn('SmallTaskRepository.startTask is deprecated. Use WorkSessionRepository.startSession instead.')
    const task = await this.getById(taskId)
    if (!task) throw new Error('Task not found')
    return task
  }

  // Deprecated: Use WorkSessionRepository.endSession instead
  async completeTask(taskId: string, endTime?: string, focusLevel?: number): Promise<SmallTask> {
    console.warn('SmallTaskRepository.completeTask is deprecated. Use WorkSessionRepository.endSession instead.')
    const task = await this.getById(taskId)
    if (!task) throw new Error('Task not found')
    return task
  }

  async rescheduleTask(
    taskId: string,
    newStartTime: string,
    newEndTime: string
  ): Promise<SmallTask> {
    try {
      return await this.update(taskId, {
        scheduled_start: newStartTime,
        scheduled_end: newEndTime,
      })
    } catch (error) {
      throw new Error(`Failed to reschedule task: ${error}`)
    }
  }

  async getTasksForWeek(userId: string, weekStartDate: string): Promise<SmallTask[]> {
    try {
      const weekStart = new Date(weekStartDate)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)

      return await this.getByDateRange(userId, weekStart.toISOString(), weekEnd.toISOString())
    } catch (error) {
      throw new Error(`Failed to get tasks for week: ${error}`)
    }
  }

  async getTaskStatistics(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    totalTasks: number
    completedTasks: number
    emergencyTasks: number
    averageFocusLevel: number
    totalEstimatedMinutes: number
    totalActualMinutes: number
    averageVarianceRatio: number
  }> {
    try {
      const tasks = await this.getByDateRange(userId, startDate, endDate)
      const sessions = await db.work_sessions
        .where('user_id')
        .equals(userId)
        .and(session => {
          const sessionStart = session.start_time
          return sessionStart >= startDate && sessionStart <= endDate
        })
        .toArray()

      const stats = tasks.reduce(
        (acc, task) => {
          acc.totalTasks++

          const taskSessions = sessions.filter(s => s.small_task_id === task.id)
          const isCompleted = isTaskCompleted(task.id, sessions)
          const totalMinutes = getTaskTotalMinutes(task.id, sessions)

          if (isCompleted) {
            acc.completedTasks++
          }

          if (task.is_emergency) {
            acc.emergencyTasks++
          }

          // Calculate average focus level from sessions
          const taskFocusLevels = taskSessions
            .filter(s => s.focus_level !== undefined)
            .map(s => s.focus_level as number)
          
          if (taskFocusLevels.length > 0) {
            acc.focusLevelSum += taskFocusLevels.reduce((sum, level) => sum + level, 0)
            acc.focusLevelCount += taskFocusLevels.length
          }

          acc.totalEstimatedMinutes += task.estimated_minutes
          acc.totalActualMinutes += totalMinutes

          if (totalMinutes > 0) {
            const varianceRatio = totalMinutes / task.estimated_minutes
            acc.varianceRatioSum += varianceRatio
            acc.varianceRatioCount++
          }

          return acc
        },
        {
          totalTasks: 0,
          completedTasks: 0,
          emergencyTasks: 0,
          focusLevelSum: 0,
          focusLevelCount: 0,
          totalEstimatedMinutes: 0,
          totalActualMinutes: 0,
          varianceRatioSum: 0,
          varianceRatioCount: 0,
        }
      )

      return {
        totalTasks: stats.totalTasks,
        completedTasks: stats.completedTasks,
        emergencyTasks: stats.emergencyTasks,
        averageFocusLevel:
          stats.focusLevelCount > 0 ? stats.focusLevelSum / stats.focusLevelCount : 0,
        totalEstimatedMinutes: stats.totalEstimatedMinutes,
        totalActualMinutes: stats.totalActualMinutes,
        averageVarianceRatio:
          stats.varianceRatioCount > 0 ? stats.varianceRatioSum / stats.varianceRatioCount : 0,
      }
    } catch (error) {
      throw new Error(`Failed to get task statistics: ${error}`)
    }
  }
  // New method to get tasks with their session information
  async getTasksWithSessions(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<{
    task: SmallTask
    sessions: WorkSession[]
    totalMinutes: number
    isActive: boolean
    isCompleted: boolean
  }[]> {
    try {
      let tasks: SmallTask[]
      if (startDate && endDate) {
        tasks = await this.getByDateRange(userId, startDate, endDate)
      } else {
        tasks = await this.table.where('user_id').equals(userId).toArray()
      }

      const sessions = await db.work_sessions.where('user_id').equals(userId).toArray()
      
      return enrichTasksWithSessions(tasks, sessions)
    } catch (error) {
      throw new Error(`Failed to get tasks with sessions: ${error}`)
    }
  }

  // Update task status
  async updateTaskStatus(
    taskId: string,
    status: SmallTaskStatus,
    options?: { endActiveSession?: boolean }
  ): Promise<SmallTask> {
    try {
      // If completing task and endActiveSession is true, end any active sessions
      if (status === 'completed' && options?.endActiveSession) {
        const sessions = await db.work_sessions
          .where('small_task_id')
          .equals(taskId)
          .and(session => !session.end_time)
          .toArray()
        
        if (sessions.length > 0) {
          const now = new Date().toISOString()
          for (const session of sessions) {
            const durationSeconds = Math.floor(
              (new Date(now).getTime() - new Date(session.start_time).getTime()) / 1000
            )
            await db.work_sessions.update(session.id, {
              end_time: now,
              duration_seconds: durationSeconds,
            })
          }
        }
      }

      return await this.update(taskId, { status })
    } catch (error) {
      throw new Error(`Failed to update task status: ${error}`)
    }
  }

  // Get tasks by status
  async getTasksByStatus(userId: string, status: SmallTaskStatus): Promise<SmallTask[]> {
    try {
      return await this.table
        .where('user_id')
        .equals(userId)
        .and(task => task.status === status)
        .sortBy('updated_at')
    } catch (error) {
      throw new Error(`Failed to get tasks by status: ${error}`)
    }
  }
}

export const bigTaskRepository = new BigTaskRepository()
export const smallTaskRepository = new SmallTaskRepository()
export { bigTaskRepository as taskRepository }

const taskRepositories = { bigTaskRepository, smallTaskRepository }
export default taskRepositories
