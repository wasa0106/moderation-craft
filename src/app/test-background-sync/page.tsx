/**
 * バックグラウンド同期のテストページ
 */
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SyncService } from '@/lib/sync/sync-service'
import { useSyncStore } from '@/stores/sync-store'
import { projectRepository, syncQueueRepository } from '@/lib/db/repositories'
import { toast } from 'sonner'
import { Loader2, RefreshCw, Wifi, WifiOff } from 'lucide-react'

export default function TestBackgroundSyncPage() {
  const [loading, setLoading] = useState(false)
  const [queueItems, setQueueItems] = useState<any[]>([])
  const [syncStats, setSyncStats] = useState<any>(null)
  
  // Zustand store の状態を購読
  const { 
    isOnline, 
    isSyncing, 
    autoSyncEnabled, 
    lastSyncTime,
    syncErrors 
  } = useSyncStore()
  
  const syncService = SyncService.getInstance()
  
  // テストモードを有効化
  useEffect(() => {
    import('@/lib/sync/offline-detector').then(({ OfflineDetector }) => {
      const detector = OfflineDetector.getInstance()
      detector.setTestMode(true)
    })
    
    return () => {
      // クリーンアップ時にテストモードを無効化
      import('@/lib/sync/offline-detector').then(({ OfflineDetector }) => {
        const detector = OfflineDetector.getInstance()
        detector.setTestMode(false)
      })
    }
  }, [])

  // 定期的に状態を更新
  useEffect(() => {
    const updateStats = async () => {
      await loadQueueItems()
      setSyncStats(syncService.getSyncStats())
    }

    updateStats()
    const interval = setInterval(updateStats, 1000) // 1秒ごとに更新

    return () => clearInterval(interval)
  }, [])

  // 同期キューの内容を取得
  const loadQueueItems = async () => {
    const items = await syncQueueRepository.getAll()
    setQueueItems(items)
  }

  // テストデータを追加
  const addTestData = async () => {
    setLoading(true)
    try {
      // 一時的に自動同期を無効化して、キューに溜める
      const currentAutoSync = useSyncStore.getState().autoSyncEnabled
      useSyncStore.getState().setAutoSync(false)
      
      const testProject = {
        id: `test-bg-sync-${Date.now()}`,
        user_id: 'current-user',
        name: `バックグラウンド同期テスト ${new Date().toLocaleTimeString()}`,
        goal: 'バックグラウンド同期の動作確認',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active' as const,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // プロジェクトを作成
      await projectRepository.create(testProject)
      
      // 同期キューに追加（自動同期が無効なので即座には同期されない）
      await syncService.addToSyncQueue('project', testProject.id, 'create', testProject)
      
      // 自動同期を元に戻す
      useSyncStore.getState().setAutoSync(currentAutoSync)
      
      toast.success('テストデータを追加しました（同期待ち）')
      await loadQueueItems()
    } catch (error) {
      console.error('エラー:', error)
      toast.error('テストデータの追加に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  // 手動同期を実行
  const manualSync = async () => {
    setLoading(true)
    try {
      await syncService.forcSync()
      toast.success('手動同期を実行しました')
    } catch (error) {
      console.error('エラー:', error)
      toast.error('手動同期に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  // 自動同期の切り替え
  const toggleAutoSync = () => {
    const store = useSyncStore.getState()
    store.setAutoSync(!autoSyncEnabled)
    
    if (!autoSyncEnabled) {
      // 有効化時は即座に同期を開始
      syncService.startAutoSync(30000)
      toast.success('自動同期を有効にしました')
    } else {
      // 無効化
      syncService.stopAutoSync()
      toast.success('自動同期を無効にしました')
    }
  }

  // オンライン/オフラインの切り替え（テスト用）
  const toggleOnlineStatus = async () => {
    // OfflineDetectorを経由して状態を変更
    const { OfflineDetector } = await import('@/lib/sync/offline-detector')
    const detector = OfflineDetector.getInstance()
    
    // 現在の状態を反転
    const newStatus = !isOnline
    
    // OfflineDetectorのsetOnlineStatusメソッドを呼び出す
    // publicメソッドがないので、直接ストアを更新してイベントをトリガー
    if (newStatus) {
      // オンラインイベントを手動でトリガー
      window.dispatchEvent(new Event('online'))
    } else {
      // オフラインイベントを手動でトリガー
      window.dispatchEvent(new Event('offline'))
    }
    
    toast.info(`ステータスを${newStatus ? 'オンライン' : 'オフライン'}に変更しました`)
  }

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <h1 className="text-2xl font-bold mb-6">バックグラウンド同期テスト</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 同期ステータス */}
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-4">同期ステータス</h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span>接続状態:</span>
              <div className="flex items-center gap-2">
                {isOnline ? (
                  <>
                    <Wifi className="h-4 w-4 text-green-600" />
                    <Badge variant="secondary" className="bg-green-100">オンライン</Badge>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-4 w-4 text-red-600" />
                    <Badge variant="secondary" className="bg-red-100">オフライン</Badge>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span>同期状態:</span>
              {isSyncing ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <Badge variant="secondary">同期中</Badge>
                </div>
              ) : (
                <Badge variant="outline">アイドル</Badge>
              )}
            </div>
            
            <div className="flex items-center justify-between">
              <span>自動同期:</span>
              <Badge variant={autoSyncEnabled ? "default" : "outline"}>
                {autoSyncEnabled ? '有効' : '無効'}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span>最終同期:</span>
              <span className="text-sm text-muted-foreground">
                {lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString() : '未実行'}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span>保留中のアイテム:</span>
              <Badge>{syncStats?.pendingItems || 0}</Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span>失敗したアイテム:</span>
              <Badge variant="destructive">{syncStats?.failedItems || 0}</Badge>
            </div>
          </div>
          
          {syncErrors.length > 0 && (
            <div className="mt-4 p-2 bg-red-50 rounded text-sm">
              <p className="font-medium text-red-700">エラー:</p>
              <ul className="text-red-600">
                {syncErrors.slice(-3).map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {/* 操作パネル */}
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-4">操作</h2>
          <div className="space-y-2">
            <Button
              onClick={addTestData}
              disabled={loading}
              className="w-full"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              テストデータを追加
            </Button>
            
            <Button
              onClick={manualSync}
              disabled={loading || isSyncing}
              variant="secondary"
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              手動同期を実行
            </Button>
            
            <Button
              onClick={toggleAutoSync}
              variant="outline"
              className="w-full"
            >
              自動同期を{autoSyncEnabled ? '無効化' : '有効化'}
            </Button>
            
            <Button
              onClick={toggleOnlineStatus}
              variant="outline"
              className="w-full"
            >
              {isOnline ? 'オフライン' : 'オンライン'}に切り替え（テスト用）
            </Button>
          </div>
        </Card>

        {/* 同期キュー */}
        <Card className="p-4 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              同期キュー ({queueItems.length}件)
            </h2>
            <Button
              onClick={loadQueueItems}
              size="sm"
              variant="ghost"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          
          {queueItems.length === 0 ? (
            <p className="text-muted-foreground">キューは空です</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">エンティティ</th>
                    <th className="text-left p-2">操作</th>
                    <th className="text-left p-2">状態</th>
                    <th className="text-left p-2">試行回数</th>
                    <th className="text-left p-2">作成日時</th>
                    <th className="text-left p-2">最終試行</th>
                  </tr>
                </thead>
                <tbody>
                  {queueItems.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="p-2">
                        <div>
                          <div className="font-medium">{item.entity_type}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.entity_id.substring(0, 20)}...
                          </div>
                        </div>
                      </td>
                      <td className="p-2">
                        <Badge variant="outline">{item.operation_type}</Badge>
                      </td>
                      <td className="p-2">
                        <Badge className={
                          item.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          item.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                          item.status === 'completed' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }>
                          {item.status}
                        </Badge>
                      </td>
                      <td className="p-2">{item.attempt_count}</td>
                      <td className="p-2 text-xs">
                        {new Date(item.created_at).toLocaleString()}
                      </td>
                      <td className="p-2 text-xs">
                        {item.last_attempted ? 
                          new Date(item.last_attempted).toLocaleString() : 
                          '-'
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}