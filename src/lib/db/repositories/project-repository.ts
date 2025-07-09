/**
 * ProjectRepository - Project entity specific repository
 * Handles project CRUD operations with user-specific queries
 */

import { Table } from 'dexie'
import { db } from '../database'
import { BaseRepository } from './base-repository'
import { Project, ProjectRepository as IProjectRepository } from '@/types'

export class ProjectRepository extends BaseRepository<Project> implements IProjectRepository {
  protected table: Table<Project> = db.projects
  protected entityType = 'project'

  async getByUserId(userId: string): Promise<Project[]> {
    try {
      return await this.table
        .where('user_id')
        .equals(userId)
        .reverse()
        .sortBy('updated_at')
    } catch (error) {
      throw new Error(`Failed to get projects by user ID: ${error}`)
    }
  }

  async getByStatus(status: Project['status']): Promise<Project[]> {
    try {
      return await this.table
        .where('status')
        .equals(status)
        .reverse()
        .sortBy('updated_at')
    } catch (error) {
      throw new Error(`Failed to get projects by status: ${error}`)
    }
  }

  async getActiveProjects(userId: string): Promise<Project[]> {
    try {
      return await this.table
        .where('user_id')
        .equals(userId)
        .and(project => project.status === 'active')
        .reverse()
        .sortBy('updated_at')
    } catch (error) {
      throw new Error(`Failed to get active projects: ${error}`)
    }
  }

  async getProjectsByStatusAndUser(userId: string, status: Project['status']): Promise<Project[]> {
    try {
      return await this.table
        .where('user_id')
        .equals(userId)
        .and(project => project.status === status)
        .reverse()
        .sortBy('updated_at')
    } catch (error) {
      throw new Error(`Failed to get projects by status and user: ${error}`)
    }
  }

  async getProjectsByDeadline(userId: string, startDate: string, endDate: string): Promise<Project[]> {
    try {
      return await this.table
        .where('user_id')
        .equals(userId)
        .and(project => project.deadline >= startDate && project.deadline <= endDate)
        .reverse()
        .sortBy('deadline')
    } catch (error) {
      throw new Error(`Failed to get projects by deadline range: ${error}`)
    }
  }

  async getOverdueProjects(userId: string): Promise<Project[]> {
    try {
      const today = new Date().toISOString().split('T')[0]
      return await this.table
        .where('user_id')
        .equals(userId)
        .and(project => project.deadline < today && project.status !== 'completed')
        .reverse()
        .sortBy('deadline')
    } catch (error) {
      throw new Error(`Failed to get overdue projects: ${error}`)
    }
  }

  async getRecentProjects(userId: string, limit: number = 10): Promise<Project[]> {
    try {
      return await this.table
        .where('user_id')
        .equals(userId)
        .reverse()
        .sortBy('updated_at')
        .then(projects => projects.slice(0, limit))
    } catch (error) {
      throw new Error(`Failed to get recent projects: ${error}`)
    }
  }

  async getProjectsWithEstimates(userId: string): Promise<Project[]> {
    try {
      return await this.table
        .where('user_id')
        .equals(userId)
        .and(project => project.estimated_total_hours !== undefined && project.estimated_total_hours > 0)
        .reverse()
        .sortBy('updated_at')
    } catch (error) {
      throw new Error(`Failed to get projects with estimates: ${error}`)
    }
  }

  async updateProjectStatus(projectId: string, status: Project['status']): Promise<Project> {
    try {
      return await this.update(projectId, { status })
    } catch (error) {
      throw new Error(`Failed to update project status: ${error}`)
    }
  }

  async archiveProject(projectId: string): Promise<Project> {
    try {
      return await this.update(projectId, { status: 'completed' })
    } catch (error) {
      throw new Error(`Failed to archive project: ${error}`)
    }
  }

  async getProjectsStats(userId: string): Promise<{
    total: number
    active: number
    completed: number
    planning: number
    overdue: number
  }> {
    try {
      const projects = await this.getByUserId(userId)
      const today = new Date().toISOString().split('T')[0]

      const stats = projects.reduce((acc, project) => {
        acc.total++
        
        switch (project.status) {
          case 'active':
            acc.active++
            break
          case 'completed':
            acc.completed++
            break
          case 'planning':
            acc.planning++
            break
          case 'paused':
            acc.paused++
            break
          case 'cancelled':
            acc.cancelled++
            break
        }
        
        if (project.deadline < today && project.status !== 'completed') {
          acc.overdue++
        }
        
        return acc
      }, {
        total: 0,
        active: 0,
        completed: 0,
        planning: 0,
        paused: 0,
        cancelled: 0,
        overdue: 0
      })

      return stats
    } catch (error) {
      throw new Error(`Failed to get project stats: ${error}`)
    }
  }

  async searchProjects(userId: string, query: string): Promise<Project[]> {
    try {
      const searchQuery = query.toLowerCase()
      return await this.table
        .where('user_id')
        .equals(userId)
        .and(project => 
          project.name.toLowerCase().includes(searchQuery) ||
          project.goal.toLowerCase().includes(searchQuery)
        )
        .reverse()
        .sortBy('updated_at')
    } catch (error) {
      throw new Error(`Failed to search projects: ${error}`)
    }
  }

  async getProjectProgress(projectId: string): Promise<{
    totalTasks: number
    completedTasks: number
    progressPercentage: number
    estimatedHours: number
    actualHours: number
  }> {
    try {
      const bigTasks = await db.big_tasks.where('project_id').equals(projectId).toArray()
      
      const progress = bigTasks.reduce((acc, task) => {
        acc.totalTasks++
        if (task.status === 'completed') {
          acc.completedTasks++
        }
        acc.estimatedHours += task.estimated_hours
        acc.actualHours += task.actual_hours || 0
        return acc
      }, {
        totalTasks: 0,
        completedTasks: 0,
        progressPercentage: 0,
        estimatedHours: 0,
        actualHours: 0
      })

      progress.progressPercentage = progress.totalTasks > 0 
        ? Math.round((progress.completedTasks / progress.totalTasks) * 100)
        : 0

      return progress
    } catch (error) {
      throw new Error(`Failed to get project progress: ${error}`)
    }
  }

  async getProjectsByDateRange(userId: string, startDate: string, endDate: string): Promise<Project[]> {
    try {
      return await this.table
        .where('user_id')
        .equals(userId)
        .and(project => project.created_at >= startDate && project.created_at <= endDate)
        .reverse()
        .sortBy('created_at')
    } catch (error) {
      throw new Error(`Failed to get projects by date range: ${error}`)
    }
  }

  async duplicateProject(projectId: string, newName: string): Promise<Project> {
    try {
      const originalProject = await this.getById(projectId)
      if (!originalProject) {
        throw new Error('Project not found')
      }

      const { id, created_at, updated_at, version, ...projectData } = originalProject // eslint-disable-line @typescript-eslint/no-unused-vars
      
      return await this.create({
        ...projectData,
        name: newName,
        status: 'planning',
        version: 1
      })
    } catch (error) {
      throw new Error(`Failed to duplicate project: ${error}`)
    }
  }
}

export const projectRepository = new ProjectRepository()
export default projectRepository