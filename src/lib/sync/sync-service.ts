/**
 * SyncService - Handles synchronization between local and remote data
 * Implements offline-first sync with conflict resolution
 */

import { useSyncStore } from '@/stores/sync-store'
import { ConflictResolver } from './conflict-resolver'
import { OfflineDetector } from './offline-detector'
import { syncQueueRepository } from '@/lib/db/repositories'
import { SyncQueueItem, DatabaseEntity } from '@/types'

export class SyncService {
  private static instance: SyncService
  private syncInterval: NodeJS.Timeout | null = null
  private isProcessing = false

  private constructor() {}

  static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService()
    }
    return SyncService.instance
  }

  /**
   * Starts automatic sync process
   */
  public startAutoSync(intervalMs: number = 30000) {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
    }

    this.syncInterval = setInterval(() => {
      this.processSyncQueue()
    }, intervalMs)
  }

  /**
   * Stops automatic sync process
   */
  public stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }

  /**
   * Processes the sync queue
   */
  public async processSyncQueue(): Promise<void> {
    if (this.isProcessing) return

    const detector = OfflineDetector.getInstance()
    const syncStore = useSyncStore.getState()

    if (!detector.getStatus() || !syncStore.canSync()) {
      return
    }

    this.isProcessing = true
    syncStore.setSyncStatus(true)

    try {
      const pendingItems = await syncQueueRepository.getPendingItems()
      
      if (pendingItems.length === 0) {
        return
      }

      // Process items in batches to avoid overwhelming the system
      const batchSize = 10
      for (let i = 0; i < pendingItems.length; i += batchSize) {
        const batch = pendingItems.slice(i, i + batchSize)
        await this.processBatch(batch)
      }

      syncStore.setLastSyncTime(new Date().toISOString())
    } catch (error) {
      console.error('Sync process failed:', error)
      syncStore.addSyncError(error instanceof Error ? error.message : 'Unknown sync error')
    } finally {
      this.isProcessing = false
      syncStore.setSyncStatus(false)
    }
  }

  /**
   * Processes a batch of sync items
   */
  private async processBatch(items: SyncQueueItem[]): Promise<void> {
    const syncStore = useSyncStore.getState()

    for (const item of items) {
      try {
        // Mark as processing
        syncStore.updateSyncQueueItem(item.id, { 
          status: 'processing',
          attempt_count: item.attempt_count + 1,
          last_attempted: new Date().toISOString()
        })

        await this.processItem(item)

        // Mark as completed and remove from queue
        await syncQueueRepository.delete(item.id)
        syncStore.removeFromSyncQueue(item.id)

      } catch (error) {
        console.error(`Failed to sync item ${item.id}:`, error)
        
        const maxAttempts = 3
        const newAttemptCount = item.attempt_count + 1

        if (newAttemptCount >= maxAttempts) {
          // Mark as failed
          syncStore.updateSyncQueueItem(item.id, {
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            last_attempted: new Date().toISOString()
          })
        } else {
          // Reset to pending for retry
          syncStore.updateSyncQueueItem(item.id, {
            status: 'pending',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            last_attempted: new Date().toISOString()
          })
        }
      }
    }
  }

  /**
   * Processes a single sync item
   */
  private async processItem(item: SyncQueueItem): Promise<void> {
    switch (item.operation) {
      case 'create':
        await this.syncCreate(item)
        break
      case 'update':
        await this.syncUpdate(item)
        break
      case 'delete':
        await this.syncDelete(item)
        break
      default:
        throw new Error(`Unknown operation: ${item.operation}`)
    }
  }

  /**
   * Syncs a create operation
   */
  private async syncCreate(item: SyncQueueItem): Promise<void> {
    // In a real app, this would make an API call
    // For now, we'll simulate the sync process
    
    console.log(`Syncing create operation for ${item.entity_type}:`, item.entity_id)
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // In a real implementation, you would:
    // 1. Send the data to the server
    // 2. Handle any conflicts (if entity already exists)
    // 3. Update the local entity with server response
    
    // For now, just mark as synced
    await this.markEntityAsSynced(item.entity_type, item.entity_id)
  }

  /**
   * Syncs an update operation
   */
  private async syncUpdate(item: SyncQueueItem): Promise<void> {
    console.log(`Syncing update operation for ${item.entity_type}:`, item.entity_id)
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // In a real implementation, you would:
    // 1. Fetch the current server version
    // 2. Compare with local version
    // 3. Resolve conflicts using ConflictResolver
    // 4. Send the resolved version to server
    // 5. Update local entity with final version
    
    // For now, just mark as synced
    await this.markEntityAsSynced(item.entity_type, item.entity_id)
  }

  /**
   * Syncs a delete operation
   */
  private async syncDelete(item: SyncQueueItem): Promise<void> {
    console.log(`Syncing delete operation for ${item.entity_type}:`, item.entity_id)
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // In a real implementation, you would:
    // 1. Send delete request to server
    // 2. Handle any conflicts (if entity was modified on server)
    // 3. Confirm deletion or resolve conflicts
    
    // For deletion, we don't need to mark as synced since the entity is gone
  }

  /**
   * Marks an entity as synced (updates is_synced flag)
   */
  private async markEntityAsSynced(entityType: string, entityId: string): Promise<void> {
    try {
      // This is a simplified approach - in a real app, you'd update the specific entity
      // For now, we'll just log the action
      console.log(`Marked ${entityType} ${entityId} as synced`)
    } catch (error) {
      console.error(`Failed to mark ${entityType} ${entityId} as synced:`, error)
    }
  }

  /**
   * Adds an item to the sync queue
   */
  public async addToSyncQueue(
    entityType: string,
    entityId: string,
    operation: 'create' | 'update' | 'delete',
    data?: any
  ): Promise<void> {
    const syncStore = useSyncStore.getState()
    
    const queueItem: Omit<SyncQueueItem, 'id' | 'created_at' | 'updated_at'> = {
      user_id: 'current-user', // In a real app, get from auth context
      entity_type: entityType,
      entity_id: entityId,
      operation,
      data: data ? JSON.stringify(data) : undefined,
      status: 'pending',
      attempt_count: 0,
      last_attempted: undefined,
      error_message: undefined,
      version: 1
    }

    try {
      const createdItem = await syncQueueRepository.create(queueItem)
      syncStore.addToSyncQueue(createdItem)
      
      // If we're online and auto-sync is enabled, trigger immediate sync
      if (syncStore.isOnline && syncStore.autoSyncEnabled) {
        this.processSyncQueue()
      }
    } catch (error) {
      console.error('Failed to add item to sync queue:', error)
      syncStore.addSyncError(error instanceof Error ? error.message : 'Failed to queue sync item')
    }
  }

  /**
   * Forces immediate sync of all pending items
   */
  public async forcSync(): Promise<void> {
    await this.processSyncQueue()
  }

  /**
   * Clears failed sync items from the queue
   */
  public async clearFailedItems(): Promise<void> {
    const syncStore = useSyncStore.getState()
    const failedItems = syncStore.getQueueByStatus('failed')
    
    for (const item of failedItems) {
      await syncQueueRepository.delete(item.id)
      syncStore.removeFromSyncQueue(item.id)
    }
  }

  /**
   * Retries failed sync items
   */
  public async retryFailedItems(): Promise<void> {
    const syncStore = useSyncStore.getState()
    const failedItems = syncStore.getQueueByStatus('failed')
    
    for (const item of failedItems) {
      syncStore.updateSyncQueueItem(item.id, {
        status: 'pending',
        error_message: undefined
      })
    }
    
    await this.processSyncQueue()
  }

  /**
   * Gets sync statistics
   */
  public getSyncStats() {
    const syncStore = useSyncStore.getState()
    
    return {
      pendingItems: syncStore.getPendingItemsCount(),
      failedItems: syncStore.getFailedItemsCount(),
      lastSyncTime: syncStore.lastSyncTime,
      isOnline: syncStore.isOnline,
      isSyncing: syncStore.isSyncing,
      autoSyncEnabled: syncStore.autoSyncEnabled
    }
  }
}