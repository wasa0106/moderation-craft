/**
 * 環境変数の型定義とバリデーション
 */

// クライアントサイド環境変数の型定義
interface ClientEnvConfig {
  // DynamoDB設定
  DYNAMODB_TABLE: string
  AWS_REGION: string
  
  // 環境設定
  NODE_ENV: 'development' | 'production' | 'test'
  IS_PRODUCTION: boolean
  
  // 同期設定
  SYNC_ENABLED: boolean
  SYNC_INTERVAL_MS: number
}

// サーバーサイド環境変数の型定義
interface ServerEnvConfig extends ClientEnvConfig {
  // AWS設定（サーバーサイドのみ）
  AWS_ACCESS_KEY_ID: string
  AWS_SECRET_ACCESS_KEY: string
}

// クライアントサイドで使用可能な環境変数の読み込み
function loadClientEnvConfig(): ClientEnvConfig {
  const nodeEnv = process.env.NODE_ENV || 'development'
  const isProduction = nodeEnv === 'production'
  
  // テーブル名の決定（環境別）
  const dynamoDbTable = isProduction
    ? process.env.NEXT_PUBLIC_DYNAMODB_TABLE_PROD || 'moderation-craft-data'
    : process.env.NEXT_PUBLIC_DYNAMODB_TABLE_DEV || 'moderation-craft-data-dev'

  return {
    // DynamoDB設定
    DYNAMODB_TABLE: dynamoDbTable,
    AWS_REGION: process.env.NEXT_PUBLIC_AWS_REGION || 'ap-northeast-1',
    
    // 環境設定
    NODE_ENV: nodeEnv as 'development' | 'production' | 'test',
    IS_PRODUCTION: isProduction,
    
    // 同期設定（環境変数で制御可能）
    SYNC_ENABLED: process.env.NEXT_PUBLIC_SYNC_ENABLED !== 'false', // デフォルトは有効
    SYNC_INTERVAL_MS: parseInt(process.env.NEXT_PUBLIC_SYNC_INTERVAL_MS || '30000', 10),
  }
}

// サーバーサイドで使用する環境変数の読み込み
function loadServerEnvConfig(): ServerEnvConfig {
  const clientConfig = loadClientEnvConfig()
  
  // サーバーサイドでのみチェック
  if (typeof window === 'undefined') {
    const requiredEnvVars = [
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
    ] as const

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`)
      }
    }
  }

  return {
    ...clientConfig,
    // AWS設定（サーバーサイドのみ）
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
  }
}

// 実行環境に応じて適切な設定を返す
const isServer = typeof window === 'undefined'

// 環境変数をエクスポート
export const env = isServer ? loadServerEnvConfig() : loadClientEnvConfig()

// クライアント専用のエクスポート（型安全）
export const clientEnv: ClientEnvConfig = loadClientEnvConfig()

// 開発環境でのみログ出力（クライアントサイドのみ）
if (typeof window !== 'undefined' && clientEnv.NODE_ENV === 'development') {
  console.log('Environment Config:', {
    NODE_ENV: clientEnv.NODE_ENV,
    IS_PRODUCTION: clientEnv.IS_PRODUCTION,
    DYNAMODB_TABLE: clientEnv.DYNAMODB_TABLE,
    AWS_REGION: clientEnv.AWS_REGION,
    SYNC_ENABLED: clientEnv.SYNC_ENABLED,
    SYNC_INTERVAL_MS: clientEnv.SYNC_INTERVAL_MS,
  })
}