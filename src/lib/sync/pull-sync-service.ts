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
          errorText: errorText.substring(0, 500), // エラー詳細を500文字まで表示
          url: '/api/sync/pull',
        })
        throw new Error(`プル同期APIエラー: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'プル同期に失敗しました')
      }

      syncLogger.info('クラウドからデータを取得しました:', {
        projects: result.data.projects?.length || 0,
        bigTasks: result.data.bigTasks?.length || 0,
        smallTasks: result.data.smallTasks?.length || 0,
        workSessions: result.data.workSessions?.length || 0,
        moodEntries: result.data.moodEntries?.length || 0,
        dopamineEntries: result.data.dopamineEntries?.length || 0,
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
        // エラーオブジェクトの詳細を正しくログに記録
        syncLogger.error('プル同期エラー:', {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          error: String(error),
        })
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

    // WorkSessionのマージ
    for (const cloudWorkSession of cloudData.workSessions || []) {
      const localWorkSession = await workSessionRepository.getById(cloudWorkSession.id)

      if (!localWorkSession) {
        syncLogger.info('🔍 Creating new WorkSession from cloud:', {
          cloudId: cloudWorkSession.id,
          cloudUpdatedAt: cloudWorkSession.updated_at,
          taskId: cloudWorkSession.small_task_id,
        })
        const created = await workSessionRepository.createWithId(cloudWorkSession)
        syncLogger.info('✅ Created WorkSession with ID:', {
          id: created.id,
          taskId: created.small_task_id,
          fromCloud: true,
        })
        syncLogger.debug('新規WorkSessionを作成:', cloudWorkSession.id)
      } else if (new Date(cloudWorkSession.updated_at) > new Date(localWorkSession.updated_at)) {
        // クラウドの方が新しい → 更新（プル同期専用メソッドを使用）
        syncLogger.info('🔄 Updating WorkSession from cloud (preventing sync loop):', {
          cloudId: cloudWorkSession.id,
          cloudUpdatedAt: cloudWorkSession.updated_at,
          localUpdatedAt: localWorkSession.updated_at,
        })
        await workSessionRepository.updateFromPullSync(cloudWorkSession.id, cloudWorkSession)
        syncLogger.debug('WorkSessionを更新（プル同期）:', cloudWorkSession.id)
      } else {
        syncLogger.debug('⏭️ Skipping WorkSession update (local is newer or same):', {
          cloudId: cloudWorkSession.id,
          cloudUpdatedAt: cloudWorkSession.updated_at,
          localUpdatedAt: localWorkSession.updated_at,
        })
      }
    }

    // MoodEntryのマージ
    for (const cloudMoodEntry of cloudData.moodEntries || []) {
      const localMoodEntry = await moodEntryRepository.getById(cloudMoodEntry.id)

      if (!localMoodEntry) {
        syncLogger.info('🔍 Creating new MoodEntry from cloud:', {
          cloudId: cloudMoodEntry.id,
          cloudUpdatedAt: cloudMoodEntry.updated_at,
          mood: cloudMoodEntry.mood,
        })
        const created = await moodEntryRepository.createWithId(cloudMoodEntry)
        syncLogger.info('✅ Created MoodEntry with ID:', {
          id: created.id,
          mood: created.mood,
          fromCloud: true,
        })
        syncLogger.debug('新規MoodEntryを作成:', cloudMoodEntry.id)
      } else if (new Date(cloudMoodEntry.updated_at) > new Date(localMoodEntry.updated_at)) {
        // クラウドの方が新しい → 更新（プル同期専用メソッドを使用）
        syncLogger.info('🔄 Updating MoodEntry from cloud (preventing sync loop):', {
          cloudId: cloudMoodEntry.id,
          cloudUpdatedAt: cloudMoodEntry.updated_at,
          localUpdatedAt: localMoodEntry.updated_at,
        })
        await moodEntryRepository.updateFromPullSync(cloudMoodEntry.id, cloudMoodEntry)
        syncLogger.debug('MoodEntryを更新（プル同期）:', cloudMoodEntry.id)
      } else {
        syncLogger.debug('⏭️ Skipping MoodEntry update (local is newer or same):', {
          cloudId: cloudMoodEntry.id,
          cloudUpdatedAt: cloudMoodEntry.updated_at,
          localUpdatedAt: localMoodEntry.updated_at,
        })
      }
    }

    // DopamineEntryのマージ
    for (const cloudDopamineEntry of cloudData.dopamineEntries || []) {
      const localDopamineEntry = await dopamineEntryRepository.getById(cloudDopamineEntry.id)

      if (!localDopamineEntry) {
        syncLogger.info('🔍 Creating new DopamineEntry from cloud:', {
          cloudId: cloudDopamineEntry.id,
          cloudUpdatedAt: cloudDopamineEntry.updated_at,
          activity: cloudDopamineEntry.activity,
        })
        const created = await dopamineEntryRepository.createWithId(cloudDopamineEntry)
        syncLogger.info('✅ Created DopamineEntry with ID:', {
          id: created.id,
          activity: created.activity,
          fromCloud: true,
        })
        syncLogger.debug('新規DopamineEntryを作成:', cloudDopamineEntry.id)
      } else if (new Date(cloudDopamineEntry.updated_at) > new Date(localDopamineEntry.updated_at)) {
        // クラウドの方が新しい → 更新（プル同期専用メソッドを使用）
        syncLogger.info('🔄 Updating DopamineEntry from cloud (preventing sync loop):', {
          cloudId: cloudDopamineEntry.id,
          cloudUpdatedAt: cloudDopamineEntry.updated_at,
          localUpdatedAt: localDopamineEntry.updated_at,
        })
        await dopamineEntryRepository.updateFromPullSync(cloudDopamineEntry.id, cloudDopamineEntry)
        syncLogger.debug('DopamineEntryを更新（プル同期）:', cloudDopamineEntry.id)
      } else {
        syncLogger.debug('⏭️ Skipping DopamineEntry update (local is newer or same):', {
          cloudId: cloudDopamineEntry.id,
          cloudUpdatedAt: cloudDopamineEntry.updated_at,
          localUpdatedAt: localDopamineEntry.updated_at,
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
