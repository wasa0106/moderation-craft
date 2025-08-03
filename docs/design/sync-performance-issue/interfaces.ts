/**
 * 同期パフォーマンス改善のためのTypeScriptインターフェース定義
 */

import { DatabaseEntity } from '@/types'

/**
 * 改善された同期キューアイテムのインターフェース
 */
export interface ImprovedSyncQueueItem extends DatabaseEntity {
  user_id: string
  entity_type: string
  entity_id: string
  operation_type: 'CREATE' | 'UPDATE' | 'DELETE'
  data?: string // シリアライズされたエンティティデータ
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'dormant'
  attempt_count: number
  last_attempted?: string
  next_retry_after?: string // 次回リトライ時刻
  error_message?: string
  error_type?: 'network' | 'auth' | 'rate_limit' | 'unknown'
  version: number
  
  // Bulk操作の最適化用フィールド
  is_bulk?: boolean
  bulk_operation_id?: string // Bulk操作をグループ化するID
  entity_count?: number // Bulk操作に含まれるエンティティ数
}

/**
 * Bulk同期操作のインターフェース
 */
export interface BulkSyncOperation {
  id: string
  operation_type: 'CREATE' | 'UPDATE' | 'DELETE'
  entity_type: string
  entities: Array<{
    id: string
    data: any
  }>
  created_at: string
  processed_at?: string
}

/**
 * 同期サービスの設定インターフェース
 */
export interface SyncServiceConfig {
  syncInterval: number // 同期間隔（ミリ秒）
  batchSize: number // 一度に処理する同期アイテムの最大数
  maxRetries: number // 最大リトライ回数
  retryStrategy: RetryStrategy
  enableAutoSync: boolean
  enableBulkOptimization: boolean
  compressionEnabled: boolean
}

/**
 * リトライ戦略の定義
 */
export interface RetryStrategy {
  network: {
    maxRetries: number
    baseDelay: number
    maxDelay: number
  }
  auth: {
    maxRetries: number
    baseDelay: number
  }
  rateLimit: {
    maxRetries: number
    baseDelay: number
    maxDelay: number
  }
  default: {
    maxRetries: number
    baseDelay: number
    maxDelay: number
  }
}

/**
 * 同期統計情報のインターフェース
 */
export interface SyncStatistics {
  totalPendingItems: number
  totalProcessingItems: number
  totalFailedItems: number
  totalDormantItems: number
  lastSyncTime?: string
  lastSyncDuration?: number // ミリ秒
  averageSyncDuration: number // 過去10回の平均
  syncSuccessRate: number // 0-100
  errorsByType: {
    network: number
    auth: number
    rateLimit: number
    unknown: number
  }
  bulkOperationsOptimized: number
  dataSaved: number // バイト数
}

/**
 * 同期イベントのインターフェース
 */
export interface SyncEvent {
  type: 'sync_started' | 'sync_completed' | 'sync_failed' | 'item_processed' | 'item_failed'
  timestamp: string
  details: {
    itemCount?: number
    duration?: number
    error?: string
    errorType?: string
  }
}

/**
 * 同期キュー管理の改善されたインターフェース
 */
export interface ImprovedSyncQueueManager {
  // 基本操作
  addToQueue(
    entityType: string,
    entityId: string,
    operation: 'CREATE' | 'UPDATE' | 'DELETE',
    data?: any
  ): Promise<void>
  
  // Bulk操作の最適化
  addBulkToQueue(
    entityType: string,
    operations: Array<{
      entityId: string
      operation: 'CREATE' | 'UPDATE' | 'DELETE'
      data?: any
    }>
  ): Promise<void>
  
  // キュー管理
  getPendingItems(limit?: number): Promise<ImprovedSyncQueueItem[]>
  getItemsByStatus(status: ImprovedSyncQueueItem['status']): Promise<ImprovedSyncQueueItem[]>
  markAsProcessing(itemId: string): Promise<void>
  markAsCompleted(itemId: string): Promise<void>
  markAsFailed(itemId: string, error: string, errorType?: string): Promise<void>
  markAsDormant(itemId: string): Promise<void>
  
  // リトライ管理
  getRetryableItems(): Promise<ImprovedSyncQueueItem[]>
  reviveDormantItems(): Promise<number>
  
  // クリーンアップ
  cleanupCompletedItems(olderThanDays: number): Promise<number>
  cleanupFailedItems(maxAttempts: number): Promise<number>
  
  // 統計情報
  getStatistics(): Promise<SyncStatistics>
  
  // 重複管理
  checkDuplicate(
    entityType: string,
    entityId: string,
    operation: string
  ): Promise<ImprovedSyncQueueItem | null>
  
  mergeDuplicates(existingItem: ImprovedSyncQueueItem, newData?: any): Promise<void>
}

/**
 * 同期プロセッサーのインターフェース
 */
export interface SyncProcessor {
  processBatch(items: ImprovedSyncQueueItem[]): Promise<ProcessResult[]>
  processItem(item: ImprovedSyncQueueItem): Promise<ProcessResult>
  handleError(item: ImprovedSyncQueueItem, error: Error): Promise<void>
  calculateRetryDelay(item: ImprovedSyncQueueItem): number
}

/**
 * 処理結果のインターフェース
 */
export interface ProcessResult {
  itemId: string
  success: boolean
  error?: {
    message: string
    type: 'network' | 'auth' | 'rate_limit' | 'unknown'
    retryable: boolean
  }
  processedAt: string
  duration: number
}

/**
 * 同期監視のインターフェース
 */
export interface SyncMonitor {
  onSyncStart(itemCount: number): void
  onSyncComplete(results: ProcessResult[]): void
  onSyncError(error: Error): void
  onItemProcessed(item: ImprovedSyncQueueItem, result: ProcessResult): void
  getMetrics(): SyncMetrics
}

/**
 * 同期メトリクスのインターフェース
 */
export interface SyncMetrics {
  currentQueueSize: number
  processingRate: number // items/second
  errorRate: number // errors/minute
  averageProcessingTime: number // milliseconds
  lastError?: {
    timestamp: string
    message: string
    type: string
  }
  performance: {
    cpuUsage: number // percentage
    memoryUsage: number // MB
    networkLatency: number // milliseconds
  }
}

/**
 * データ圧縮のインターフェース
 */
export interface DataCompressor {
  compress(data: any): Promise<string>
  decompress(compressed: string): Promise<any>
  estimateCompressionRatio(data: any): number
}

/**
 * 同期APIリクエストのインターフェース
 */
export interface SyncApiRequest {
  entity_type: string
  operation: 'CREATE' | 'UPDATE' | 'DELETE'
  payload: any
  batch?: Array<{
    operation: 'CREATE' | 'UPDATE' | 'DELETE'
    payload: any
  }>
}

/**
 * 同期APIレスポンスのインターフェース
 */
export interface SyncApiResponse {
  success: boolean
  processedCount?: number
  errors?: Array<{
    entityId: string
    error: string
  }>
  timestamp: string
}