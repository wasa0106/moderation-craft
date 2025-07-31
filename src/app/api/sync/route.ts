/**
 * 同期API - CREATE/UPDATE/DELETE操作対応
 */

import { NextRequest, NextResponse } from 'next/server'
import { 
  syncProject, 
  syncTask, 
  syncWorkSession,
  syncEntry,
  syncScheduleMemo,
  syncSleepSchedule,
  type SyncRequest 
} from '@/lib/sync/sync-handlers'
import { validateApiKey, createAuthErrorResponse } from '@/lib/api/auth-middleware'
import { TABLE_NAME } from '@/lib/aws/dynamodb-client'

export async function POST(request: NextRequest) {
  // API認証の検証
  const authResult = validateApiKey(request)
  if (!authResult.isValid) {
    return createAuthErrorResponse(authResult.error!)
  }

  try {
    const body = await request.json() as SyncRequest
    console.log('同期リクエスト受信:', body.entity_type, body.operation || 'CREATE')
    console.log('ペイロード:', JSON.stringify(body.payload, null, 2))
    console.log('使用するテーブル:', TABLE_NAME)

    // デフォルト操作をCREATEに設定
    const syncRequest: SyncRequest = {
      entity_type: body.entity_type,
      operation: body.operation || 'CREATE',
      payload: body.payload
    }

    // エンティティタイプとペイロードの検証
    if (!syncRequest.entity_type || !syncRequest.payload) {
      return NextResponse.json(
        { success: false, error: 'entity_type and payload are required' },
        { status: 400 }
      )
    }

    // エンティティタイプごとに処理を振り分け
    let result
    switch (syncRequest.entity_type) {
      case 'project':
        result = await syncProject(syncRequest)
        break
      
      case 'big_task':
        result = await syncTask(syncRequest, 'big_task')
        break
      
      case 'small_task':
        result = await syncTask(syncRequest, 'small_task')
        break
      
      case 'work_session':
        result = await syncWorkSession(syncRequest)
        break
      
      case 'mood_entry':
        result = await syncEntry(syncRequest, 'mood_entry')
        break
      
      case 'dopamine_entry':
        result = await syncEntry(syncRequest, 'dopamine_entry')
        break
      
      case 'schedule_memo':
        result = await syncScheduleMemo(syncRequest)
        break
      
      case 'sleep_schedule':
        result = await syncSleepSchedule(syncRequest)
        break
      
      default:
        return NextResponse.json({
          success: false,
          error: `${syncRequest.entity_type}の同期はまだ実装されていません`
        }, { status: 400 })
    }

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('同期エラー:', error)
    return NextResponse.json({
      success: false,
      error: error?.message || 'Unknown error'
    }, { status: 500 })
  }
}