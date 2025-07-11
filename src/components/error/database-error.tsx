/**
 * DatabaseErrorBoundary - データベースエラーの専用エラーハンドラー
 */

'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
// import { Alert, AlertDescription } from '@/components/ui/alert'
import { RefreshCw, Database, AlertTriangle } from 'lucide-react'
import { db } from '@/lib/db/database'

interface DatabaseErrorProps {
  error: Error
  onRetry?: () => void
}

export function DatabaseError({ error, onRetry }: DatabaseErrorProps) {
  const [isResetting, setIsResetting] = useState(false)
  const [resetComplete, setResetComplete] = useState(false)

  const isSchemaError = error.message.includes('UpgradeError') || 
                       error.message.includes('primary key') ||
                       error.message.includes('DatabaseClosedError')

  const handleReset = async () => {
    setIsResetting(true)
    try {
      await db.handleSchemaError()
      setResetComplete(true)
      
      // 3秒後にページをリロード
      setTimeout(() => {
        window.location.reload()
      }, 3000)
    } catch (resetError) {
      console.error('Failed to reset database:', resetError)
      alert('データベースのリセットに失敗しました。ブラウザの開発者ツールでIndexedDBを手動で削除してください。')
    } finally {
      setIsResetting(false)
    }
  }

  const handleManualReset = () => {
    if (confirm('この操作により、ローカルに保存されているすべてのデータが削除されます。続行しますか？')) {
      // IndexedDBを手動削除
      indexedDB.deleteDatabase('ModerationCraftDB')
      window.location.reload()
    }
  }

  if (resetComplete) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="mb-4">
              <Database className="h-12 w-12 text-green-500 mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-green-700 mb-2">
              復旧完了
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              データベースが正常に復旧されました。
              <br />
              まもなくページがリロードされます。
            </p>
            <div className="flex justify-center">
              <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="max-w-2xl mx-auto mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-600">
          <AlertTriangle className="h-5 w-5" />
          データベースエラー
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-red-800 font-medium">エラー詳細</span>
          </div>
          <p className="text-red-700 text-sm">
            データベースにアクセスできません。以下のエラーが発生しました：
            <br />
            <code className="text-sm bg-red-100 px-1 py-0.5 rounded mt-1 inline-block">
              {error.message}
            </code>
          </p>
        </div>

        {isSchemaError && (
          <div className="space-y-3">
            <h4 className="font-medium">推奨される解決方法</h4>
            <p className="text-sm text-gray-600">
              データベースのスキーマ変更により発生したエラーです。
              自動復旧機能を使用してデータベースを修復できます。
            </p>
            
            <div className="flex gap-2">
              <Button 
                onClick={handleReset}
                disabled={isResetting}
                className="flex items-center gap-2"
              >
                {isResetting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    復旧中...
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4" />
                    自動復旧
                  </>
                )}
              </Button>
              
              {onRetry && (
                <Button variant="outline" onClick={onRetry}>
                  再試行
                </Button>
              )}
            </div>

            <div className="pt-4 border-t">
              <h5 className="font-medium text-sm mb-2">手動での解決方法</h5>
              <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                <li>ブラウザの開発者ツールを開く（F12）</li>
                <li>「Application」タブを選択</li>
                <li>「Storage」→「IndexedDB」→「ModerationCraftDB」</li>
                <li>データベースを右クリックして「Delete」を選択</li>
                <li>ページをリロード</li>
              </ol>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleManualReset}
                className="mt-2"
              >
                手動リセット
              </Button>
            </div>
          </div>
        )}

        {!isSchemaError && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              予期しないデータベースエラーが発生しました。
              再試行するか、問題が続く場合は開発者にお問い合わせください。
            </p>
            
            {onRetry && (
              <Button onClick={onRetry} variant="outline">
                再試行
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}