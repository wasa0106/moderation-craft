/**
 * Base repository class for moderation-craft
 * Provides common CRUD operations with offline-first design
 */

import { Table } from 'dexie'
import { db } from '../database'
import {
  DatabaseEntity,
  RepositoryInterface,
  CreateSyncOperationData,
  OptimisticUpdateHandler
} from '@/types'

export abstract class BaseRepository<T extends DatabaseEntity> implements RepositoryInterface<T> {
  protected abstract table: Table<T>
  protected abstract entityType: string

  async create(data: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T> {
    const id = db.generateId()
    const timestamps = db.createTimestamps()
    
    const entity = {
      ...data,
      id,
      ...timestamps
    } as T

    try {
      await this.table.add(entity)
      
      await db.sync_queue.add({
        operation_id: db.generateId(),
        operation_type: 'CREATE',
        entity_type: this.entityType,
        entity_id: id,
        payload: entity,
        timestamp: timestamps.created_at,
        retry_count: 0,
        max_retries: 3,
        status: 'pending'
      } as any)

      return entity
    } catch (error) {
      throw new Error(`Failed to create ${this.entityType}: ${error}`)
    }
  }

  async getById(id: string): Promise<T | undefined> {
    try {
      return await this.table.get(id)
    } catch (error) {
      throw new Error(`Failed to get ${this.entityType} by ID: ${error}`)
    }
  }

  async update(id: string, data: Partial<Omit<T, 'id' | 'created_at'>>): Promise<T> {
    const updateData = {
      ...data,
      ...db.updateTimestamp()
    }

    try {
      const result = await this.table.update(id, updateData as any)
      
      if (result === 0) {
        throw new Error(`${this.entityType} with ID ${id} not found`)
      }

      const updatedEntity = await this.table.get(id)
      if (!updatedEntity) {
        throw new Error(`Failed to retrieve updated ${this.entityType}`)
      }

      await db.sync_queue.add({
        operation_id: db.generateId(),
        operation_type: 'UPDATE',
        entity_type: this.entityType,
        entity_id: id,
        payload: updatedEntity,
        timestamp: db.getCurrentTimestamp(),
        retry_count: 0,
        max_retries: 3,
        status: 'pending'
      } as any)

      return updatedEntity
    } catch (error) {
      throw new Error(`Failed to update ${this.entityType}: ${error}`)
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const entity = await this.table.get(id)
      if (!entity) {
        throw new Error(`${this.entityType} with ID ${id} not found`)
      }

      await this.table.delete(id)

      await db.sync_queue.add({
        operation_id: db.generateId(),
        operation_type: 'DELETE',
        entity_type: this.entityType,
        entity_id: id,
        payload: entity,
        timestamp: db.getCurrentTimestamp(),
        retry_count: 0,
        max_retries: 3,
        status: 'pending'
      } as any)
    } catch (error) {
      throw new Error(`Failed to delete ${this.entityType}: ${error}`)
    }
  }

  async list(filters?: Record<string, unknown>): Promise<T[]> {
    try {
      let query = this.table.orderBy('updated_at').reverse()

      if (filters) {
        query = this.applyFilters(query, filters)
      }

      return await query.toArray()
    } catch (error) {
      throw new Error(`Failed to list ${this.entityType}: ${error}`)
    }
  }

  async count(filters?: Record<string, unknown>): Promise<number> {
    try {
      let query = this.table.toCollection()

      if (filters) {
        query = this.applyFilters(query, filters)
      }

      return await query.count()
    } catch (error) {
      throw new Error(`Failed to count ${this.entityType}: ${error}`)
    }
  }

  protected applyFilters(query: any, filters: Record<string, unknown>): any { // eslint-disable-line @typescript-eslint/no-explicit-any
    let filteredQuery = query

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          filteredQuery = filteredQuery.where(key).anyOf(value)
        } else if (typeof value === 'object' && value !== null && 'from' in value && 'to' in value) {
          filteredQuery = filteredQuery.where(key).between((value as any).from, (value as any).to)
        } else {
          filteredQuery = filteredQuery.where(key).equals(value)
        }
      }
    })

    return filteredQuery
  }

  protected async addToSyncQueue(operation: CreateSyncOperationData): Promise<void> {
    try {
      await db.sync_queue.add(operation as any)
    } catch (error) {
      console.error(`Failed to add sync operation for ${this.entityType}:`, error)
    }
  }

  async bulkCreate(items: Array<Omit<T, 'id' | 'created_at' | 'updated_at'>>): Promise<T[]> {
    const entities = items.map(item => {
      const id = db.generateId()
      const timestamps = db.createTimestamps()
      
      return {
        ...item,
        id,
        ...timestamps
      } as T
    })

    try {
      await this.table.bulkAdd(entities)

      const syncOperations = entities.map(entity => ({
        operation_id: db.generateId(),
        operation_type: 'CREATE' as const,
        entity_type: this.entityType as 'project' | 'big_task' | 'small_task' | 'work_session' | 'mood_entry' | 'daily_condition',
        entity_id: entity.id,
        payload: entity,
        timestamp: entity.created_at,
        retry_count: 0,
        max_retries: 3,
        status: 'pending' as const
      }))

      await db.sync_queue.bulkAdd(syncOperations as any)

      return entities
    } catch (error) {
      throw new Error(`Failed to bulk create ${this.entityType}: ${error}`)
    }
  }

  async bulkUpdate(updates: Array<{ id: string; data: Partial<Omit<T, 'id' | 'created_at'>> }>): Promise<T[]> {
    const timestamp = db.getCurrentTimestamp()
    const updatedEntities: T[] = []

    try {
      await db.transaction('rw', this.table, async () => {
        for (const update of updates) {
          const updateData = {
            ...update.data,
            updated_at: timestamp
          }

          await this.table.update(update.id, updateData as any)
          
          const entity = await this.table.get(update.id)
          if (entity) {
            updatedEntities.push(entity)
          }
        }
      })

      const syncOperations = updatedEntities.map(entity => ({
        operation_id: db.generateId(),
        operation_type: 'UPDATE' as const,
        entity_type: this.entityType as 'project' | 'big_task' | 'small_task' | 'work_session' | 'mood_entry' | 'daily_condition',
        entity_id: entity.id,
        payload: entity,
        timestamp,
        retry_count: 0,
        max_retries: 3,
        status: 'pending' as const
      }))

      await db.sync_queue.bulkAdd(syncOperations as any)

      return updatedEntities
    } catch (error) {
      throw new Error(`Failed to bulk update ${this.entityType}: ${error}`)
    }
  }

  async bulkDelete(ids: string[]): Promise<void> {
    try {
      const entities = await this.table.where('id').anyOf(ids).toArray()
      
      await this.table.where('id').anyOf(ids).delete()

      const syncOperations = entities.map(entity => ({
        operation_id: db.generateId(),
        operation_type: 'DELETE' as const,
        entity_type: this.entityType as 'project' | 'big_task' | 'small_task' | 'work_session' | 'mood_entry' | 'daily_condition',
        entity_id: entity.id,
        payload: entity,
        timestamp: db.getCurrentTimestamp(),
        retry_count: 0,
        max_retries: 3,
        status: 'pending' as const
      }))

      await db.sync_queue.bulkAdd(syncOperations as any)
    } catch (error) {
      throw new Error(`Failed to bulk delete ${this.entityType}: ${error}`)
    }
  }

  async findOne(filters: Record<string, unknown>): Promise<T | undefined> {
    try {
      let query = this.table.toCollection()
      query = this.applyFilters(query, filters)
      return await query.first()
    } catch (error) {
      throw new Error(`Failed to find ${this.entityType}: ${error}`)
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const entity = await this.table.get(id)
      return !!entity
    } catch {
      return false
    }
  }

  async getMany(ids: string[]): Promise<T[]> {
    try {
      return await this.table.where('id').anyOf(ids).toArray()
    } catch (error) {
      throw new Error(`Failed to get many ${this.entityType}: ${error}`)
    }
  }

  async clear(): Promise<void> {
    try {
      await this.table.clear()
    } catch (error) {
      throw new Error(`Failed to clear ${this.entityType}: ${error}`)
    }
  }

  async getLastUpdated(): Promise<string | undefined> {
    try {
      const entity = await this.table.orderBy('updated_at').reverse().first()
      return entity?.updated_at
    } catch {
      return undefined
    }
  }

  async getCreatedAfter(timestamp: string): Promise<T[]> {
    try {
      return await this.table.where('created_at').above(timestamp).toArray()
    } catch (error) {
      throw new Error(`Failed to get ${this.entityType} created after timestamp: ${error}`)
    }
  }

  async getUpdatedAfter(timestamp: string): Promise<T[]> {
    try {
      return await this.table.where('updated_at').above(timestamp).toArray()
    } catch (error) {
      throw new Error(`Failed to get ${this.entityType} updated after timestamp: ${error}`)
    }
  }

  async getStatistics(): Promise<{
    total: number
    createdToday: number
    updatedToday: number
    oldestRecord?: string
    newestRecord?: string
  }> {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayISOString = today.toISOString()

      const [
        total,
        createdToday,
        updatedToday,
        oldest,
        newest
      ] = await Promise.all([
        this.table.count(),
        this.table.where('created_at').above(todayISOString).count(),
        this.table.where('updated_at').above(todayISOString).count(),
        this.table.orderBy('created_at').first(),
        this.table.orderBy('created_at').reverse().first()
      ])

      return {
        total,
        createdToday,
        updatedToday,
        oldestRecord: oldest?.created_at,
        newestRecord: newest?.created_at
      }
    } catch (error) {
      throw new Error(`Failed to get ${this.entityType} statistics: ${error}`)
    }
  }

  protected createOptimisticUpdateHandler(
    entityId: string,
    onUpdate: (entity: T) => void,
    onRevert: (entity: T) => void
  ): OptimisticUpdateHandler<T> {
    return {
      applyOptimisticUpdate: (data: T) => {
        onUpdate(data)
      },
      
      revertOptimisticUpdate: (data: T) => {
        onRevert(data)
      },
      
      confirmOptimisticUpdate: () => {
      }
    }
  }

  async withOptimisticUpdate<R>(
    entityId: string,
    optimisticData: Partial<T>,
    operation: () => Promise<R>,
    onUpdate: (entity: T) => void,
    onRevert: (entity: T) => void
  ): Promise<R> {
    const originalEntity = await this.getById(entityId)
    if (!originalEntity) {
      throw new Error(`Entity ${entityId} not found`)
    }

    const optimisticEntity = { ...originalEntity, ...optimisticData } as T
    
    try {
      onUpdate(optimisticEntity)
      
      const result = await operation()
      
      return result
    } catch (error) {
      onRevert(originalEntity)
      throw error
    }
  }

  async validateEntity(entity: Partial<T>): Promise<string[]> {
    const errors: string[] = []

    if (!entity.id && this.isCreateOperation(entity)) {
      errors.push('ID is required')
    }

    return errors
  }

  private isCreateOperation(entity: Partial<T>): boolean {
    return !('id' in entity) || !entity.id
  }

  async backup(): Promise<T[]> {
    try {
      return await this.table.toArray()
    } catch (error) {
      throw new Error(`Failed to backup ${this.entityType}: ${error}`)
    }
  }

  async restore(entities: T[]): Promise<void> {
    try {
      await this.table.clear()
      await this.table.bulkAdd(entities)
    } catch (error) {
      throw new Error(`Failed to restore ${this.entityType}: ${error}`)
    }
  }
}

export default BaseRepository