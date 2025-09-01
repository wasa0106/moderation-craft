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
      return await this.table.where('user_id').equals(userId).reverse().sortBy('updated_at')
    } catch (error) {
      throw new Error(`Failed to get projects by user ID: ${error}`)
    }
  }

  async getByStatus(status: Project['status']): Promise<Project[]> {
    try {
      return await this.table.where('status').equals(status).reverse().sortBy('updated_at')
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

  async getProjectsByDeadline(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<Project[]> {
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
        .and(
          project =>
            project.estimated_total_hours !== undefined && project.estimated_total_hours > 0
        )
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
    overdue: number
  }> {
    try {
      const projects = await this.getByUserId(userId)
      const today = new Date().toISOString().split('T')[0]

      const stats = projects.reduce(
        (acc, project) => {
          acc.total++

          switch (project.status) {
            case 'active':
              acc.active++
              break
            case 'completed':
              acc.completed++
              break
          }

          if (project.deadline < today && project.status !== 'completed') {
            acc.overdue++
          }

          return acc
        },
        {
          total: 0,
          active: 0,
          completed: 0,
          overdue: 0,
        }
      )

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
        .and(
          project =>
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

      const progress = bigTasks.reduce(
        (acc, task) => {
          acc.totalTasks++
          if (task.status === 'completed') {
            acc.completedTasks++
          }
          acc.estimatedHours += task.estimated_hours
          acc.actualHours += task.actual_hours || 0
          return acc
        },
        {
          totalTasks: 0,
          completedTasks: 0,
          progressPercentage: 0,
          estimatedHours: 0,
          actualHours: 0,
        }
      )

      progress.progressPercentage =
        progress.totalTasks > 0
          ? Math.round((progress.completedTasks / progress.totalTasks) * 100)
          : 0

      return progress
    } catch (error) {
      throw new Error(`Failed to get project progress: ${error}`)
    }
  }

  async getProjectsByDateRange(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<Project[]> {
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
        status: 'active',
        version: 1,
      })
    } catch (error) {
      throw new Error(`Failed to duplicate project: ${error}`)
    }
  }

  /**
   * プロジェクトとすべての関連BigTaskを完了にする
   */
  async completeProjectWithAllTasks(projectId: string): Promise<{
    project: Project
    completedTasks: number
  }> {
    try {
      console.log(`Completing project ID: ${projectId} and all related tasks`)
      
      // プロジェクトの存在確認
      const project = await this.getById(projectId)
      if (!project) {
        throw new Error('Project not found')
      }
      
      // すでに完了済みの場合はエラー
      if (project.status === 'completed') {
        throw new Error('Project is already completed')
      }
      
      console.log(`Found project: ${project.name}`)
      
      // BigTaskRepositoryのインスタンスを取得
      const { bigTaskRepository } = await import('./task-repository')
      const { SyncService } = await import('@/lib/sync/sync-service')
      const syncService = SyncService.getInstance()
      
      let completedTasksCount = 0
      
      // トランザクション内で更新
      await db.transaction('rw', db.projects, db.big_tasks, async () => {
        // 1. すべてのBigTaskを完了にする
        const completedTasks = await bigTaskRepository.completeAllTasksByProject(projectId)
        completedTasksCount = completedTasks.length
        console.log(`Completed ${completedTasksCount} big tasks`)
        
        // 2. プロジェクト自体を完了にする
        const updatedProject = await this.update(projectId, {
          status: 'completed',
          actual_total_hours: completedTasks.reduce((sum, task) => sum + (task.actual_hours || 0), 0)
        })
        
        // 同期キューに追加
        await syncService.addToSyncQueue('project', projectId, 'update', updatedProject)
        console.log('Project marked as completed')
      })
      
      // 更新されたプロジェクトを取得
      const updatedProject = await this.getById(projectId)
      if (!updatedProject) {
        throw new Error('Failed to retrieve updated project')
      }
      
      return {
        project: updatedProject,
        completedTasks: completedTasksCount
      }
    } catch (error) {
      console.error('Failed to complete project with all tasks:', error)
      throw new Error(`Failed to complete project: ${error}`)
    }
  }

  async deleteWithRelatedData(projectId: string): Promise<void> {
    try {
      console.log(`Starting cascade delete for project ID: ${projectId}`)
      
      // プロジェクトの存在確認
      const project = await this.getById(projectId)
      if (!project) {
        throw new Error('Project not found')
      }
      
      console.log(`Found project: ${project.name}`)

      // 同期サービスを事前にインポート
      const { SyncService } = await import('@/lib/sync/sync-service')
      const syncService = SyncService.getInstance()
      
      // 削除されるエンティティを記録するための配列
      const deletedEntities: { type: string; id: string; data: any }[] = []
      
      // トランザクション内で関連データを削除
      await db.transaction('rw', db.projects, db.big_tasks, db.small_tasks, db.work_sessions, async () => {
        console.log('Starting transaction for cascade delete')
        // 1. プロジェクトに関連するBigTaskを取得
        const bigTasks = await db.big_tasks
          .where('project_id')
          .equals(projectId)
          .toArray()
        
        const bigTaskIds = bigTasks.map(task => task.id)
        console.log(`Found ${bigTasks.length} big tasks to delete:`, bigTaskIds)

        if (bigTaskIds.length > 0) {
          // 2. BigTaskに関連するSmallTaskを取得
          const smallTasks = await db.small_tasks
            .where('big_task_id')
            .anyOf(bigTaskIds)
            .toArray()
          
          const smallTaskIds = smallTasks.map(task => task.id)
          console.log(`Found ${smallTasks.length} small tasks to delete:`, smallTaskIds)

          if (smallTaskIds.length > 0) {
            // 3. SmallTaskに関連するWorkSessionを取得して記録
            const workSessions = await db.work_sessions
              .where('small_task_id')
              .anyOf(smallTaskIds)
              .toArray()
            
            // WorkSessionの削除情報を記録
            workSessions.forEach(session => {
              deletedEntities.push({
                type: 'work_session',
                id: session.id,
                data: session
              })
            })
            
            // WorkSessionを削除
            try {
              const deletedSessions = await db.work_sessions
                .where('small_task_id')
                .anyOf(smallTaskIds)
                .delete()
              
              console.log(`Deleted ${deletedSessions} work sessions for ${smallTaskIds.length} small tasks`)
            } catch (error) {
              console.error('Failed to delete work sessions:', error)
              throw error
            }
          }

          // 4. SmallTaskの削除情報を記録
          smallTasks.forEach(task => {
            deletedEntities.push({
              type: 'small_task',
              id: task.id,
              data: task
            })
          })
          
          // SmallTaskを削除
          try {
            const deletedSmallTasks = await db.small_tasks
              .where('big_task_id')
              .anyOf(bigTaskIds)
              .delete()
            
            console.log(`Deleted ${deletedSmallTasks} small tasks`)
          } catch (error) {
            console.error('Failed to delete small tasks:', error)
            throw error
          }
        }

        // 5. BigTaskの削除情報を記録
        bigTasks.forEach(task => {
          deletedEntities.push({
            type: 'big_task',
            id: task.id,
            data: task
          })
        })
        
        // BigTaskを削除
        try {
          const deletedBigTasks = await db.big_tasks
            .where('project_id')
            .equals(projectId)
            .delete()
          
          console.log(`Deleted ${deletedBigTasks} big tasks`)
        } catch (error) {
          console.error('Failed to delete big tasks:', error)
          throw error
        }

        // 6. プロジェクトの削除情報を記録
        deletedEntities.push({
          type: 'project',
          id: projectId,
          data: project
        })
        
        // 最後にプロジェクト本体を削除
        try {
          const deletedProject = await db.projects.delete(projectId)
          console.log(`Deleted project: ${project.name} (result: ${deletedProject})`)
        } catch (error) {
          console.error('Failed to delete project:', error)
          throw error
        }
      })
      
      // トランザクション成功後、すべての削除を同期キューに追加
      console.log(`Adding ${deletedEntities.length} deletion operations to sync queue`)
      
      for (const entity of deletedEntities) {
        try {
          await syncService.addToSyncQueue(
            entity.type,
            entity.id,
            'delete',
            entity.data
          )
          console.log(`Added ${entity.type} ${entity.id} deletion to sync queue`)
        } catch (error) {
          console.error(`Failed to add ${entity.type} ${entity.id} to sync queue:`, error)
          // 同期キューへの追加に失敗してもカスケード削除は成功しているので継続
        }
      }
      
      console.log('Cascade delete completed successfully')
    } catch (error) {
      console.error('Failed to delete project with related data:', error)
      throw new Error(`Failed to delete project with related data: ${error}`)
    }
  }
}

export const projectRepository = new ProjectRepository()
export default projectRepository
