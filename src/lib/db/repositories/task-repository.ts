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
  BigTaskRepository as IBigTaskRepository,
  SmallTaskRepository as ISmallTaskRepository 
} from '@/types'

export class BigTaskRepository extends BaseRepository<BigTask> implements IBigTaskRepository {
  protected table: Table<BigTask> = db.big_tasks
  protected entityType = 'big_task'

  async getByProjectId(projectId: string): Promise<BigTask[]> {
    try {
      return await this.table
        .where('project_id')
        .equals(projectId)
        .sortBy('week_number')
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
      return await this.table
        .where('user_id')
        .equals(userId)
        .reverse()
        .sortBy('updated_at')
    } catch (error) {
      throw new Error(`Failed to get big tasks by user: ${error}`)
    }
  }

  async getTasksByWeekRange(projectId: string, startWeek: number, endWeek: number): Promise<BigTask[]> {
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
      
      const progress = smallTasks.reduce((acc, task) => {
        acc.totalSmallTasks++
        if (task.actual_end) {
          acc.completedSmallTasks++
        }
        acc.estimatedMinutes += task.estimated_minutes
        acc.actualMinutes += task.actual_minutes || 0
        return acc
      }, {
        totalSmallTasks: 0,
        completedSmallTasks: 0,
        progressPercentage: 0,
        estimatedMinutes: 0,
        actualMinutes: 0
      })

      progress.progressPercentage = progress.totalSmallTasks > 0 
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
    const pastDaysOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000))
    return Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7)
  }

  private getProjectStartWeek(projectCreatedAt: string): number {
    const createdDate = new Date(projectCreatedAt)
    const startOfYear = new Date(createdDate.getFullYear(), 0, 1)
    const pastDaysOfYear = Math.floor((createdDate.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000))
    return Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7)
  }

  async getScheduledForDate(userId: string, date: string): Promise<SmallTask[]> {
    const smallTaskRepo = new SmallTaskRepository()
    return await smallTaskRepo.getScheduledForDate(userId, date)
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
      return await this.table
        .where('big_task_id')
        .equals(bigTaskId)
        .sortBy('scheduled_start')
    } catch (error) {
      throw new Error(`Failed to get small tasks by big task ID: ${error}`)
    }
  }

  async getByDateRange(userId: string, startDate: string, endDate: string): Promise<SmallTask[]> {
    try {
      return await this.table
        .where('user_id')
        .equals(userId)
        .and(task => task.scheduled_start >= startDate && task.scheduled_start <= endDate)
        .sortBy('scheduled_start')
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
      return await this.table
        .where('user_id')
        .equals(userId)
        .and(task => Boolean(task.actual_start) && !task.actual_end)
        .sortBy('actual_start')
    } catch (error) {
      throw new Error(`Failed to get active tasks: ${error}`)
    }
  }

  async getCompletedTasks(userId: string): Promise<SmallTask[]> {
    try {
      return await this.table
        .where('user_id')
        .equals(userId)
        .and(task => task.actual_end !== undefined)
        .reverse()
        .sortBy('actual_end')
    } catch (error) {
      throw new Error(`Failed to get completed tasks: ${error}`)
    }
  }

  async getTasksByFocusLevel(userId: string, minFocusLevel: number): Promise<SmallTask[]> {
    try {
      return await this.table
        .where('user_id')
        .equals(userId)
        .and(task => task.focus_level !== undefined && task.focus_level >= minFocusLevel)
        .reverse()
        .sortBy('updated_at')
    } catch (error) {
      throw new Error(`Failed to get tasks by focus level: ${error}`)
    }
  }

  async getOverdueTasks(userId: string): Promise<SmallTask[]> {
    try {
      const now = new Date().toISOString()
      return await this.table
        .where('user_id')
        .equals(userId)
        .and(task => task.scheduled_end < now && !Boolean(task.actual_end))
        .sortBy('scheduled_end')
    } catch (error) {
      throw new Error(`Failed to get overdue tasks: ${error}`)
    }
  }

  async getTasksByVarianceRatio(userId: string, minRatio: number, maxRatio: number): Promise<SmallTask[]> {
    try {
      return await this.table
        .where('user_id')
        .equals(userId)
        .and(task => 
          task.variance_ratio !== undefined && 
          task.variance_ratio >= minRatio && 
          task.variance_ratio <= maxRatio
        )
        .reverse()
        .sortBy('updated_at')
    } catch (error) {
      throw new Error(`Failed to get tasks by variance ratio: ${error}`)
    }
  }

  async startTask(taskId: string, startTime?: string): Promise<SmallTask> {
    try {
      const actualStart = startTime || new Date().toISOString()
      return await this.update(taskId, { actual_start: actualStart })
    } catch (error) {
      throw new Error(`Failed to start task: ${error}`)
    }
  }

  async completeTask(taskId: string, endTime?: string, focusLevel?: number): Promise<SmallTask> {
    try {
      const actualEnd = endTime || new Date().toISOString()
      const task = await this.getById(taskId)
      
      if (!task) {
        throw new Error('Task not found')
      }

      const actualStart = task.actual_start || task.scheduled_start
      const actualMinutes = Math.round((new Date(actualEnd).getTime() - new Date(actualStart).getTime()) / (1000 * 60))
      const varianceRatio = actualMinutes / task.estimated_minutes

      const updates: Partial<SmallTask> = {
        actual_end: actualEnd,
        actual_minutes: actualMinutes,
        variance_ratio: varianceRatio
      }

      if (focusLevel !== undefined) {
        updates.focus_level = focusLevel
      }

      return await this.update(taskId, updates)
    } catch (error) {
      throw new Error(`Failed to complete task: ${error}`)
    }
  }

  async rescheduleTask(taskId: string, newStartTime: string, newEndTime: string): Promise<SmallTask> {
    try {
      return await this.update(taskId, {
        scheduled_start: newStartTime,
        scheduled_end: newEndTime
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

  async getTaskStatistics(userId: string, startDate: string, endDate: string): Promise<{
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
      
      const stats = tasks.reduce((acc, task) => {
        acc.totalTasks++
        
        if (task.actual_end) {
          acc.completedTasks++
        }
        
        if (task.is_emergency) {
          acc.emergencyTasks++
        }
        
        if (task.focus_level !== undefined) {
          acc.focusLevelSum += task.focus_level
          acc.focusLevelCount++
        }
        
        acc.totalEstimatedMinutes += task.estimated_minutes
        acc.totalActualMinutes += task.actual_minutes || 0
        
        if (task.variance_ratio !== undefined) {
          acc.varianceRatioSum += task.variance_ratio
          acc.varianceRatioCount++
        }
        
        return acc
      }, {
        totalTasks: 0,
        completedTasks: 0,
        emergencyTasks: 0,
        focusLevelSum: 0,
        focusLevelCount: 0,
        totalEstimatedMinutes: 0,
        totalActualMinutes: 0,
        varianceRatioSum: 0,
        varianceRatioCount: 0
      })

      return {
        totalTasks: stats.totalTasks,
        completedTasks: stats.completedTasks,
        emergencyTasks: stats.emergencyTasks,
        averageFocusLevel: stats.focusLevelCount > 0 ? stats.focusLevelSum / stats.focusLevelCount : 0,
        totalEstimatedMinutes: stats.totalEstimatedMinutes,
        totalActualMinutes: stats.totalActualMinutes,
        averageVarianceRatio: stats.varianceRatioCount > 0 ? stats.varianceRatioSum / stats.varianceRatioCount : 0
      }
    } catch (error) {
      throw new Error(`Failed to get task statistics: ${error}`)
    }
  }
}

export const bigTaskRepository = new BigTaskRepository()
export const smallTaskRepository = new SmallTaskRepository()
export { bigTaskRepository as taskRepository }

const taskRepositories = { bigTaskRepository, smallTaskRepository }
export default taskRepositories