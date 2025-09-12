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
  console.log('プロジェクトステータス:', project.status)
  console.log('プロジェクトupdated_at:', project.updated_at)

  switch (request.operation) {
    case 'CREATE':
    case 'UPDATE':
      // CREATE と UPDATE は同じ処理（PutCommand で上書き）
      const item = {
        PK: `USER#${project.user_id}`,
        SK: `PROJECT#${project.id}`,

        // GSI2用のキー（ユーザーデータ検索用）
        GSI2PK:
          project.status === 'active' ? `ACTIVE#${project.user_id}` : `USER#${project.user_id}`,
        GSI2SK: `PROJECT#${project.id}`,

        // GSI用のキー（管理用）
        entity_type: 'project',
        created_at: project.created_at || new Date().toISOString(),
        updated_at: project.updated_at || new Date().toISOString(), // ローカルのupdated_atを優先、なければ現在時刻

        ...project,
      }

      console.log('DynamoDB PutCommand実行:', {
        TableName: TABLE_NAME,
        PK: item.PK,
        SK: item.SK,
        status: item.status,
        updated_at: item.updated_at,
      })

      await dynamoDb.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: item,
        })
      )

      console.log('DynamoDB PutCommand成功:', {
        id: project.id,
        status: item.status,
        updated_at: item.updated_at,
      })

      return {
        success: true,
        message: `Projectを${request.operation === 'CREATE' ? '作成' : '更新'}しました (status: ${item.status})`,
        syncedItem: item,
        syncedEntityId: project.id,
        syncedEntityType: 'project',
      }

    case 'DELETE':
      // DynamoDBから削除
      await dynamoDb.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: {
            PK: `USER#${project.user_id}`,
            SK: `PROJECT#${project.id}`,
          },
        })
      )

      return {
        success: true,
        message: 'Projectを削除しました',
        syncedEntityId: project.id,
        syncedEntityType: 'project',
      }

    default:
      throw new Error(`Unsupported operation: ${request.operation}`)
  }
}

/**
 * タスクの同期処理
 */
export async function syncTask(
  request: SyncRequest,
  taskType: 'big_task' | 'small_task'
): Promise<SyncResult> {
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

        ...task,
      }

      await dynamoDb.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: item,
        })
      )

      return {
        success: true,
        message: `${taskType}を${request.operation === 'CREATE' ? '作成' : '更新'}しました`,
        syncedItem: item,
        syncedEntityId: task.id,
        syncedEntityType: taskType,
      }

    case 'DELETE':
      await dynamoDb.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: {
            PK: `USER#${task.user_id}`,
            SK: `${prefix}#${task.id}`,
          },
        })
      )

      return {
        success: true,
        message: `${taskType}を削除しました`,
        syncedEntityId: task.id,
        syncedEntityType: taskType,
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
        // PKパターンを他のエンティティと統一（USER#user_id形式）
        PK: `USER#${workSession.user_id}`,
        // SKに日付情報を含めて一意性を保証
        SK: `WORKSESSION#${workSession.start_time.split('T')[0]}#${workSession.id}`,

        user_time_pk: workSession.small_task_id
          ? keyPatterns.workSession.gsi1pk(workSession.small_task_id)
          : undefined,
        user_time_sk: keyPatterns.workSession.gsi1sk(workSession.id),

        entity_type: 'work_session',
        created_at: workSession.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),

        ...workSession,
      }

      await dynamoDb.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: item,
        })
      )

      return {
        success: true,
        message: `WorkSessionを${request.operation === 'CREATE' ? '作成' : '更新'}しました`,
        syncedItem: item,
        syncedEntityId: workSession.id,
        syncedEntityType: 'work_session',
      }

    case 'DELETE':
      await dynamoDb.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: {
            // PKパターンを統一形式に合わせる
            PK: `USER#${workSession.user_id}`,
            SK: `WORKSESSION#${workSession.start_time.split('T')[0]}#${workSession.id}`,
          },
        })
      )

      return {
        success: true,
        message: 'WorkSessionを削除しました',
        syncedEntityId: workSession.id,
        syncedEntityType: 'work_session',
      }

    default:
      throw new Error(`Unsupported operation: ${request.operation}`)
  }
}

/**
 * MoodEntry/DopamineEntryの同期処理
 */
