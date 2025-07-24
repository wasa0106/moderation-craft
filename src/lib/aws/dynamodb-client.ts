/**
 * DynamoDB Client Configuration
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { env } from '@/config/env'

const isLocal = process.env.NEXT_PUBLIC_DYNAMODB_ENDPOINT ? true : false

// クライアント設定
const clientConfig: any = {
  region: env.AWS_REGION,
}

// ローカル環境の設定
if (isLocal) {
  clientConfig.endpoint = process.env.NEXT_PUBLIC_DYNAMODB_ENDPOINT
  clientConfig.credentials = {
    accessKeyId: 'dummy',
    secretAccessKey: 'dummy'
  }
} else {
  // 本番/開発環境の認証情報
  clientConfig.credentials = {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY
  }
}

const client = new DynamoDBClient(clientConfig)

export const dynamoDb = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true
  }
})

// 環境に応じたテーブル名を使用
export const TABLE_NAME = env.DYNAMODB_TABLE

// デバッグ情報（開発環境のみ）
if (env.NODE_ENV === 'development') {
  console.log(`DynamoDB Client initialized with table: ${TABLE_NAME}`)
}
