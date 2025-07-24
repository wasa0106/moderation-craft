/**
 * 重複同期防止機能のテストページ
 */
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SyncService } from '@/lib/sync/sync-service'
import { syncQueueRepository } from '@/lib/db/repositories'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function TestDuplicateSyncPage() {
  const [loading, setLoading] = useState(false)
  const [queueItems, setQueueItems] = useState<any[]>([])
  const syncService = SyncService.getInstance()
  
  // 自動同期を無効化（テスト中のみ）と初回ロード
  useEffect(() => {
    let originalAutoSync: boolean
    
    import('@/stores/sync-store').then(({ useSyncStore }) => {
      originalAutoSync = useSyncStore.getState().autoSyncEnabled
      useSyncStore.getState().setAutoSync(false)
      
      // 初回ロード時にキューを読み込む
      loadQueueItems()
    })
    
    // コンポーネントのアンマウント時に元に戻す
    return () => {
      import('@/stores/sync-store').then(({ useSyncStore }) => {
        if (originalAutoSync !== undefined) {
          useSyncStore.getState().setAutoSync(originalAutoSync)
        }
      })
    }
  }, [])

  // テストデータ
  const testProject = {
    id: 'test-project-123',
    user_id: 'current-user',
    name: 'テストプロジェクト（重複防止テスト）',
    goal: '重複同期の防止機能をテスト',
    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  // 同期キューの内容を取得
  const loadQueueItems = async () => {
    const items = await syncQueueRepository.getAll()
    setQueueItems(items)
    console.log('同期キューの内容:', items)
  }

  // テスト1: 同じデータを2回追加
  const testDuplicateAdd = async () => {
    setLoading(true)
    try {
      console.log('=== 重複追加テスト開始 ===')
      
      // まずプロジェクトを実際にIndexedDBに保存
      const { projectRepository } = await import('@/lib/db/repositories')
      await projectRepository.create(testProject)
      console.log('テストプロジェクトをIndexedDBに保存しました')
      
      // 1回目の追加
      console.log('1回目の追加...')
      await syncService.addToSyncQueue('project', testProject.id, 'create', testProject)
      
      // 2回目の追加（重複）
      console.log('2回目の追加（重複）...')
      await syncService.addToSyncQueue('project', testProject.id, 'create', testProject)
      
      await loadQueueItems()
      
      toast.success('重複追加テスト完了（コンソールログを確認）')
    } catch (error) {
      console.error('エラー:', error)
      toast.error('テスト中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  // テスト2: 失敗したアイテムの再追加
  const testFailedItemReset = async () => {
    setLoading(true)
    try {
      console.log('=== 失敗アイテムリセットテスト開始 ===')
      
      // まず失敗状態のアイテムを作成
      const items = await syncQueueRepository.getAll()
      const targetItem = items.find(item => 
        item.entity_type === 'project' && 
        item.entity_id === testProject.id &&
        item.operation_type === 'CREATE'
      )
      
      if (!targetItem) {
        toast.error('テスト対象のアイテムが見つかりません')
        return
      }
      
      // 失敗状態に更新
      await syncQueueRepository.markAsFailed(targetItem.id, 'テスト用の失敗')
      console.log('アイテムを失敗状態に更新しました')
      
      // データを更新して再追加
      const updatedProject = { ...testProject, name: 'プロジェクト名を更新' }
      console.log('更新したデータで再追加...')
      await syncService.addToSyncQueue('project', testProject.id, 'create', updatedProject)
      
      await loadQueueItems()
      
      toast.success('失敗アイテムリセットテスト完了')
    } catch (error) {
      console.error('エラー:', error)
      toast.error('テスト中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  // テスト3: 異なる操作タイプ
  const testDifferentOperations = async () => {
    setLoading(true)
    try {
      console.log('=== 異なる操作タイプテスト開始 ===')
      
      // CREATE
      await syncService.addToSyncQueue('project', testProject.id, 'create', testProject)
      
      // UPDATE（これは追加されるべき）
      await syncService.addToSyncQueue('project', testProject.id, 'update', testProject)
      
      // DELETE（これも追加されるべき）
      await syncService.addToSyncQueue('project', testProject.id, 'delete')
      
      await loadQueueItems()
      
      toast.success('異なる操作タイプテスト完了')
    } catch (error) {
      console.error('エラー:', error)
      toast.error('テスト中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  // 同期キューをクリア
  const clearQueue = async () => {
    setLoading(true)
    try {
      const items = await syncQueueRepository.getAll()
      for (const item of items) {
        await syncQueueRepository.delete(item.id)
      }
      await loadQueueItems()
      toast.success('同期キューをクリアしました')
    } catch (error) {
      console.error('エラー:', error)
      toast.error('クリア中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">重複同期防止テスト</h1>
      
      <div className="space-y-4">
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-4">テスト操作</h2>
          <div className="space-y-2">
            <Button
              onClick={testDuplicateAdd}
              disabled={loading}
              className="w-full"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              テスト1: 同じデータを2回追加
            </Button>
            
            <Button
              onClick={testFailedItemReset}
              disabled={loading}
              variant="secondary"
              className="w-full"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              テスト2: 失敗アイテムのリセット
            </Button>
            
            <Button
              onClick={testDifferentOperations}
              disabled={loading}
              variant="secondary"
              className="w-full"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              テスト3: 異なる操作タイプ
            </Button>
            
            <div className="flex gap-2 mt-4">
              <Button
                onClick={loadQueueItems}
                disabled={loading}
                variant="outline"
                className="flex-1"
              >
                キューを再読み込み
              </Button>
              
              <Button
                onClick={clearQueue}
                disabled={loading}
                variant="destructive"
                className="flex-1"
              >
                キューをクリア
              </Button>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-4">
            同期キューの内容 ({queueItems.length}件)
          </h2>
          {queueItems.length === 0 ? (
            <p className="text-muted-foreground">キューは空です</p>
          ) : (
            <div className="space-y-2">
              {queueItems.map((item) => (
                <div key={item.id} className="p-3 border rounded text-sm">
                  <div className="font-medium">
                    {item.entity_type} - {item.operation_type}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ID: {item.entity_id}
                  </div>
                  <div className="text-xs">
                    Status: <span className={
                      item.status === 'pending' ? 'text-yellow-600' :
                      item.status === 'processing' ? 'text-blue-600' :
                      item.status === 'completed' ? 'text-green-600' :
                      item.status === 'failed' ? 'text-red-600' : ''
                    }>{item.status}</span>
                    {item.attempt_count > 0 && ` (試行: ${item.attempt_count}回)`}
                  </div>
                  {item.error_message && (
                    <div className="text-xs text-red-600 mt-1">
                      エラー: {item.error_message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}