/**
 * SyncService - Handles synchronization between local and remote data
 * Implements offline-first sync with conflict resolution
 */

import { useSyncStore } from '@/stores/sync-store'
import { ConflictResolver } from './conflict-resolver'
import { OfflineDetector } from './offline-detector'
import {
  syncQueueRepository,
  workSessionRepository,
  projectRepository,
  bigTaskRepository,
  smallTaskRepository,
  moodEntryRepository,
  dopamineEntryRepository,
  dailyConditionRepository,
  scheduleMemoRepository,
  sleepScheduleRepository,
} from '@/lib/db/repositories'
import { SyncQueueItem, DatabaseEntity } from '@/types'
import { syncLogger } from '@/lib/utils/logger'

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
    syncLogger.info(`startAutoSync called with interval: ${intervalMs}ms`)

    if (this.syncInterval) {
      syncLogger.debug('Clearing existing interval')
      clearInterval(this.syncInterval)
    }

    this.syncInterval = setInterval(() => {
      syncLogger.debug('=== Auto sync interval triggered ===')
      this.processSyncQueue()
    }, intervalMs)

    syncLogger.debug('Auto sync interval set:', this.syncInterval)
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
    syncLogger.debug('processSyncQueue called')

    if (this.isProcessing) {
      syncLogger.debug('Already processing, skipping')
      return
    }

    const detector = OfflineDetector.getInstance()
    const syncStore = useSyncStore.getState()

    if (!detector.getStatus()) {
      syncLogger.debug('Offline, skipping sync')
      return
    }

    if (!syncStore.canSync()) {
      syncLogger.debug('Cannot sync (already syncing or disabled), skipping')
      return
    }

    this.isProcessing = true
    syncStore.setSyncStatus(true)

    try {
      const pendingItems = await syncQueueRepository.getPendingItems()
      syncLogger.debug(`Found ${pendingItems.length} pending items`)

      if (pendingItems.length === 0) {
        syncLogger.debug('No pending items to sync')
        return
      }

      // Process items in batches to avoid overwhelming the system
      const batchSize = 10
      for (let i = 0; i < pendingItems.length; i += batchSize) {
        const batch = pendingItems.slice(i, i + batchSize)
        await this.processBatch(batch)
      }

      syncStore.setLastSyncTime(new Date().toISOString())
      syncLogger.info(`=== Sync completed successfully: ${pendingItems.length} items ===`)

      // 同期成功の通知（開発環境でのみ表示）
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        const { toast } = await import('sonner')
        toast.success(`同期完了: ${pendingItems.length}件のアイテムを同期しました`)
      }
    } catch (error) {
      syncLogger.error('Sync process failed:', error)
      syncStore.addSyncError(error instanceof Error ? error.message : 'Unknown sync error')

      // エラー通知（開発環境でのみ表示）
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        const { toast } = await import('sonner')
        toast.error('同期中にエラーが発生しました')
      }
    } finally {
      this.isProcessing = false
      syncStore.setSyncStatus(false)
      // 同期状態をリセット
      const store = useSyncStore.getState()
      store.setSyncStatus(false)
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
          last_attempted: new Date().toISOString(),
        })

        await this.processItem(item)

        // Mark as completed and remove from queue
        await syncQueueRepository.delete(item.id)
        syncStore.removeFromSyncQueue(item.id)
      } catch (error) {
        syncLogger.error(`Failed to sync item ${item.id}:`, error)

        // バランスの取れたリトライ戦略
        const newAttemptCount = item.attempt_count + 1

        // エラータイプを判定
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        const isNetworkError = errorMessage.includes('fetch') || errorMessage.includes('network')
        const isAuthError = errorMessage.includes('AccessDenied') || errorMessage.includes('401')
        const isRateLimitError =
          errorMessage.includes('TooManyRequests') || errorMessage.includes('429')

        // リトライ回数の上限を設定
        let maxRetries = 5 // デフォルト5回
        if (isNetworkError) maxRetries = 10 // ネットワークエラーは10回
        if (isAuthError) maxRetries = 2 // 認証エラーは2回で諦める
        if (isRateLimitError) maxRetries = 20 // レート制限は長期戦

        if (newAttemptCount >= maxRetries) {
          // 上限に達したら失敗状態にする
          syncStore.updateSyncQueueItem(item.id, {
            status: 'failed',
            attempt_count: newAttemptCount,
            error_message: errorMessage,
            last_attempted: new Date().toISOString(),
          })

          // アイテムが存在するか確認してから更新
          const existingItem = await syncQueueRepository.getById(item.id)
          if (existingItem) {
            await syncQueueRepository.update(item.id, {
              status: 'failed',
              attempt_count: newAttemptCount,
              error_message: errorMessage,
              last_attempted: new Date().toISOString(),
            })
          } else {
            syncLogger.warn(`sync_queue item ${item.id} not found - skipping update`)
          }
          syncLogger.debug(
            `Item ${item.id} moved to dormant state after ${newAttemptCount} attempts`
          )

          // 1時間後に自動的に復活させる（バックグラウンドタスク）
          if (isNetworkError || isRateLimitError) {
            setTimeout(async () => {
              // アイテムが存在するか確認してから更新
              const existingItem = await syncQueueRepository.getById(item.id)
              if (existingItem) {
                await syncQueueRepository.update(item.id, {
                  status: 'pending',
                  attempt_count: Math.floor(newAttemptCount / 2), // 試行回数を半分にリセット
                })
              }
            }, 3600000) // 1時間後
          }
        } else {
          // 次のリトライまでの待機時間を計算（指数バックオフ）
          const baseDelay = isRateLimitError ? 60000 : 30000 // レート制限は1分、それ以外は30秒
          const nextRetryDelay = Math.min(baseDelay * Math.pow(1.5, newAttemptCount - 1), 600000) // 最大10分

          syncStore.updateSyncQueueItem(item.id, {
            status: 'pending',
            attempt_count: newAttemptCount,
            error_message: errorMessage,
            last_attempted: new Date().toISOString(),
            next_retry_after: new Date(Date.now() + nextRetryDelay).toISOString(), // 次回リトライ時刻を記録
          })

          // アイテムが存在するか確認してから更新
          const existingItem = await syncQueueRepository.getById(item.id)
          if (existingItem) {
            await syncQueueRepository.update(item.id, {
              status: 'pending',
              attempt_count: newAttemptCount,
              error_message: errorMessage,
              last_attempted: new Date().toISOString(),
            })
          } else {
            syncLogger.warn(`sync_queue item ${item.id} not found - skipping retry update`)
          }

          syncLogger.debug(`Item ${item.id} will retry after ${nextRetryDelay / 1000} seconds`)
        }
      }
    }
  }

  /**
   * Processes a single sync item
   */
  private async processItem(item: SyncQueueItem): Promise<void> {
    // Convert operation_type to lowercase for consistency
    const operation = item.operation_type?.toLowerCase()

    switch (operation) {
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
        console.error('Unknown or undefined operation type:', item.operation_type)
        throw new Error(`Unknown operation: ${item.operation_type || 'undefined'}`)
    }
  }

  /**
   * Syncs a create operation
   */
  private async syncCreate(item: SyncQueueItem): Promise<void> {
    syncLogger.debug(`Syncing create operation for ${item.entity_type}:`, item.entity_id)
    syncLogger.debug('Sync queue item:', {
      id: item.id,
      hasData: !!item.data,
      dataLength: item.data?.length,
      data: item.data,
    })

    // データを解析
    if (!item.data) {
      // データがない場合は、Repositoryから取得を試みる
      syncLogger.warn(
        `No data in sync queue for ${item.entity_type} ${item.entity_id}, attempting to fetch from repository`
      )

      let entityData = null
      switch (item.entity_type) {
        case 'work_session':
          entityData = await workSessionRepository.getById(item.entity_id)
          break
        case 'project':
          entityData = await projectRepository.getById(item.entity_id)
          break
        case 'big_task':
          entityData = await bigTaskRepository.getById(item.entity_id)
          break
        case 'small_task':
          entityData = await smallTaskRepository.getById(item.entity_id)
          break
        case 'mood_entry':
          entityData = await moodEntryRepository.getById(item.entity_id)
          break
        case 'dopamine_entry':
          entityData = await dopamineEntryRepository.getById(item.entity_id)
          break
        case 'daily_condition':
          entityData = await dailyConditionRepository.getById(item.entity_id)
          break
        case 'schedule_memo':
          entityData = await scheduleMemoRepository.getById(item.entity_id)
          break
        case 'sleep_schedule':
          entityData = await sleepScheduleRepository.getById(item.entity_id)
          break
      }

      if (!entityData) {
        throw new Error(`No data provided for create operation and entity not found in repository`)
      }

      // 取得したデータを使用
      item.data = JSON.stringify(entityData)
    }

    const entityData = JSON.parse(item.data)

    try {
      // 同期APIを呼び出す
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.NEXT_PUBLIC_SYNC_API_KEY || 'development-key',
        },
        body: JSON.stringify({
          entity_type: item.entity_type,
          payload: entityData,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || '同期に失敗しました')
      }

      // 同期成功したら、ローカルのエンティティを更新（エラーが発生しても続行）
      await this.markEntityAsSynced(item.entity_type, item.entity_id)
      syncLogger.info(`Successfully synced ${item.entity_type} ${item.entity_id}`)
    } catch (error) {
      syncLogger.error(`Failed to sync ${item.entity_type} ${item.entity_id}:`, error)
      throw error
    }
  }

  /**
   * Syncs an update operation
   */
  private async syncUpdate(item: SyncQueueItem): Promise<void> {
    syncLogger.debug(`Syncing update operation for ${item.entity_type}:`, item.entity_id)

    try {
      let entityData = null

      // dataがある場合は使用、ない場合はRepositoryから取得
      if (item.data) {
        entityData = JSON.parse(item.data)
      } else {
        // エンティティタイプに応じてデータを取得
        switch (item.entity_type) {
          case 'work_session':
            entityData = await workSessionRepository.getById(item.entity_id)
            break
          case 'project':
            entityData = await projectRepository.getById(item.entity_id)
            break
          case 'big_task':
            entityData = await bigTaskRepository.getById(item.entity_id)
            break
          case 'small_task':
            entityData = await smallTaskRepository.getById(item.entity_id)
            break
          case 'mood_entry':
            entityData = await moodEntryRepository.getById(item.entity_id)
            break
          case 'dopamine_entry':
            entityData = await dopamineEntryRepository.getById(item.entity_id)
            break
          case 'daily_condition':
            entityData = await dailyConditionRepository.getById(item.entity_id)
            break
          case 'schedule_memo':
            entityData = await scheduleMemoRepository.getById(item.entity_id)
            break
          case 'sleep_schedule':
            entityData = await sleepScheduleRepository.getById(item.entity_id)
            break
        }

        if (!entityData) {
          throw new Error(`Entity ${item.entity_type} with ID ${item.entity_id} not found`)
        }
      }

      // 同期APIを呼び出す（UPDATE操作として）
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.NEXT_PUBLIC_SYNC_API_KEY || 'development-key',
        },
        body: JSON.stringify({
          entity_type: item.entity_type,
          operation: 'UPDATE',
          payload: entityData,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || '同期に失敗しました')
      }

      // 同期成功したら、ローカルのエンティティを更新（エラーが発生しても続行）
      await this.markEntityAsSynced(item.entity_type, item.entity_id)
      syncLogger.info(`Successfully synced update for ${item.entity_type} ${item.entity_id}`)
    } catch (error) {
      syncLogger.error(`Failed to sync update for ${item.entity_type} ${item.entity_id}:`, error)
      throw error
    }
  }

  /**
   * Syncs a delete operation
   */
  private async syncDelete(item: SyncQueueItem): Promise<void> {
    syncLogger.debug(`Syncing delete operation for ${item.entity_type}:`, item.entity_id)

    try {
      // DELETE操作にはエンティティ情報が必要（削除前の情報）
      let entityData = null
      if (item.data) {
        entityData = JSON.parse(item.data)
      }

      // 同期APIを呼び出す（DELETE操作として）
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.NEXT_PUBLIC_SYNC_API_KEY || 'development-key',
        },
        body: JSON.stringify({
          entity_type: item.entity_type,
          operation: 'DELETE',
          payload: entityData || { id: item.entity_id, user_id: 'current-user' },
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || '削除の同期に失敗しました')
      }

      syncLogger.info(`Successfully synced deletion of ${item.entity_type} ${item.entity_id}`)
    } catch (error) {
      syncLogger.error(`Failed to sync deletion of ${item.entity_type} ${item.entity_id}:`, error)
      throw error
    }
  }

  /**
   * Marks an entity as synced (updates is_synced flag)
   */
  private async markEntityAsSynced(entityType: string, entityId: string): Promise<void> {
    try {
      // エンティティが存在するか確認
      let entityExists = false

      switch (entityType) {
        case 'work_session':
          entityExists = !!(await workSessionRepository.getById(entityId))
          if (entityExists) {
            await workSessionRepository.update(entityId, { is_synced: true })
          }
          break
        case 'project':
          // Projectにはis_syncedフィールドがないため、存在確認のみ
          entityExists = !!(await projectRepository.getById(entityId))
          if (entityExists) {
            syncLogger.debug(`Project ${entityId} synced successfully`)
          }
          break
        case 'big_task':
          // BigTaskにもis_syncedフィールドがないため、存在確認のみ
          entityExists = !!(await bigTaskRepository.getById(entityId))
          if (entityExists) {
            syncLogger.debug(`BigTask ${entityId} synced successfully`)
          }
          break
        case 'small_task':
          // SmallTaskにもis_syncedフィールドがないため、存在確認のみ
          entityExists = !!(await smallTaskRepository.getById(entityId))
          if (entityExists) {
            syncLogger.debug(`SmallTask ${entityId} synced successfully`)
          }
          break
        case 'mood_entry':
          // TODO: mood_entriesテーブルにis_syncedフィールドを追加する必要がある
          syncLogger.debug(`TODO: Mark mood_entry ${entityId} as synced`)
          entityExists = true
          break
        case 'dopamine_entry':
          // TODO: dopamine_entriesテーブルにis_syncedフィールドを追加する必要がある
          syncLogger.debug(`TODO: Mark dopamine_entry ${entityId} as synced`)
          entityExists = true
          break
        case 'daily_condition':
          // TODO: daily_conditionsテーブルにis_syncedフィールドを追加する必要がある
          syncLogger.debug(`TODO: Mark daily_condition ${entityId} as synced`)
          entityExists = true
          break
        case 'schedule_memo':
          // ScheduleMemoにもis_syncedフィールドがないため、存在確認のみ
          entityExists = !!(await scheduleMemoRepository.getById(entityId))
          if (entityExists) {
            syncLogger.debug(`ScheduleMemo ${entityId} synced successfully`)
          }
          break
        default:
          syncLogger.warn(`Unknown entity type for marking as synced: ${entityType}`)
          entityExists = true
      }

      if (!entityExists) {
        syncLogger.warn(
          `${entityType} ${entityId} not found in local database (might have been deleted or not yet committed)`
        )
      } else {
        syncLogger.debug(`${entityType} ${entityId} marked as synced`)
      }
    } catch (error) {
      syncLogger.error(`Failed to mark ${entityType} ${entityId} as synced:`, error)
      // エラーは警告として扱い、同期処理自体は成功とする
      syncLogger.warn('Continuing despite marking error - sync was successful')
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

    // CREATE操作の場合、dataは必須
    if (operation === 'create' && !data) {
      syncLogger.error('Data is required for create operation', {
        entityType,
        entityId,
        operation,
      })
      throw new Error('Data is required for create operation')
    }

    const operationType = operation.toUpperCase() as 'CREATE' | 'UPDATE' | 'DELETE'

    // 既存のアイテムをチェック
    const existingItem = await syncQueueRepository.findExistingItem(
      entityType,
      entityId,
      operationType
    )

    if (existingItem) {
      syncLogger.debug('既存の同期キューアイテムが見つかりました:', {
        id: existingItem.id,
        status: existingItem.status,
        entityType,
        entityId,
        operationType,
      })

      // pending または processing の場合は何もしない
      if (existingItem.status === 'pending' || existingItem.status === 'processing') {
        syncLogger.debug('既に同期待ちまたは処理中のため、スキップします')
        return
      }

      // failed の場合はリセット
      if (existingItem.status === 'failed') {
        syncLogger.debug('失敗したアイテムをリセットします')
        await syncQueueRepository.resetFailedItem(existingItem.id, data)

        // 自動同期が有効な場合は即座に同期
        if (syncStore.isOnline && syncStore.autoSyncEnabled) {
          this.processSyncQueue()
        }
        return
      }
    }

    // 新規作成
    const queueItem: Omit<SyncQueueItem, 'id' | 'created_at' | 'updated_at'> = {
      user_id: 'current-user', // In a real app, get from auth context
      entity_type: entityType,
      entity_id: entityId,
      operation_type: operationType,
      data: data ? JSON.stringify(data) : undefined,
      status: 'pending',
      attempt_count: 0,
      last_attempted: undefined,
      error_message: undefined,
      version: 1,
    }

    const dataStr = queueItem.data as string | undefined
    syncLogger.debug('Creating sync queue item:', {
      ...queueItem,
      dataLength: dataStr ? dataStr.length : 0,
      hasData: !!dataStr,
    })

    try {
      const createdItem = await syncQueueRepository.create(queueItem)
      syncLogger.debug('Created sync queue item:', {
        id: createdItem.id,
        hasData: !!createdItem.data,
        dataLength: createdItem.data ? createdItem.data.length : 0,
      })

      // 作成直後に再度読み込んで確認
      const verifyItem = await syncQueueRepository.getById(createdItem.id)
      syncLogger.debug('Verified sync queue item:', {
        id: verifyItem?.id,
        hasData: !!verifyItem?.data,
        dataLength: verifyItem?.data?.length,
        data: verifyItem?.data,
      })

      syncStore.addToSyncQueue(createdItem)

      // If we're online and auto-sync is enabled, trigger immediate sync
      if (syncStore.isOnline && syncStore.autoSyncEnabled) {
        this.processSyncQueue()
      }
    } catch (error) {
      syncLogger.error('Failed to add item to sync queue:', error)
      syncStore.addSyncError(error instanceof Error ? error.message : 'Failed to queue sync item')
    }
  }

  /**
   * Gets the current queue length
   */
  private async getQueueLength(): Promise<number> {
    const items = await syncQueueRepository.getPending()
    return items.length
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
        error_message: undefined,
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
      autoSyncEnabled: syncStore.autoSyncEnabled,
    }
  }
}
