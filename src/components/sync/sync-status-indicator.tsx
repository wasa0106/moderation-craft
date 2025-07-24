/**
 * 同期状態インジケーター
 * ヘッダーに表示される同期状態の簡易表示
 */
'use client'

import { useState } from 'react'
import { useSyncStore } from '@/stores/sync-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  Loader2, 
  Wifi, 
  WifiOff, 
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SyncDetailsPanel } from './sync-details-panel'

export function SyncStatusIndicator() {
  const { 
    isOnline, 
    isSyncing,
    getPendingItemsCount,
    getFailedItemsCount,
    lastSyncTime 
  } = useSyncStore()
  
  const pendingCount = getPendingItemsCount()
  const failedCount = getFailedItemsCount()
  const totalCount = pendingCount + failedCount

  // アイコンとステータステキストを決定
  const getStatusIcon = () => {
    if (!isOnline) {
      return <WifiOff className="h-4 w-4" />
    }
    if (isSyncing) {
      return <Loader2 className="h-4 w-4 animate-spin" />
    }
    if (failedCount > 0) {
      return <AlertCircle className="h-4 w-4" />
    }
    return <Wifi className="h-4 w-4" />
  }

  const getStatusText = () => {
    if (!isOnline) return 'オフライン'
    if (isSyncing) return '同期中...'
    if (failedCount > 0) return 'エラーあり'
    if (pendingCount > 0) return '同期待ち'
    return '同期済み'
  }

  const getStatusColor = () => {
    if (!isOnline) return 'text-red-600'
    if (isSyncing) return 'text-blue-600'
    if (failedCount > 0) return 'text-orange-600'
    if (pendingCount > 0) return 'text-yellow-600'
    return 'text-green-600'
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "relative flex items-center gap-2 px-3",
            getStatusColor()
          )}
        >
          {getStatusIcon()}
          <span className="text-sm font-medium">{getStatusText()}</span>
          
          {/* 保留中/失敗アイテムのバッジ */}
          {totalCount > 0 && (
            <Badge 
              variant={failedCount > 0 ? "destructive" : "secondary"}
              className="ml-1 h-5 px-1.5 text-xs"
            >
              {totalCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        align="end" 
        className="w-80"
        sideOffset={8}
      >
        <SyncDetailsPanel />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}