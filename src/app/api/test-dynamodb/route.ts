/**
 * DynamoDB接続テスト用API
 */

import { NextResponse } from 'next/server'
import { dynamoDb, TABLE_NAME } from '@/lib/aws/dynamodb-client'
import { PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb'

export async function GET() {
  try {
    // テストデータ
    const testItem = {
      PK: 'TEST#CONNECTION',
      SK: 'TEST#' + new Date().toISOString(),
      entity_type: 'test',
      message: 'DynamoDB connection test',
      timestamp: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // 1. データを書き込む
    await dynamoDb.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: testItem
    }))

    // 2. データを読み込む
    const result = await dynamoDb.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: testItem.PK,
        SK: testItem.SK
      }
    }))

    return NextResponse.json({
      success: true,
      message: 'DynamoDB接続成功！',
      writtenItem: testItem,
      readItem: result.Item
    })

  } catch (error: any) {
    console.error('DynamoDB接続エラー:', error)
    return NextResponse.json({
      success: false,
      error: error?.message || 'Unknown error',
      errorDetail: error?.toString(),
      errorName: error?.name,
      errorCode: error?.code
    }, { status: 500 })
  }
}