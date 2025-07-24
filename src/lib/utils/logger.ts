/**
 * ロガーユーティリティ
 * 環境に応じてログ出力を制御
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LoggerConfig {
  enabledInProduction: boolean
  level: LogLevel
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

class Logger {
  private config: LoggerConfig
  private isDevelopment: boolean
  private prefix: string

  constructor(prefix: string, config?: Partial<LoggerConfig>) {
    this.prefix = prefix
    this.isDevelopment = process.env.NODE_ENV === 'development'
    this.config = {
      enabledInProduction: false,
      level: 'info',
      ...config,
    }
  }

  private shouldLog(level: LogLevel): boolean {
    // 開発環境では常にログを出力
    if (this.isDevelopment) return true
    
    // 本番環境ではconfig.enabledInProductionがtrueの場合のみ
    if (!this.config.enabledInProduction) return false
    
    // ログレベルをチェック
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level]
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString()
    return `[${timestamp}] [${level.toUpperCase()}] [${this.prefix}] ${message}`
  }

  debug(message: string, ...args: any[]) {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message), ...args)
    }
  }

  info(message: string, ...args: any[]) {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message), ...args)
    }
  }

  warn(message: string, ...args: any[]) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message), ...args)
    }
  }

  error(message: string, ...args: any[]) {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message), ...args)
    }
  }

  // グループログ（開発環境のみ）
  group(label: string) {
    if (this.isDevelopment) {
      console.group(`[${this.prefix}] ${label}`)
    }
  }

  groupEnd() {
    if (this.isDevelopment) {
      console.groupEnd()
    }
  }

  // テーブル表示（開発環境のみ）
  table(data: any) {
    if (this.isDevelopment) {
      console.table(data)
    }
  }
}

// ファクトリー関数
export function createLogger(prefix: string, config?: Partial<LoggerConfig>): Logger {
  return new Logger(prefix, config)
}

// デフォルトのロガー設定
export const syncLogger = createLogger('Sync', {
  enabledInProduction: true, // 本番環境でもエラーログは出力
  level: 'error', // 本番環境ではエラーのみ
})

export const offlineLogger = createLogger('Offline', {
  enabledInProduction: false, // 本番環境では無効
  level: 'info',
})

export const debugLogger = createLogger('Debug', {
  enabledInProduction: false,
  level: 'debug',
})