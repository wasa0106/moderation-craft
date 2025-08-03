/**
 * OfflineDetector - Detects online/offline status
 * Provides utilities for network status monitoring
 */

import { useSyncStore } from '@/stores/sync-store'
import { offlineLogger } from '@/lib/utils/logger'

export class OfflineDetector {
  private static instance: OfflineDetector
  private listeners: Array<(online: boolean) => void> = []
  private isOnline: boolean = true
  private checkInterval: NodeJS.Timeout | null = null
  private testMode: boolean = false // テストモード用フラグ

  private constructor() {
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
    this.setupEventListeners()
    this.startPeriodicCheck()

    // 初期状態をストアに反映
    if (typeof window !== 'undefined') {
      useSyncStore.getState().setOnlineStatus(this.isOnline)
    }
  }

  static getInstance(): OfflineDetector {
    if (!OfflineDetector.instance) {
      OfflineDetector.instance = new OfflineDetector()
    }
    return OfflineDetector.instance
  }

  private setupEventListeners() {
    if (typeof window === 'undefined') return

    const handleOnline = () => {
      offlineLogger.info('ブラウザがオンラインになりました')
      this.setOnlineStatus(true)
    }

    const handleOffline = () => {
      offlineLogger.info('ブラウザがオフラインになりました')
      this.setOnlineStatus(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // ページ表示/非表示イベントも監視
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isOnline) {
        offlineLogger.debug('ページが表示されました - 同期をチェックします')
        this.handleOnlineRecovery()
      }
    })

    // Additional check with navigator.connection if available
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      if (connection) {
        connection.addEventListener('change', () => {
          const effectiveType = connection.effectiveType
          const isSlowConnection = effectiveType === 'slow-2g' || effectiveType === '2g'

          if (isSlowConnection && this.isOnline) {
            offlineLogger.info('低速接続を検出 - オフライン扱いにします')
            this.setOnlineStatus(false)
          } else if (!isSlowConnection && !this.isOnline) {
            offlineLogger.info('通常接続に復帰しました')
            this.setOnlineStatus(true)
          }
        })
      }
    }
  }

  private startPeriodicCheck() {
    // 定期的にネットワーク接続をチェック（10秒ごと）
    this.checkInterval = setInterval(() => {
      // テストモードの場合はスキップ
      if (this.testMode) {
        return
      }

      this.checkConnectivity().then(isOnline => {
        if (isOnline !== this.isOnline) {
          this.setOnlineStatus(isOnline)
        }
      })
    }, 10000)
  }

  private setOnlineStatus(online: boolean) {
    offlineLogger.debug(`setOnlineStatus called: ${online}`)
    if (this.isOnline !== online) {
      this.isOnline = online

      // ストアを更新
      useSyncStore.getState().setOnlineStatus(online)
      offlineLogger.debug(`Online status updated in store: ${online}`)

      // リスナーに通知
      this.notifyListeners(online)

      if (online) {
        offlineLogger.info('Online detected, triggering recovery...')
        // オンラインに復帰したら同期を実行
        this.handleOnlineRecovery()
      }
    }
  }

  private notifyListeners(online: boolean) {
    this.listeners.forEach(listener => listener(online))
  }

  private async handleOnlineRecovery() {
    offlineLogger.info('ネットワークが復旧しました - 同期を開始します')

    // 動的インポートでSyncServiceを取得（循環参照を避けるため）
    const { SyncService } = await import('./sync-service')
    const syncService = SyncService.getInstance()

    // 少し遅延させてから同期を実行（ネットワークの安定を待つ）
    setTimeout(() => {
      syncService.processSyncQueue().catch(error => {
        offlineLogger.error('オンライン復帰時の同期に失敗しました:', error)
      })
    }, 1000)
  }

  public getStatus(): boolean {
    return this.isOnline
  }

  // テストモード用のメソッド
  public setTestMode(enabled: boolean) {
    this.testMode = enabled
    if (enabled) {
      offlineLogger.debug('OfflineDetector: Test mode enabled - periodic checks disabled')
      // テストモード時は定期チェックを停止
      if (this.checkInterval) {
        clearInterval(this.checkInterval)
        this.checkInterval = null
      }
    } else {
      offlineLogger.debug('OfflineDetector: Test mode disabled - periodic checks resumed')
      // テストモード解除時は定期チェックを再開
      this.startPeriodicCheck()
    }
  }

  public addListener(listener: (online: boolean) => void): () => void {
    this.listeners.push(listener)

    // Return cleanup function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  public async checkConnectivity(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.onLine) {
      return false
    }

    try {
      // Try to fetch a small resource to verify connectivity
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      })
      return response.ok
    } catch (error) {
      return false
    }
  }

  destroy() {
    // クリーンアップ
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }

    this.listeners = []
  }
}

// Hook for React components
export function useOfflineDetector() {
  const setSyncOnlineStatus = useSyncStore(state => state.setOnlineStatus)

  React.useEffect(() => {
    const detector = OfflineDetector.getInstance()

    // Set initial status
    setSyncOnlineStatus(detector.getStatus())

    // Listen for changes
    const cleanup = detector.addListener(online => {
      setSyncOnlineStatus(online)
    })

    return cleanup
  }, [setSyncOnlineStatus])

  return {
    isOnline: OfflineDetector.getInstance().getStatus(),
    checkConnectivity: () => OfflineDetector.getInstance().checkConnectivity(),
  }
}

import React from 'react'
