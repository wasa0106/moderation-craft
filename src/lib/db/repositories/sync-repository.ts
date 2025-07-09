/**
 * SyncQueueRepository - SyncQueueItem entity specific repository
 * Handles sync queue operations for offline-first functionality
 */

import { Table } from 'dexie'
import { db } from '../database'
import { BaseRepository } from './base-repository'
import { SyncQueueItem, SyncQueueRepository as ISyncQueueRepository } from '@/types'

export class SyncQueueRepository extends BaseRepository<SyncQueueItem> implements ISyncQueueRepository {
  protected table: Table<SyncQueueItem> = db.sync_queue as any
  protected entityType = 'sync_queue'

  async getPending(): Promise<SyncQueueItem[]> {
    try {
      return await this.table
        .where('status')
        .equals('pending')
        .sortBy('created_at')
    } catch (error) {
      throw new Error(`Failed to get pending sync operations: ${error}`)
    }
  }

  async getPendingItems(): Promise<SyncQueueItem[]> {
    return this.getPending()
  }

  async getAll(): Promise<SyncQueueItem[]> {
    try {
      return await this.table
        .orderBy('created_at')
        .reverse()
        .toArray()
    } catch (error) {
      throw new Error(`Failed to get all sync queue items: ${error}`)
    }
  }

  async markAsCompleted(id: string): Promise<void> {
    try {
      await this.table.update(id, { status: 'completed' })
    } catch (error) {
      throw new Error(`Failed to mark sync operation as completed: ${error}`)
    }
  }

  async markAsFailed(id: string, error: string): Promise<void> {
    try {
      await this.table.update(id, { 
        status: 'failed',
        error_message: error
      })
    } catch (error) {
      throw new Error(`Failed to mark sync operation as failed: ${error}`)
    }
  }

  async incrementRetryCount(id: string): Promise<void> {
    try {
      const operation = await this.getById(id)
      if (!operation) {
        throw new Error('Sync operation not found')
      }

      const newRetryCount = operation.attempt_count + 1
      const newStatus = newRetryCount >= 3 ? 'failed' : 'pending'

      await this.table.update(id, { 
        attempt_count: newRetryCount,
        status: newStatus
      })
    } catch (error) {
      throw new Error(`Failed to increment retry count: ${error}`)
    }
  }

  async cleanupCompleted(olderThanDays: number = 7): Promise<number> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)
      const cutoffTimestamp = cutoffDate.toISOString()

      const completedOperations = await this.table
        .where('status')
        .equals('completed')
        .and(operation => operation.created_at < cutoffTimestamp)
        .toArray()

      const operationIds = completedOperations.map(op => op.id)
      
      if (operationIds.length > 0) {
        await this.bulkDelete(operationIds)
      }

      return operationIds.length
    } catch (error) {
      throw new Error(`Failed to cleanup completed operations: ${error}`)
    }
  }
}

export const syncQueueRepository = new SyncQueueRepository()
export { syncQueueRepository as syncRepository }
export default syncQueueRepository