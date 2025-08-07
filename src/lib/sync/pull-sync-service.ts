/**
 * プル同期サービス - DynamoDBからIndexedDBへデータを同期
 */

import {
  projectRepository,
  bigTaskRepository,
  smallTaskRepository,
  moodEntryRepository,
  dopamineEntryRepository,
  workSessionRepository,
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
      syncLogger.info('🔽 プル同期を開始します（無限ループ対策済み）')

      // APIからデータを取得
      const apiUrl = `/api/sync/pull?userId=${userId}`
      const apiKey = process.env.NEXT_PUBLIC_SYNC_API_KEY || 'development-key'

      syncLogger.debug('API呼び出し:', { url: apiUrl, hasApiKey: !!apiKey })

      const response = await fetch(apiUrl, {
        headers: {
          'x-api-key': apiKey,
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        syncLogger.error('プル同期APIエラー:', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText.substring(0, 200), // 最初の200文字のみ
        })
        throw new Error(`プル同期APIエラー: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'プル同期に失敗しました')
      }

      syncLogger.info('クラウドからデータを取得しました:', {
        projects: result.data.projects.length,
        bigTasks: result.data.bigTasks.length,
        smallTasks: result.data.smallTasks.length,
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
      // エラーの詳細をログに記録
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        syncLogger.error('プル同期ネットワークエラー: APIに接続できません', {
          message: error.message,
          stack: error.stack,
        })
        syncStore.addSyncError('ネットワークエラー: 同期サーバーに接続できません')
      } else {
        syncLogger.error('プル同期エラー:', error)
        syncStore.addSyncError(error instanceof Error ? error.message : 'プル同期エラー')
      }
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
        syncLogger.info('🔍 Creating new project from cloud:', {
          cloudId: cloudProject.id,
          cloudUpdatedAt: cloudProject.updated_at,
          cloudName: cloudProject.name,
        })
        const created = await projectRepository.createWithId(cloudProject)
        syncLogger.info('✅ Created project with ID:', {
          id: created.id,
          name: created.name,
          fromCloud: true,
        })
        syncLogger.debug('新規プロジェクトを作成:', cloudProject.id)
      } else if (new Date(cloudProject.updated_at) > new Date(localProject.updated_at)) {
        // クラウドの方が新しい → 更新（プル同期専用メソッドを使用）
        syncLogger.info('🔄 Updating project from cloud (preventing sync loop):', {
          cloudId: cloudProject.id,
          cloudUpdatedAt: cloudProject.updated_at,
          localUpdatedAt: localProject.updated_at,
          cloudName: cloudProject.name,
        })
        await projectRepository.updateFromPullSync(cloudProject.id, cloudProject)
        syncLogger.debug('プロジェクトを更新（プル同期）:', cloudProject.id)
      } else {
        syncLogger.debug('⏭️ Skipping project update (local is newer or same):', {
          cloudId: cloudProject.id,
          cloudUpdatedAt: cloudProject.updated_at,
          localUpdatedAt: localProject.updated_at,
        })
      }
    }

    // BigTaskのマージ
    for (const cloudBigTask of cloudData.bigTasks) {
      const localBigTask = await bigTaskRepository.getById(cloudBigTask.id)

      if (!localBigTask) {
        syncLogger.info('🔍 Creating new BigTask from cloud:', {
          cloudId: cloudBigTask.id,
          cloudUpdatedAt: cloudBigTask.updated_at,
          cloudName: cloudBigTask.title,
        })
        const created = await bigTaskRepository.createWithId(cloudBigTask)
        syncLogger.info('✅ Created BigTask with ID:', {
          id: created.id,
          title: created.title,
          fromCloud: true,
        })
        syncLogger.debug('新規BigTaskを作成:', cloudBigTask.id)
      } else if (new Date(cloudBigTask.updated_at) > new Date(localBigTask.updated_at)) {
        // クラウドの方が新しい → 更新（プル同期専用メソッドを使用）
        syncLogger.info('🔄 Updating BigTask from cloud (preventing sync loop):', {
          cloudId: cloudBigTask.id,
          cloudUpdatedAt: cloudBigTask.updated_at,
          localUpdatedAt: localBigTask.updated_at,
          cloudTitle: cloudBigTask.title,
        })
        await bigTaskRepository.updateFromPullSync(cloudBigTask.id, cloudBigTask)
        syncLogger.debug('BigTaskを更新（プル同期）:', cloudBigTask.id)
      } else {
        syncLogger.debug('⏭️ Skipping BigTask update (local is newer or same):', {
          cloudId: cloudBigTask.id,
          cloudUpdatedAt: cloudBigTask.updated_at,
          localUpdatedAt: localBigTask.updated_at,
        })
      }
    }

    // SmallTaskのマージ
    for (const cloudSmallTask of cloudData.smallTasks) {
      const localSmallTask = await smallTaskRepository.getById(cloudSmallTask.id)

      if (!localSmallTask) {
        syncLogger.info('🔍 Creating new SmallTask from cloud:', {
          cloudId: cloudSmallTask.id,
          cloudUpdatedAt: cloudSmallTask.updated_at,
          cloudName: cloudSmallTask.title,
        })
        const created = await smallTaskRepository.createWithId(cloudSmallTask)
        syncLogger.info('✅ Created SmallTask with ID:', {
          id: created.id,
          title: created.title,
          fromCloud: true,
        })
        syncLogger.debug('新規SmallTaskを作成:', cloudSmallTask.id)
      } else if (new Date(cloudSmallTask.updated_at) > new Date(localSmallTask.updated_at)) {
        // クラウドの方が新しい → 更新（プル同期専用メソッドを使用）
        syncLogger.info('🔄 Updating SmallTask from cloud (preventing sync loop):', {
          cloudId: cloudSmallTask.id,
          cloudUpdatedAt: cloudSmallTask.updated_at,
          localUpdatedAt: localSmallTask.updated_at,
          cloudTitle: cloudSmallTask.title,
        })
        await smallTaskRepository.updateFromPullSync(cloudSmallTask.id, cloudSmallTask)
        syncLogger.debug('SmallTaskを更新（プル同期）:', cloudSmallTask.id)
      } else {
        syncLogger.debug('⏭️ Skipping SmallTask update (local is newer or same):', {
          cloudId: cloudSmallTask.id,
          cloudUpdatedAt: cloudSmallTask.updated_at,
          localUpdatedAt: localSmallTask.updated_at,
        })
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
  startPeriodicPull(intervalMs: number = 300000): void {
    // デフォルト5分
    syncLogger.info(`定期プル同期を開始します（間隔: ${intervalMs}ms）`)

    // 即座に1回実行
    this.pullFromCloud()

    // 定期実行
    setInterval(() => {
      this.pullFromCloud()
    }, intervalMs)
  }
}