export async function syncEntry(
  request: SyncRequest,
  entryType: 'mood_entry' | 'dopamine_entry' | 'time_entries'
): Promise<SyncResult> {
  const entry = request.payload
  const prefix = entryType === 'mood_entry' ? 'MOOD' : entryType === 'dopamine_entry' ? 'DOPAMINE' : 'TIME_ENTRY'
  const gsiPrefix = entryType === 'mood_entry' ? 'MOOD' : entryType === 'dopamine_entry' ? 'DOPAMINE' : 'TIME_ENTRY'

  switch (request.operation) {
    case 'CREATE':
    case 'UPDATE':
      const item = {
        PK: `USER#${entry.user_id}`,
        SK: `${prefix}#${entry.id}`,

        user_time_pk: `${gsiPrefix}#${entry.user_id}`,
        user_time_sk: entryType === 'time_entries' ? `DATE#${entry.date}` : `DATE#${entry.timestamp}`,

        entity_type: entryType,
        created_at: entry.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),

        ...entry,
      }

      await dynamoDb.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: item,
        })
      )

      return {
        success: true,
        message: `${entryType}を${request.operation === 'CREATE' ? '作成' : '更新'}しました`,
        syncedItem: item,
        syncedEntityId: entry.id,
        syncedEntityType: entryType,
      }

    case 'DELETE':
      await dynamoDb.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: {
            PK: `USER#${entry.user_id}`,
            SK: `${prefix}#${entry.id}`,
          },
        })
      )

      return {
        success: true,
        message: `${entryType}を削除しました`,
        syncedEntityId: entry.id,
        syncedEntityType: entryType,
      }

    default:
      throw new Error(`Unsupported operation: ${request.operation}`)
  }
}

/**
 * ScheduleMemoの同期処理
 */
export async function syncScheduleMemo(request: SyncRequest): Promise<SyncResult> {
  const memo = request.payload
  console.log('syncScheduleMemo呼び出し:', request.operation, memo.id)

  switch (request.operation) {
    case 'CREATE':
    case 'UPDATE':
      const item = {
        PK: `USER#${memo.user_id}`,
        SK: `SCHEDULEMEMO#${memo.week_start_date}`,

        // GSI2用のキー（週単位での検索用）
        GSI2PK: `SCHEDULEMEMO#${memo.user_id}`,
        GSI2SK: `WEEK#${memo.week_start_date}`,

        entity_type: 'schedule_memo',
        created_at: memo.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),

        ...memo,
      }

      await dynamoDb.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: item,
        })
      )

      return {
        success: true,
        message: `ScheduleMemoを${request.operation === 'CREATE' ? '作成' : '更新'}しました`,
        syncedItem: item,
        syncedEntityId: memo.id,
        syncedEntityType: 'schedule_memo',
      }

    case 'DELETE':
      await dynamoDb.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: {
            PK: `USER#${memo.user_id}`,
            SK: `SCHEDULEMEMO#${memo.week_start_date}`,
          },
        })
      )

      return {
        success: true,
        message: 'ScheduleMemoを削除しました',
        syncedEntityId: memo.id,
        syncedEntityType: 'schedule_memo',
      }

    default:
      throw new Error(`Unsupported operation: ${request.operation}`)
  }
}

/**
 * 睡眠スケジュールの同期処理
 */
export async function syncSleepSchedule(request: SyncRequest): Promise<SyncResult> {
  const sleepSchedule = request.payload
  console.log('syncSleepSchedule呼び出し:', request.operation, sleepSchedule.id)

  switch (request.operation) {
    case 'CREATE':
    case 'UPDATE':
      const item = {
        PK: `USER#${sleepSchedule.user_id}`,
        SK: `SLEEP#${sleepSchedule.date_of_sleep}#${sleepSchedule.id}`,

        // GSI2用のキー（ユーザーデータ検索用）
        GSI2PK: `USER#${sleepSchedule.user_id}`,
        GSI2SK: `SLEEP#${sleepSchedule.date_of_sleep}`,

        // 管理用フィールド
        entity_type: 'sleep_schedule',
        created_at: sleepSchedule.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),

        ...sleepSchedule,
      }

      await dynamoDb.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: item,
        })
      )

      return {
        success: true,
        message: `睡眠スケジュールを${request.operation === 'CREATE' ? '作成' : '更新'}しました`,
        syncedItem: item,
        syncedEntityId: sleepSchedule.id,
        syncedEntityType: 'sleep_schedule',
      }

    case 'DELETE':
      await dynamoDb.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: {
            PK: `USER#${sleepSchedule.user_id}`,
            SK: `SLEEP#${sleepSchedule.date_of_sleep}#${sleepSchedule.id}`,
          },
        })
      )

      return {
        success: true,
        message: '睡眠スケジュールを削除しました',
        syncedEntityId: sleepSchedule.id,
        syncedEntityType: 'sleep_schedule',
      }

    default:
      throw new Error(`Unsupported operation: ${request.operation}`)
  }
}
