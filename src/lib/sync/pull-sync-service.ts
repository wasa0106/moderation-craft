/**
 * プル同期サービス - DynamoDBからIndexedDBへデータを同期
 */

import { 
  projectRepository,
  bigTaskRepository,
  smallTaskRepository,
  moodEntryRepository,
  dopamineEntryRepository,
  workSessionRepository
} from '@/lib/db/repositories'
import { syncLogger } from '@/lib/utils/logger'
import { useSyncStore } from '@/stores/sync-store'

export class PullSyncService {
  private static instance: PullSyncService
  private isPulling = false
  
  private constructor() {}
  
  static getInstance(): PullSyncService {
    if (!PullSyncService.instance) {
      PullSyncService.instance = new PullSyncService()
    }
    return PullSyncService.instance
  }
  
  /**
   * DynamoDBから最新データを取得してIndexedDBに反映
   */
  async pullFromCloud(userId: string = 'current-user'): Promise<void> {
    if (this.isPulling) {
      syncLogger.debug('プル同期は既に実行中です')
      return
    }
    
    this.isPulling = true
    const syncStore = useSyncStore.getState()
    
    try {
      syncLogger.info('プル同期を開始します')
      
      // APIからデータを取得
      const response = await fetch(`/api/sync/pull?userId=${userId}`, {
        headers: {
          'x-api-key': process.env.NEXT_PUBLIC_SYNC_API_KEY || 'development-key'
        }
      })
      
      if (!response.ok) {
        throw new Error('プル同期APIエラー')
      }
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'プル同期に失敗しました')
      }
      
      syncLogger.info('クラウドからデータを取得しました:', {
        projects: result.data.projects.length,
        bigTasks: result.data.bigTasks.length,
        smallTasks: result.data.smallTasks.length
      })
      
      // データをIndexedDBに反映（競合解決：最新を優先）
      await this.mergeData(result.data)
      
      // 最終同期時刻を更新
      syncStore.setLastPullTime(result.syncTime)
      
      syncLogger.info('プル同期が完了しました')
      
      // 開発環境では通知
      if (process.env.NODE_ENV === 'development') {
        const { toast } = await import('sonner')
        toast.success('クラウドからデータを同期しました')
      }
      
    } catch (error) {
      syncLogger.error('プル同期エラー:', error)
      syncStore.addSyncError(error instanceof Error ? error.message : 'プル同期エラー')
    } finally {
      this.isPulling = false
    }
  }
  
  /**
   * クラウドのデータをローカルにマージ
   * 競合解決ルール：updated_atが新しい方を優先
   */
  private async mergeData(cloudData: any): Promise<void> {
    // プロジェクトのマージ
    for (const cloudProject of cloudData.projects) {
      const localProject = await projectRepository.getById(cloudProject.id)
      
      if (!localProject) {
        // ローカルに存在しない → 新規作成
        await projectRepository.create(cloudProject)
        syncLogger.debug('新規プロジェクトを作成:', cloudProject.id)
      } else if (new Date(cloudProject.updated_at) > new Date(localProject.updated_at)) {
        // クラウドの方が新しい → 更新
        await projectRepository.update(cloudProject.id, cloudProject)
        syncLogger.debug('プロジェクトを更新:', cloudProject.id)
      }
      // ローカルの方が新しい場合は何もしない（次回のプッシュ同期で反映される）
    }
    
    // BigTaskのマージ
    for (const cloudBigTask of cloudData.bigTasks) {
      const localBigTask = await bigTaskRepository.getById(cloudBigTask.id)
      
      if (!localBigTask) {
        await bigTaskRepository.create(cloudBigTask)
        syncLogger.debug('新規BigTaskを作成:', cloudBigTask.id)
      } else if (new Date(cloudBigTask.updated_at) > new Date(localBigTask.updated_at)) {
        await bigTaskRepository.update(cloudBigTask.id, cloudBigTask)
        syncLogger.debug('BigTaskを更新:', cloudBigTask.id)
      }
    }
    
    // SmallTaskのマージ
    for (const cloudSmallTask of cloudData.smallTasks) {
      const localSmallTask = await smallTaskRepository.getById(cloudSmallTask.id)
      
      if (!localSmallTask) {
        await smallTaskRepository.create(cloudSmallTask)
        syncLogger.debug('新規SmallTaskを作成:', cloudSmallTask.id)
      } else if (new Date(cloudSmallTask.updated_at) > new Date(localSmallTask.updated_at)) {
        await smallTaskRepository.update(cloudSmallTask.id, cloudSmallTask)
        syncLogger.debug('SmallTaskを更新:', cloudSmallTask.id)
      }
    }
    
    // 削除の検出（シンプル版では実装しない）
    // より高度な実装では、クラウドに存在しないローカルデータを削除する処理を追加
  }
  
  /**
   * 初回起動時の同期
   */
  async initialSync(userId: string = 'current-user'): Promise<void> {
    syncLogger.info('初回同期を実行します')
    await this.pullFromCloud(userId)
  }
  
  /**
   * 定期的な同期（プル）
   */
  startPeriodicPull(intervalMs: number = 300000): void { // デフォルト5分
    syncLogger.info(`定期プル同期を開始します（間隔: ${intervalMs}ms）`)
    
    // 即座に1回実行
    this.pullFromCloud()
    
    // 定期実行
    setInterval(() => {
      this.pullFromCloud()
    }, intervalMs)
  }
}