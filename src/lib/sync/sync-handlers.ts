/**
 * 同期ハンドラー - エンティティタイプごとの同期処理
 */

import { dynamoDb, TABLE_NAME } from '@/lib/aws/dynamodb-client'
import { PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { keyPatterns } from '@/lib/aws/dynamodb-schema'

export interface SyncRequest {
  entity_type: string
  operation: 'CREATE' | 'UPDATE' | 'DELETE'
  payload: any
}

export interface SyncResult {
  success: boolean
  message?: string
  error?: string
  syncedItem?: any
  syncedEntityId?: string
  syncedEntityType?: string
}

/**
 * プロジェクトの同期処理
 */
export async function syncProject(request: SyncRequest): Promise<SyncResult> {
  const project = request.payload
  console.log('syncProject呼び出し:', request.operation, project.id)
  console.log('DynamoDBテーブル名:', TABLE_NAME)
  
  switch (request.operation) {
    case 'CREATE':
    case 'UPDATE':
      // CREATE と UPDATE は同じ処理（PutCommand で上書き）
      const item = {
        PK: `USER#${project.user_id}`,
        SK: `PROJECT#${project.id}`,
        
        // GSI2用のキー（ユーザーデータ検索用）
        GSI2PK: project.status === 'active' ? `ACTIVE#${project.user_id}` : `USER#${project.user_id}`,
        GSI2SK: `PROJECT#${project.id}`,
        
        // GSI用のキー（管理用）
        entity_type: 'project',
        created_at: project.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(), // 更新時は常に現在時刻
        
        ...project
      }

      console.log('DynamoDB PutCommand実行:', {
        TableName: TABLE_NAME,
        PK: item.PK,
        SK: item.SK
      })
      
      await dynamoDb.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: item
      }))
      
      console.log('DynamoDB PutCommand成功')

      return {
        success: true,
        message: `Projectを${request.operation === 'CREATE' ? '作成' : '更新'}しました`,
        syncedItem: item,
        syncedEntityId: project.id,
        syncedEntityType: 'project'
      }

    case 'DELETE':
      // DynamoDBから削除
      await dynamoDb.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${project.user_id}`,
          SK: `PROJECT#${project.id}`
        }
      }))

      return {
        success: true,
        message: 'Projectを削除しました',
        syncedEntityId: project.id,
        syncedEntityType: 'project'
      }

    default:
      throw new Error(`Unsupported operation: ${request.operation}`)
  }
}

/**
 * タスクの同期処理
 */
export async function syncTask(request: SyncRequest, taskType: 'big_task' | 'small_task'): Promise<SyncResult> {
  const task = request.payload
  const prefix = taskType === 'big_task' ? 'BIGTASK' : 'SMALLTASK'
  
  switch (request.operation) {
    case 'CREATE':
    case 'UPDATE':
      const item = {
        PK: `USER#${task.user_id}`,
        SK: `${prefix}#${task.id}`,
        
        // GSI用のキー
        user_time_pk: task.project_id ? `PROJECT#${task.project_id}` : undefined,
        user_time_sk: `${prefix}#${task.id}`,
        
        entity_type: taskType,
        created_at: task.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        
        ...task
      }

      await dynamoDb.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: item
      }))

      return {
        success: true,
        message: `${taskType}を${request.operation === 'CREATE' ? '作成' : '更新'}しました`,
        syncedItem: item,
        syncedEntityId: task.id,
        syncedEntityType: taskType
      }

    case 'DELETE':
      await dynamoDb.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${task.user_id}`,
          SK: `${prefix}#${task.id}`
        }
      }))

      return {
        success: true,
        message: `${taskType}を削除しました`,
        syncedEntityId: task.id,
        syncedEntityType: taskType
      }

    default:
      throw new Error(`Unsupported operation: ${request.operation}`)
  }
}

/**
 * WorkSessionの同期処理
 */
export async function syncWorkSession(request: SyncRequest): Promise<SyncResult> {
  const workSession = request.payload
  
  switch (request.operation) {
    case 'CREATE':
    case 'UPDATE':
      const item = {
        PK: keyPatterns.workSession.pk(workSession.user_id, workSession.start_time.split('T')[0]),
        SK: keyPatterns.workSession.sk(workSession.id),
        
        user_time_pk: workSession.small_task_id ? keyPatterns.workSession.gsi1pk(workSession.small_task_id) : undefined,
        user_time_sk: keyPatterns.workSession.gsi1sk(workSession.id),
        
        entity_type: 'work_session',
        created_at: workSession.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        
        ...workSession
      }

      await dynamoDb.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: item
      }))

      return {
        success: true,
        message: `WorkSessionを${request.operation === 'CREATE' ? '作成' : '更新'}しました`,
        syncedItem: item,
        syncedEntityId: workSession.id,
        syncedEntityType: 'work_session'
      }

    case 'DELETE':
      await dynamoDb.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: keyPatterns.workSession.pk(workSession.user_id, workSession.start_time.split('T')[0]),
          SK: keyPatterns.workSession.sk(workSession.id)
        }
      }))

      return {
        success: true,
        message: 'WorkSessionを削除しました',
        syncedEntityId: workSession.id,
        syncedEntityType: 'work_session'
      }

    default:
      throw new Error(`Unsupported operation: ${request.operation}`)
  }
}

/**
 * MoodEntry/DopamineEntryの同期処理
 */
export async function syncEntry(request: SyncRequest, entryType: 'mood_entry' | 'dopamine_entry'): Promise<SyncResult> {
  const entry = request.payload
  const prefix = entryType === 'mood_entry' ? 'MOOD' : 'DOPAMINE'
  const gsiPrefix = entryType === 'mood_entry' ? 'MOOD' : 'DOPAMINE'
  
  switch (request.operation) {
    case 'CREATE':
    case 'UPDATE':
      const item = {
        PK: `USER#${entry.user_id}`,
        SK: `${prefix}#${entry.id}`,
        
        user_time_pk: `${gsiPrefix}#${entry.user_id}`,
        user_time_sk: `DATE#${entry.timestamp}`,
        
        entity_type: entryType,
        created_at: entry.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        
        ...entry
      }

      await dynamoDb.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: item
      }))

      return {
        success: true,
        message: `${entryType}を${request.operation === 'CREATE' ? '作成' : '更新'}しました`,
        syncedItem: item,
        syncedEntityId: entry.id,
        syncedEntityType: entryType
      }

    case 'DELETE':
      await dynamoDb.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${entry.user_id}`,
          SK: `${prefix}#${entry.id}`
        }
      }))

      return {
        success: true,
        message: `${entryType}を削除しました`,
        syncedEntityId: entry.id,
        syncedEntityType: entryType
      }

    default:
      throw new Error(`Unsupported operation: ${request.operation}`)
  }
}