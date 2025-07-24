/**
 * DynamoDB Table Schema and Key Patterns
 */

import { CreateTableCommand } from '@aws-sdk/client-dynamodb'
import { dynamoDb, TABLE_NAME } from './dynamodb-client'

// テーブル作成用のスキーマ定義
export const tableSchema = {
  TableName: TABLE_NAME,
  KeySchema: [
    { AttributeName: 'PK', KeyType: 'HASH' as const },
    { AttributeName: 'SK', KeyType: 'RANGE' as const }
  ],
  AttributeDefinitions: [
    { AttributeName: 'PK', AttributeType: 'S' as const },
    { AttributeName: 'SK', AttributeType: 'S' as const },
    { AttributeName: 'user_time_pk', AttributeType: 'S' as const },
    { AttributeName: 'user_time_sk', AttributeType: 'S' as const },
    { AttributeName: 'entity_type', AttributeType: 'S' as const },
    { AttributeName: 'updated_at', AttributeType: 'S' as const }
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'user-time-index',
      KeySchema: [
        { AttributeName: 'user_time_pk', KeyType: 'HASH' as const },
        { AttributeName: 'user_time_sk', KeyType: 'RANGE' as const }
      ],
      Projection: { ProjectionType: 'ALL' as const },
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    },
    {
      IndexName: 'entity-type-index',
      KeySchema: [
        { AttributeName: 'entity_type', KeyType: 'HASH' as const },
        { AttributeName: 'updated_at', KeyType: 'RANGE' as const }
      ],
      Projection: { ProjectionType: 'ALL' as const },
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    }
  ],
  BillingMode: 'PAY_PER_REQUEST' as const // オンデマンド課金
}

// エンティティごとのキーパターン
export const keyPatterns = {
  // ユーザー
  user: {
    pk: (userId: string) => `USER#${userId}`,
    sk: () => 'PROFILE'
  },
  
  // プロジェクト
  project: {
    pk: (userId: string) => `USER#${userId}`,
    sk: (projectId: string) => `PROJECT#${projectId}`,
    gsi1pk: (projectId: string) => `PROJECT#${projectId}`,
    gsi1sk: () => 'METADATA'
  },
  
  // 大タスク
  bigTask: {
    pk: (projectId: string) => `PROJECT#${projectId}`,
    sk: (taskId: string) => `BIGTASK#${taskId}`,
    gsi1pk: (userId: string, weekNumber: number) => `USER#${userId}#WEEK#${weekNumber}`,
    gsi1sk: (taskId: string) => `BIGTASK#${taskId}`
  },
  
  // 小タスク
  smallTask: {
    pk: (bigTaskId: string) => `BIGTASK#${bigTaskId}`,
    sk: (taskId: string) => `SMALLTASK#${taskId}`,
    gsi1pk: (userId: string, date: string) => `USER#${userId}#DATE#${date}`,
    gsi1sk: (taskId: string) => `SMALLTASK#${taskId}`
  },
  
  // ワークセッション
  workSession: {
    pk: (userId: string, date: string) => `USER#${userId}#DATE#${date}`,
    sk: (sessionId: string) => `SESSION#${sessionId}`,
    gsi1pk: (taskId: string) => `TASK#${taskId}`,
    gsi1sk: (sessionId: string) => `SESSION#${sessionId}`
  },
  
  // 感情記録
  moodEntry: {
    pk: (userId: string, date: string) => `USER#${userId}#DATE#${date}`,
    sk: (timestamp: string) => `MOOD#${timestamp}`,
    gsi1pk: (userId: string, yearMonth: string) => `USER#${userId}#MONTH#${yearMonth}`,
    gsi1sk: (timestamp: string) => `MOOD#${timestamp}`
  },
  
  // 日次コンディション
  dailyCondition: {
    pk: (userId: string) => `USER#${userId}`,
    sk: (date: string) => `CONDITION#${date}`,
    gsi1pk: (userId: string, yearMonth: string) => `USER#${userId}#MONTH#${yearMonth}`,
    gsi1sk: (date: string) => `CONDITION#${date}`
  }
}

// テーブル作成関数（開発環境用）
export async function createTableIfNotExists() {
  try {
    const command = new CreateTableCommand(tableSchema)
    await dynamoDb.send(command)
    console.log('Table created successfully')
  } catch (error: any) {
    if (error.name === 'ResourceInUseException') {
      console.log('Table already exists')
    } else {
      throw error
    }
  }
}