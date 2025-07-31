/**
 * 同期キューの動作確認ページ
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { syncQueueRepository } from '@/lib/db/repositories'
import { toast } from 'sonner'

export default function QueueTestPage() {
  const [result, setResult] = useState<any>(null)

  const testCreateQueueItem = async () => {
    try {
      // テスト用のデータ
      const testData = {
        id: 'test-123',
        user_id: 'test-user',
        start_time: new Date().toISOString(),
        duration_minutes: 10,
        is_synced: false
      }

      const queueItem = {
        user_id: 'current-user',
        entity_type: 'work_session',
        entity_id: testData.id,
        operation_type: 'CREATE' as const,
        data: JSON.stringify(testData),
        status: 'pending' as const,
        attempt_count: 0,
        version: 1
      }

      console.log('Creating queue item:', queueItem)
      
      const created = await syncQueueRepository.create(queueItem)
      console.log('Created item:', created)
      
      setResult(created)
      toast.success('キューアイテムを作成しました')
    } catch (error) {
      console.error('エラー:', error)
      toast.error('作成に失敗しました')
    }
  }

  const testReadQueueItems = async () => {
    try {
      const items = await syncQueueRepository.getAll()
      console.log('All queue items:', items)
      setResult(items)
      toast.success(`${items.length}件のアイテムを取得しました`)
    } catch (error) {
      console.error('エラー:', error)
      toast.error('取得に失敗しました')
    }
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">同期キューテスト</h1>

      <Card className="p-4 mb-6">
        <h2 className="text-lg font-semibold mb-4">基本テスト</h2>
        <div className="flex gap-2">
          <Button onClick={testCreateQueueItem}>
            テストアイテムを作成
          </Button>
          <Button onClick={testReadQueueItems} variant="outline">
            全アイテムを取得
          </Button>
        </div>
      </Card>

      {result && (
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-2">結果</h3>
          <pre className="p-3 bg-muted rounded overflow-auto text-xs">
            {JSON.stringify(result, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  )
}