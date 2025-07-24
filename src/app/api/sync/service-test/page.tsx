/**
 * SyncServiceテストページ
 * SyncServiceを使用した同期処理をテストできるページ
 */

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SyncService } from '@/lib/sync/sync-service'
import { workSessionRepository } from '@/lib/db/repositories'
import { useSyncStore } from '@/stores/sync-store'
import { useWorkSessions } from '@/hooks/use-timer'
import { format } from 'date-fns'
import { Loader2, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { toast } from 'sonner'

export default function SyncServiceTestPage() {
  const [loading, setLoading] = useState(false)
  const syncService = SyncService.getInstance()
  
  // Zustandストアから同期状態を取得
  const { 
    isOnline, 
    isSyncing, 
    syncQueue, 
    lastSyncTime,
    getPendingItemsCount,
    getFailedItemsCount
  } = useSyncStore()

  // 今日のWorkSessionを取得
  const today = format(new Date(), 'yyyy-MM-dd')
  const { data: sessions = [] } = useWorkSessions('current-user', today)

  // 同期統計を定期的に更新
  const [syncStats, setSyncStats] = useState(syncService.getSyncStats())
  
  useEffect(() => {
    const interval = setInterval(() => {
      setSyncStats(syncService.getSyncStats())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // WorkSessionを同期キューに追加
  const addToQueue = async (session: any) => {
    try {
      setLoading(true)
      
      console.log('同期キューに追加するセッション:', session)
      
      // セッションデータを同期キューに追加
      await syncService.addToSyncQueue(
        'work_session',
        session.id,
        'create',
        session
      )
      
      toast.success('同期キューに追加しました')
    } catch (error) {
      console.error('キュー追加エラー:', error)
      console.error('セッションデータ:', session)
      toast.error(`同期キューへの追加に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  // 手動で同期を実行
  const manualSync = async () => {
    try {
      setLoading(true)
      toast.info('同期を開始します...')
      await syncService.forcSync()
      toast.success('同期が完了しました')
    } catch (error) {
      console.error('同期エラー:', error)
      toast.error('同期に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  // 自動同期の開始/停止
  const toggleAutoSync = () => {
    const syncStore = useSyncStore.getState()
    if (syncStore.autoSyncEnabled) {
      syncService.stopAutoSync()
      syncStore.setAutoSyncEnabled(false)
      toast.info('自動同期を停止しました')
    } else {
      syncService.startAutoSync(10000) // 10秒ごと
      syncStore.setAutoSyncEnabled(true)
      toast.success('自動同期を開始しました（10秒ごと）')
    }
  }

  // 失敗したアイテムを再試行
  const retryFailed = async () => {
    try {
      setLoading(true)
      await syncService.retryFailedItems()
      toast.success('失敗したアイテムを再試行しました')
    } catch (error) {
      console.error('再試行エラー:', error)
      toast.error('再試行に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">SyncServiceテスト</h1>

      {/* 同期ステータス */}
      <Card className="p-4 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          同期ステータス
          {isOnline ? (
            <Wifi className="h-5 w-5 text-green-600" />
          ) : (
            <WifiOff className="h-5 w-5 text-red-600" />
          )}
        </h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">オンライン状態</p>
            <p className={`font-medium ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
              {isOnline ? 'オンライン' : 'オフライン'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">同期中</p>
            <p className="font-medium">{isSyncing ? 'はい' : 'いいえ'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">保留中のアイテム</p>
            <p className="font-medium">{syncStats.pendingItems}</p>
          </div>
          <div>
            <p className="text-muted-foreground">失敗したアイテム</p>
            <p className="font-medium text-red-600">{syncStats.failedItems}</p>
          </div>
          <div>
            <p className="text-muted-foreground">最終同期時刻</p>
            <p className="font-medium">
              {lastSyncTime ? format(new Date(lastSyncTime), 'HH:mm:ss') : '未実行'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">自動同期</p>
            <p className="font-medium">
              {syncStats.autoSyncEnabled ? '有効' : '無効'}
            </p>
          </div>
        </div>
      </Card>

      {/* 同期コントロール */}
      <Card className="p-4 mb-6">
        <h2 className="text-lg font-semibold mb-4">同期コントロール</h2>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={manualSync}
            disabled={loading || isSyncing}
          >
            {isSyncing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                同期中...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                手動同期
              </>
            )}
          </Button>
          <Button
            onClick={toggleAutoSync}
            variant={syncStats.autoSyncEnabled ? "destructive" : "default"}
          >
            {syncStats.autoSyncEnabled ? '自動同期を停止' : '自動同期を開始'}
          </Button>
          {syncStats.failedItems > 0 && (
            <Button
              onClick={retryFailed}
              disabled={loading}
              variant="outline"
            >
              失敗したアイテムを再試行
            </Button>
          )}
        </div>
      </Card>

      {/* WorkSessionリスト */}
      <Card className="p-4 mb-6">
        <h2 className="text-lg font-semibold mb-4">今日のWorkSession</h2>
        {sessions.length === 0 ? (
          <p className="text-muted-foreground">今日のセッションがありません</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between p-2 border rounded">
                <div>
                  <p className="font-medium">
                    {format(new Date(session.start_time), 'HH:mm')} - 
                    {session.end_time ? format(new Date(session.end_time), 'HH:mm') : '進行中'}
                    {session.is_synced && (
                      <span className="ml-2 text-xs text-green-600">✓ 同期済み</span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {session.task_description || 'タスク説明なし'}
                  </p>
                </div>
                <Button
                  onClick={() => addToQueue(session)}
                  disabled={loading || session.is_synced}
                  size="sm"
                  variant="outline"
                >
                  {session.is_synced ? '同期済み' : 'キューに追加'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 同期キュー */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-4">同期キュー</h2>
        {syncQueue.length === 0 ? (
          <p className="text-muted-foreground">キューは空です</p>
        ) : (
          <div className="space-y-2">
            {syncQueue.map((item) => (
              <div
                key={item.id}
                className={`p-2 rounded border ${
                  item.status === 'failed' 
                    ? 'border-red-200 bg-red-50' 
                    : item.status === 'processing'
                    ? 'border-blue-200 bg-blue-50'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm">
                      {item.entity_type} - {item.operation_type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ID: {item.entity_id}
                    </p>
                    {item.error_message && (
                      <p className="text-xs text-red-600 mt-1">
                        エラー: {item.error_message}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-right">
                    <p className={`font-medium ${
                      item.status === 'failed' ? 'text-red-600' :
                      item.status === 'processing' ? 'text-blue-600' :
                      'text-gray-600'
                    }`}>
                      {item.status === 'pending' ? '保留中' :
                       item.status === 'processing' ? '処理中' :
                       item.status === 'completed' ? '完了' : '失敗'}
                    </p>
                    <p className="text-muted-foreground">
                      試行: {item.attempt_count}回
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}