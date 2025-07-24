/**
 * ユーザーフレンドリーなリトライ戦略
 * - ユーザーの操作を邪魔しない
 * - バックグラウンドで自動的に解決
 * - 認証エラーも自動リトライ（一時的な問題の可能性）
 */

import { syncLogger } from '@/lib/utils/logger'

export class UserFriendlyRetryManager {
  private retryDelays = [
    5000,    // 5秒後
    30000,   // 30秒後
    60000,   // 1分後
    300000,  // 5分後
    900000,  // 15分後
    3600000, // 1時間後
  ]
  
  /**
   * エラーが起きてもユーザーには見せない
   * バックグラウンドで解決を試みる
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string,
    attemptNumber = 0
  ): Promise<T | null> {
    try {
      syncLogger.debug(`${context}: 実行中...`)
      const result = await operation()
      
      // 成功したら通知（開発環境のみ）
      if (attemptNumber > 0 && process.env.NODE_ENV === 'development') {
        syncLogger.info(`${context}: ${attemptNumber + 1}回目で成功しました`)
      }
      
      return result
    } catch (error) {
      syncLogger.debug(`${context}: エラーが発生しました (試行 ${attemptNumber + 1})`, error)
      
      // まだリトライ回数が残っている場合
      if (attemptNumber < this.retryDelays.length) {
        const delay = this.retryDelays[attemptNumber]
        
        syncLogger.debug(`${context}: ${this.formatDelay(delay)}後に再試行します`)
        
        // バックグラウンドでリトライをスケジュール
        setTimeout(() => {
          this.executeWithRetry(operation, context, attemptNumber + 1)
        }, delay)
        
        // エラーを握りつぶして、ユーザーには成功したかのように見せる
        return null
      } else {
        // 全てのリトライが失敗した場合のみログに記録
        syncLogger.warn(`${context}: 全てのリトライが失敗しました。次回のバックグラウンド同期で再試行されます。`)
        return null
      }
    }
  }
  
  /**
   * 遅延時間を人間が読みやすい形式に
   */
  private formatDelay(ms: number): string {
    if (ms < 60000) {
      return `${ms / 1000}秒`
    } else if (ms < 3600000) {
      return `${ms / 60000}分`
    } else {
      return `${ms / 3600000}時間`
    }
  }
}

/**
 * さらにシンプルなアプローチ：永続的リトライ
 * - エラーは全て一時的なものと仮定
 * - 成功するまで定期的にリトライし続ける
 */
export class PersistentRetryQueue {
  private queue: Map<string, {
    operation: () => Promise<any>
    lastAttempt: number
    attemptCount: number
  }> = new Map()
  
  private interval: NodeJS.Timeout | null = null
  
  /**
   * 操作をキューに追加
   */
  addOperation(id: string, operation: () => Promise<any>) {
    this.queue.set(id, {
      operation,
      lastAttempt: 0,
      attemptCount: 0
    })
    
    // キューの処理を開始
    this.startProcessing()
  }
  
  /**
   * 定期的にキューを処理
   */
  private startProcessing() {
    if (this.interval) return
    
    // 30秒ごとに失敗した操作を再試行
    this.interval = setInterval(() => {
      this.processQueue()
    }, 30000)
    
    // 即座に1回実行
    this.processQueue()
  }
  
  private async processQueue() {
    const now = Date.now()
    
    for (const [id, item] of this.queue.entries()) {
      // 前回の試行から十分時間が経過している場合のみ再試行
      const timeSinceLastAttempt = now - item.lastAttempt
      const requiredDelay = Math.min(30000 * Math.pow(2, item.attemptCount), 3600000) // 最大1時間
      
      if (timeSinceLastAttempt < requiredDelay) {
        continue
      }
      
      try {
        await item.operation()
        // 成功したらキューから削除
        this.queue.delete(id)
        syncLogger.debug(`操作 ${id} が成功しました`)
      } catch (error) {
        // 失敗してもユーザーには何も見せない
        item.lastAttempt = now
        item.attemptCount++
        syncLogger.debug(`操作 ${id} が失敗しました。後で再試行します。`)
      }
    }
    
    // キューが空になったら処理を停止
    if (this.queue.size === 0 && this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }
  
  /**
   * キューのサイズを取得（UI表示用）
   */
  getQueueSize(): number {
    return this.queue.size
  }
  
  /**
   * 特定の操作を手動でリトライ（ユーザーが「今すぐ同期」ボタンを押した場合など）
   */
  async retryNow(id: string): Promise<boolean> {
    const item = this.queue.get(id)
    if (!item) return false
    
    try {
      await item.operation()
      this.queue.delete(id)
      return true
    } catch (error) {
      item.lastAttempt = Date.now()
      item.attemptCount++
      return false
    }
  }
}

/**
 * 最もシンプルな実装：FireAndForget
 * - エラーが起きても気にしない
 * - バックグラウンド同期に任せる
 */
export async function fireAndForget(
  operation: () => Promise<any>,
  context: string
) {
  try {
    await operation()
  } catch (error) {
    // エラーは記録するが、ユーザーには見せない
    syncLogger.debug(`${context}: バックグラウンドで後ほど再試行されます`)
    // 30秒後の定期同期で自動的に再試行される
  }
}