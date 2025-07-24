/**
 * DynamoDBからデータを取得するAPI（プル同期）
 */

import { NextRequest, NextResponse } from 'next/server'
import { dynamoDb, TABLE_NAME } from '@/lib/aws/dynamodb-client'
import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { validateApiKey, createAuthErrorResponse } from '@/lib/api/auth-middleware'

export async function GET(request: NextRequest) {
  // API認証の検証
  const authResult = validateApiKey(request)
  if (!authResult.isValid) {
    return createAuthErrorResponse(authResult.error!)
  }

  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId') || 'current-user'
    const lastSyncTime = url.searchParams.get('lastSyncTime')
    
    console.log('プル同期リクエスト:', { userId, lastSyncTime })

    // ユーザーの全データを取得
    const result = await dynamoDb.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`
      }
    }))

    // エンティティタイプごとにグループ化
    const data = {
      projects: [] as any[],
      bigTasks: [] as any[],
      smallTasks: [] as any[],
      moodEntries: [] as any[],
      dopamineEntries: [] as any[],
      workSessions: [] as any[]
    }

    // アイテムを分類
    result.Items?.forEach(item => {
      // DynamoDBのメタデータを削除
      const cleanItem = { ...item }
      delete cleanItem.PK
      delete cleanItem.SK
      delete cleanItem.user_time_pk
      delete cleanItem.user_time_sk
      
      switch (item.entity_type) {
        case 'project':
          data.projects.push(cleanItem)
          break
        case 'big_task':
          data.bigTasks.push(cleanItem)
          break
        case 'small_task':
          data.smallTasks.push(cleanItem)
          break
        case 'mood_entry':
          data.moodEntries.push(cleanItem)
          break
        case 'dopamine_entry':
          data.dopamineEntries.push(cleanItem)
          break
        case 'work_session':
          data.workSessions.push(cleanItem)
          break
      }
    })

    console.log('プル同期レスポンス:', {
      projects: data.projects.length,
      bigTasks: data.bigTasks.length,
      smallTasks: data.smallTasks.length,
      total: result.Items?.length || 0
    })

    return NextResponse.json({
      success: true,
      data,
      syncTime: new Date().toISOString(),
      itemCount: result.Items?.length || 0
    })

  } catch (error: any) {
    console.error('プル同期エラー:', error)
    return NextResponse.json({
      success: false,
      error: error?.message || 'Unknown error'
    }, { status: 500 })
  }
}