/**
 * 同期APIテストページ
 * WorkSessionデータを手動で同期テストできるページ
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useWorkSessions } from '@/hooks/use-timer'
import { format } from 'date-fns'
import { Loader2 } from 'lucide-react'
import { workSessionRepository } from '@/lib/db/repositories'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'

export default function SyncTestPage() {
  const [syncing, setSyncing] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  // 今日のWorkSessionを取得
  const today = format(new Date(), 'yyyy-MM-dd')
  const { data: sessions = [] } = useWorkSessions('current-user', today)

  const testSyncWorkSession = async (session: any) => {
    try {
      setSyncing(true)
      setError(null)

      console.log('同期テスト開始:', session)

      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entity_type: 'work_session',
          payload: session
        })
      })

      const data = await response.json()
      console.log('同期レスポンス:', data)

      if (!response.ok) {
        throw new Error(data.error || '同期に失敗しました')
      }

      // 同期成功したら、IndexedDBのis_syncedフラグを更新
      if (data.success && data.syncedEntityId) {
        try {
          // 手動テストデータの場合はIDがtest-で始まる
          const isTestData = data.syncedEntityId.startsWith('test-')
          
          if (!isTestData) {
            await workSessionRepository.update(data.syncedEntityId, {
              is_synced: true
            })
            toast.success('IndexedDBの同期フラグを更新しました')
            console.log('IndexedDB更新成功:', data.syncedEntityId)
            
            // React Queryのキャッシュを更新
            queryClient.invalidateQueries({ queryKey: ['workSessions'] })
          } else {
            console.log('テストデータのため、IndexedDB更新をスキップ')
          }
        } catch (updateError) {
          console.error('IndexedDB更新エラー:', updateError)
          // エラーメッセージを詳細に
          if (updateError instanceof Error && updateError.message.includes('not found')) {
            toast.warning('セッションがIndexedDBに存在しないため、同期フラグの更新をスキップしました')
          } else {
            toast.error('IndexedDBの更新に失敗しました')
          }
        }
      }

      setResults(prev => [...prev, {
        id: session.id,
        success: true,
        response: data
      }])

    } catch (error: any) {
      console.error('同期エラー:', error)
      setError(error.message)
      setResults(prev => [...prev, {
        id: session.id,
        success: false,
        error: error.message
      }])
    } finally {
      setSyncing(false)
    }
  }

  const testAllSessions = async () => {
    setResults([])
    for (const session of sessions) {
      await testSyncWorkSession(session)
    }
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">同期APIテスト</h1>

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
                </div>
                <Button
                  onClick={() => testSyncWorkSession(session)}
                  disabled={syncing}
                  size="sm"
                >
                  {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : '同期テスト'}
                </Button>
              </div>
            ))}
          </div>
        )}

        {sessions.length > 0 && (
          <Button
            onClick={testAllSessions}
            disabled={syncing}
            className="w-full mt-4"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            すべて同期テスト
          </Button>
        )}
      </Card>

      {/* エラー表示 */}
      {error && (
        <Card className="p-4 mb-6 border-red-200 bg-red-50">
          <h3 className="text-lg font-semibold text-red-700 mb-2">エラー</h3>
          <p className="text-red-600">{error}</p>
        </Card>
      )}

      {/* 結果表示 */}
      {results.length > 0 && (
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-4">同期結果</h3>
          <div className="space-y-2">
            {results.map((result, index) => (
              <div
                key={index}
                className={`p-3 rounded border ${
                  result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                }`}
              >
                <p className={`font-medium ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                  {result.success ? '✅ 成功' : '❌ 失敗'} - ID: {result.id}
                </p>
                {result.success && result.response && (
                  <div className="mt-2 text-sm">
                    <p className="text-muted-foreground">メッセージ: {result.response.message}</p>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-blue-600">詳細を表示</summary>
                      <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                        {JSON.stringify(result.response.syncedItem, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
                {!result.success && (
                  <p className="text-sm text-red-600 mt-1">{result.error}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 手動テストデータ */}
      <Card className="p-4 mt-6">
        <h3 className="text-lg font-semibold mb-4">手動テストデータ</h3>
        <Button
          onClick={() => {
            const testSession = {
              id: `test-${Date.now()}`,
              user_id: 'current-user',
              start_time: new Date().toISOString(),
              end_time: null,
              duration_minutes: 0,
              focus_level: 3,
              task_description: '同期APIテスト用セッション',
              small_task_id: null,
              is_synced: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
            testSyncWorkSession(testSession)
          }}
          disabled={syncing}
        >
          テストデータで同期
        </Button>
      </Card>
    </div>
  )
}