/**
 * 同期デバッグページ
 * 同期キューの内容を確認・操作できるページ
 */

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { syncQueueRepository } from '@/lib/db/repositories'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'

export default function SyncDebugPage() {
  const [queueItems, setQueueItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const loadQueueItems = async () => {
    try {
      const items = await syncQueueRepository.getAll()
      setQueueItems(items)
      console.log('同期キューアイテム:', items)
    } catch (error) {
      console.error('キュー読み込みエラー:', error)
      toast.error('キューの読み込みに失敗しました')
    }
  }

  useEffect(() => {
    loadQueueItems()
  }, [])

  const deleteItem = async (id: string) => {
    try {
      await syncQueueRepository.delete(id)
      toast.success('アイテムを削除しました')
      loadQueueItems()
    } catch (error) {
      console.error('削除エラー:', error)
      toast.error('削除に失敗しました')
    }
  }

  const clearAllItems = async () => {
    if (!confirm('すべてのキューアイテムを削除しますか？')) return

    try {
      setLoading(true)
      for (const item of queueItems) {
        await syncQueueRepository.delete(item.id)
      }
      toast.success('すべてのアイテムを削除しました')
      loadQueueItems()
    } catch (error) {
      console.error('一括削除エラー:', error)
      toast.error('一括削除に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">同期キューデバッグ</h1>

      <Card className="p-4 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">キューアイテム（{queueItems.length}件）</h2>
          <div className="flex gap-2">
            <Button onClick={loadQueueItems} variant="outline" size="sm">
              更新
            </Button>
            <Button
              onClick={clearAllItems}
              variant="destructive"
              size="sm"
              disabled={loading || queueItems.length === 0}
            >
              すべて削除
            </Button>
          </div>
        </div>

        {queueItems.length === 0 ? (
          <p className="text-muted-foreground">キューは空です</p>
        ) : (
          <div className="space-y-2">
            {queueItems.map(item => (
              <div key={item.id} className="p-3 border rounded">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {item.entity_type} - {item.operation_type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ID: {item.entity_id} | Status: {item.status}
                    </p>
                    <p className="text-xs text-muted-foreground">試行回数: {item.attempt_count}</p>
                    {item.error_message && (
                      <p className="text-xs text-red-600 mt-1">エラー: {item.error_message}</p>
                    )}
                    <details className="mt-2">
                      <summary className="text-xs text-blue-600 cursor-pointer">
                        データを表示
                      </summary>
                      <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto">
                        {item.data ? JSON.stringify(JSON.parse(item.data), null, 2) : 'データなし'}
                      </pre>
                    </details>
                  </div>
                  <Button onClick={() => deleteItem(item.id)} variant="ghost" size="sm">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
