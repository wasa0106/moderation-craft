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
  OptimisticUpdateHandler,
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
      ...timestamps,
    } as T

    try {
      await this.table.add(entity)

      // 同期キュー自体は同期しない
      if (this.entityType !== 'sync_queue') {
        // 同期キューに追加
        const { SyncService } = await import('@/lib/sync/sync-service')
        const { syncLogger } = await import('@/lib/utils/logger')
        const syncService = SyncService.getInstance()

        // 呼び出し元を特定
        const stack = new Error().stack?.split('\n')
        const caller = stack && stack.length > 2 ? stack[2].trim() : 'unknown'

        syncLogger.info('📤 Adding to sync queue (create):', {
          entityType: this.entityType,
          entityId: id,
          operation: 'create',
          caller: caller,
          entityName: (entity as any).name || (entity as any).title || 'N/A',
        })

        await syncService.addToSyncQueue(this.entityType, id, 'create', entity)
      }

      return entity
    } catch (error) {
      throw new Error(`Failed to create ${this.entityType}: ${error}`)
    }
  }

  /**
   * 指定されたIDでエンティティを作成（プル同期専用）
   * 通常のcreateと異なり、IDを自動生成せずに指定されたIDを使用する
   * プル同期から作成されたデータは同期キューに追加しない（既にクラウドに存在するため）
   */
  async createWithId(data: T): Promise<T> {
    const timestamps = db.createTimestamps()

    const entity = {
      ...data,
      ...timestamps,
    } as T

    try {
      await this.table.add(entity)

      // プル同期から作成されたデータは同期キューに追加しない
      // （既にクラウドに存在するため、再度同期する必要がない）
      const { syncLogger } = await import('@/lib/utils/logger')
      syncLogger.info('✅ Created entity from pull sync (skip sync queue):', {
        entityType: this.entityType,
        entityId: entity.id,
        entityName: (entity as any).name || (entity as any).title || 'N/A',
      })

      return entity
    } catch (error) {
      throw new Error(`Failed to create ${this.entityType} with ID: ${error}`)
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
      ...db.updateTimestamp(),
    }

    try {
      // sync_queueの場合は特別な処理
      if (this.entityType === 'sync_queue') {
        // 存在チェックを先に行う
        const existingEntity = await this.table.get(id)
        if (!existingEntity) {
          console.warn(`sync_queue with ID ${id} not found - skipping update`)
          // エラーをスローせずに、既存のエンティティがあれば返す（ない場合は空のオブジェクトを返す）
          return existingEntity || ({} as T)
        }
      }

      const result = await this.table.update(id, updateData as any)

      if (result === 0) {
        // sync_queueの場合は警告ログのみ
        if (this.entityType === 'sync_queue') {
          console.warn(`sync_queue with ID ${id} not found during update`)
          return {} as T
        }
        throw new Error(`${this.entityType} with ID ${id} not found`)
      }

      const updatedEntity = await this.table.get(id)
      if (!updatedEntity) {
        // sync_queueの場合は警告ログのみ
        if (this.entityType === 'sync_queue') {
          console.warn(`Failed to retrieve updated sync_queue with ID ${id}`)
          return {} as T
        }
        throw new Error(`Failed to retrieve updated ${this.entityType}`)
      }

      // 同期キュー自体は同期しない
      if (this.entityType !== 'sync_queue') {
        // SyncServiceを動的インポートして同期キューに追加
        const { SyncService } = await import('@/lib/sync/sync-service')
        const { syncLogger } = await import('@/lib/utils/logger')
        const syncService = SyncService.getInstance()

        // 呼び出し元を特定
        const stack = new Error().stack?.split('\n')
        const caller = stack && stack.length > 2 ? stack[2].trim() : 'unknown'

        syncLogger.info('📤 Adding to sync queue (update):', {
          entityType: this.entityType,
          entityId: id,
          operation: 'update',
          caller: caller,
          entityName: (updatedEntity as any).name || (updatedEntity as any).title || 'N/A',
        })

        // UPDATE操作を同期キューに追加
        await syncService.addToSyncQueue(this.entityType, id, 'update', updatedEntity)
      }

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

      // 同期キュー自体は同期しない
      if (this.entityType !== 'sync_queue') {
        // 削除前にエンティティ情報を同期キューに追加
        const { SyncService } = await import('@/lib/sync/sync-service')
        const syncService = SyncService.getInstance()

        // DELETE操作を同期キューに追加（エンティティ情報を含める）
        await syncService.addToSyncQueue(
          this.entityType,
          id,
          'delete',
          entity // 削除されるエンティティの情報を保持
        )
      }

      // エンティティを削除
      await this.table.delete(id)
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

  protected applyFilters(query: any, filters: Record<string, unknown>): any {
    let filteredQuery = query

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          filteredQuery = filteredQuery.where(key).anyOf(value)
        } else if (
          typeof value === 'object' &&
          value !== null &&
          'from' in value &&
          'to' in value
        ) {
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

  /**
   * Add multiple entities to the sync queue
   * @param entities - The entities to sync
   * @param operationType - The type of operation (create, update, delete)
   */
  private async addEntitiesToSyncQueue(
    entities: T[],
    operationType: 'create' | 'update' | 'delete'
  ): Promise<void> {
    if (this.entityType === 'sync_queue' || entities.length === 0) {
      return
    }

    const { SyncService } = await import('@/lib/sync/sync-service')
    const syncService = SyncService.getInstance()

    // Process in batches for better performance
    const batchSize = 100
    for (let i = 0; i < entities.length; i += batchSize) {
      const batch = entities.slice(i, i + batchSize)

      await Promise.all(
        batch.map(async entity => {
          try {
            await syncService.addToSyncQueue(this.entityType, entity.id, operationType, entity)
          } catch (error) {
            console.error(
              `Failed to add ${this.entityType} ${entity.id} to sync queue (${operationType}):`,
              error
            )
          }
        })
      )
    }
  }

  async bulkCreate(items: Array<Omit<T, 'id' | 'created_at' | 'updated_at'>>): Promise<T[]> {
    if (items.length === 0) {
      return []
    }

    const entities = items.map(
      item =>
        ({
          ...item,
          id: db.generateId(),
          ...db.createTimestamps(),
        }) as T
    )

    try {
      await this.table.bulkAdd(entities)
      await this.addEntitiesToSyncQueue(entities, 'create')
      return entities
    } catch (error) {
      throw new Error(`Failed to bulk create ${this.entityType}: ${error}`)
    }
  }

  async bulkUpdate(
    updates: Array<{ id: string; data: Partial<Omit<T, 'id' | 'created_at'>> }>
  ): Promise<T[]> {
    if (updates.length === 0) {
      return []
    }

    const timestamp = db.getCurrentTimestamp()
    const updatedEntities: T[] = []

    try {
      await db.transaction('rw', this.table, async () => {
        for (const update of updates) {
          const updateData = {
            ...update.data,
            updated_at: timestamp,
          }

          await this.table.update(update.id, updateData as any)

          const entity = await this.table.get(update.id)
          if (entity) {
            updatedEntities.push(entity)
          }
        }
      })

      await this.addEntitiesToSyncQueue(updatedEntities, 'update')
      return updatedEntities
    } catch (error) {
      throw new Error(`Failed to bulk update ${this.entityType}: ${error}`)
    }
  }

  async bulkDelete(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return
    }

    try {
      const entities = await this.table.where('id').anyOf(ids).toArray()

      if (entities.length === 0) {
        return
      }

      await this.table.where('id').anyOf(ids).delete()
      await this.addEntitiesToSyncQueue(entities, 'delete')
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

      const [total, createdToday, updatedToday, oldest, newest] = await Promise.all([
        this.table.count(),
        this.table.where('created_at').above(todayISOString).count(),
        this.table.where('updated_at').above(todayISOString).count(),
        this.table.orderBy('created_at').first(),
        this.table.orderBy('created_at').reverse().first(),
      ])

      return {
        total,
        createdToday,
        updatedToday,
        oldestRecord: oldest?.created_at,
        newestRecord: newest?.created_at,
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

      confirmOptimisticUpdate: () => {},
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
