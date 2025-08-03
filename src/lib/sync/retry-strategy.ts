/**
 * リトライ戦略の実装
 */

export interface RetryConfig {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  jitterEnabled: boolean
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterEnabled: true,
}

/**
 * エラータイプの判定
 */
export function categorizeError(
  error: any
): 'NETWORK' | 'AUTH' | 'RATE_LIMIT' | 'SERVER' | 'CLIENT' | 'UNKNOWN' {
  if (!error) return 'UNKNOWN'

  // ネットワークエラー
  if (error.name === 'NetworkError' || error.message?.includes('fetch')) {
    return 'NETWORK'
  }

  // HTTPステータスコードでの判定
  const status = error.status || error.response?.status
  if (status) {
    if (status === 401 || status === 403) return 'AUTH'
    if (status === 429) return 'RATE_LIMIT'
    if (status >= 500) return 'SERVER'
    if (status >= 400) return 'CLIENT'
  }

  // DynamoDBエラー
  if (error.__type?.includes('AccessDeniedException')) return 'AUTH'
  if (error.__type?.includes('ProvisionedThroughputExceededException')) return 'RATE_LIMIT'

  return 'UNKNOWN'
}

/**
 * リトライ可能かどうかを判定
 */
export function isRetryable(
  errorType: string,
  attemptNumber: number,
  config: RetryConfig
): boolean {
  if (attemptNumber >= config.maxAttempts) {
    return false
  }

  switch (errorType) {
    case 'NETWORK':
    case 'RATE_LIMIT':
    case 'SERVER':
      return true
    case 'AUTH':
    case 'CLIENT':
      return false
    case 'UNKNOWN':
      // 不明なエラーは最初の数回だけリトライ
      return attemptNumber < 2
    default:
      return false
  }
}

/**
 * 次のリトライまでの待機時間を計算
 */
export function calculateRetryDelay(
  errorType: string,
  attemptNumber: number,
  config: RetryConfig,
  rateLimitResetTime?: number
): number {
  // レート制限の場合は、リセット時間まで待つ
  if (errorType === 'RATE_LIMIT' && rateLimitResetTime) {
    const waitTime = rateLimitResetTime - Date.now()
    return Math.max(waitTime, config.baseDelayMs)
  }

  // 指数バックオフ
  let delay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attemptNumber - 1)

  // 最大遅延時間を超えないようにする
  delay = Math.min(delay, config.maxDelayMs)

  // ジッターを追加（競合を避けるため）
  if (config.jitterEnabled) {
    const jitter = Math.random() * delay * 0.3 // 最大30%のジッター
    delay = delay + jitter
  }

  return Math.round(delay)
}

/**
 * サーキットブレーカーの状態管理
 */
export class CircuitBreaker {
  private failureCount = 0
  private lastFailureTime = 0
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'

  constructor(
    private failureThreshold = 5,
    private resetTimeMs = 60000, // 1分
    private halfOpenRequests = 3
  ) {}

  recordSuccess() {
    this.failureCount = 0
    this.state = 'CLOSED'
  }

  recordFailure() {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN'
    }
  }

  canAttempt(): boolean {
    if (this.state === 'CLOSED') {
      return true
    }

    if (this.state === 'OPEN') {
      // リセット時間が経過したか確認
      if (Date.now() - this.lastFailureTime > this.resetTimeMs) {
        this.state = 'HALF_OPEN'
        return true
      }
      return false
    }

    // HALF_OPEN状態では限定的にリクエストを許可
    return this.failureCount < this.halfOpenRequests
  }

  getState() {
    return this.state
  }
}

/**
 * リトライ統計情報
 */
export interface RetryStats {
  totalAttempts: number
  successfulAttempts: number
  failedAttempts: number
  averageRetryCount: number
  errorTypeDistribution: Record<string, number>
}

export class RetryStatsCollector {
  private stats: RetryStats = {
    totalAttempts: 0,
    successfulAttempts: 0,
    failedAttempts: 0,
    averageRetryCount: 0,
    errorTypeDistribution: {},
  }

  private retryCountSum = 0
  private operationCount = 0

  recordAttempt(errorType: string | null, retryCount: number, success: boolean) {
    this.stats.totalAttempts++

    if (success) {
      this.stats.successfulAttempts++
    } else {
      this.stats.failedAttempts++
      if (errorType) {
        this.stats.errorTypeDistribution[errorType] =
          (this.stats.errorTypeDistribution[errorType] || 0) + 1
      }
    }

    this.retryCountSum += retryCount
    this.operationCount++
    this.stats.averageRetryCount = this.retryCountSum / this.operationCount
  }

  getStats(): RetryStats {
    return { ...this.stats }
  }

  reset() {
    this.stats = {
      totalAttempts: 0,
      successfulAttempts: 0,
      failedAttempts: 0,
      averageRetryCount: 0,
      errorTypeDistribution: {},
    }
    this.retryCountSum = 0
    this.operationCount = 0
  }
}
