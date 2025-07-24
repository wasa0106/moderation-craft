/**
 * 同期詳細パネル
 * ドロップダウンで表示される同期の詳細情報
 */
'use client'

import { useState } from 'react'
import { useSyncStore } from '@/stores/sync-store'
import { SyncService } from '@/lib/sync/sync-service'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader2,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function SyncDetailsPanel() {
  const [isManualSyncing, setIsManualSyncing] = useState(false)
  const {
    isOnline,
    isSyncing,
    lastSyncTime,
    autoSyncEnabled,
    syncErrors,
    getQueueByStatus,
    setAutoSync,
    clearSyncErrors
  } = useSyncStore()

  const pendingItems = getQueueByStatus('pending')
  const failedItems = getQueueByStatus('failed')
  const syncService = SyncService.getInstance()

  // 手動同期を実行
  const handleManualSync = async () => {
    setIsManualSyncing(true)
    try {
      await syncService.forcSync()
      toast.success('手動同期を実行しました')
    } catch (error) {
      toast.error('同期に失敗しました')
    } finally {
      setIsManualSyncing(false)
    }
  }

  // 失敗したアイテムをリトライ
  const handleRetryFailed = async () => {
    try {
      await syncService.retryFailedItems()
      toast.success('失敗したアイテムを再試行します')
    } catch (error) {
      toast.error('再試行に失敗しました')
    }
  }

  // 最終同期時刻をフォーマット
  const formatLastSyncTime = () => {
    if (!lastSyncTime) return '未実行'
    
    const date = new Date(lastSyncTime)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'たった今'
    if (diffMins < 60) return `${diffMins}分前`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}時間前`
    return date.toLocaleString()
  }

  return (
    <div className="p-4 space-y-4">
      {/* 接続状態 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isOnline ? (
            <>
              <Wifi className="h-4 w-4 text-green-600" />
              <span className="font-medium">オンライン</span>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-red-600" />
              <span className="font-medium">オフライン</span>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">自動同期</span>
          <Button
            variant={autoSyncEnabled ? "default" : "outline"}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setAutoSync(!autoSyncEnabled)}
          >
            {autoSyncEnabled ? 'ON' : 'OFF'}
          </Button>
        </div>
      </div>

      <Separator />

      {/* 同期状態 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">状態</span>
          <div className="flex items-center gap-2">
            {isSyncing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span className="text-sm">同期中...</span>
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">待機中</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">最終同期</span>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span className="text-sm">{formatLastSyncTime()}</span>
          </div>
        </div>
      </div>

      {/* 同期キューの状態 */}
      {(pendingItems.length > 0 || failedItems.length > 0) && (
        <>
          <Separator />
          <div className="space-y-2">
            {pendingItems.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm">保留中</span>
                <Badge variant="secondary">{pendingItems.length}件</Badge>
              </div>
            )}
            
            {failedItems.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm">失敗</span>
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">{failedItems.length}件</Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    onClick={handleRetryFailed}
                  >
                    再試行
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* エラーメッセージ */}
      {syncErrors.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-red-600">エラー</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-5 w-5 p-0"
                onClick={clearSyncErrors}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-1">
              {syncErrors.slice(-3).map((error, index) => (
                <div key={index} className="flex items-start gap-2">
                  <AlertCircle className="h-3 w-3 text-red-600 mt-0.5" />
                  <p className="text-xs text-red-600 break-all">{error}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <Separator />

      {/* アクションボタン */}
      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          onClick={handleManualSync}
          disabled={!isOnline || isSyncing || isManualSyncing}
        >
          {isManualSyncing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              同期中...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              今すぐ同期
            </>
          )}
        </Button>
      </div>
    </div>
  )
}