/**
 * SyncProvider - バックグラウンド同期を管理するプロバイダー
 */
'use client'

import { useEffect, useRef } from 'react'
import { SyncService } from '@/lib/sync/sync-service'
import { PullSyncService } from '@/lib/sync/pull-sync-service'
import { OfflineDetector } from '@/lib/sync/offline-detector'
import { useSyncStore } from '@/stores/sync-store'
import { clientEnv } from '@/config/env'

interface SyncProviderProps {
  children: React.ReactNode
  syncIntervalMs?: number // 同期間隔（ミリ秒）
  enableAutoSync?: boolean // 自動同期を有効にするか
}

export function SyncProvider({
  children,
  syncIntervalMs = clientEnv.SYNC_INTERVAL_MS, // 環境変数からデフォルト値を取得
  enableAutoSync = clientEnv.SYNC_ENABLED,
}: SyncProviderProps) {
  const syncService = useRef(SyncService.getInstance())
  const pullSyncService = useRef(PullSyncService.getInstance())
  const offlineDetector = useRef(OfflineDetector.getInstance())
  const setAutoSync = useSyncStore(state => state.setAutoSync)

  useEffect(() => {
    // OfflineDetectorを初期化（自動的にイベントリスナーが設定される）
    const detector = offlineDetector.current
    console.log('オフライン検知を初期化しました')

    const service = syncService.current

    // 自動同期の設定を更新
    setAutoSync(enableAutoSync)

    if (enableAutoSync) {
      console.log(`バックグラウンド同期を開始します（間隔: ${syncIntervalMs}ms）`)

      // オンラインの場合のみ初回同期を実行
      if (detector.getStatus()) {
        // プッシュ同期（IndexedDB → DynamoDB）
        service.processSyncQueue().catch(error => {
          console.error('初回同期に失敗しました:', error)
        })

        // プル同期（DynamoDB → IndexedDB）- 起動時に1回実行
        pullSyncService.current.initialSync().catch(error => {
          console.error('初回プル同期に失敗しました:', error)
        })
      }

      // 定期同期を開始
      service.startAutoSync(syncIntervalMs)

      // 定期プル同期を開始（5分ごと）
      pullSyncService.current.startPeriodicPull(300000)
    }

    // クリーンアップ
    return () => {
      console.log('バックグラウンド同期を停止します')
      service.stopAutoSync()
    }
  }, [syncIntervalMs, enableAutoSync, setAutoSync])

  // デバッグ用：同期状態をログに出力
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const unsubscribe = useSyncStore.subscribe(state => {
        console.log(`同期状態: ${state.isSyncing ? '同期中' : 'アイドル'}`)
      })

      return unsubscribe
    }
  }, [])

  return <>{children}</>
}
