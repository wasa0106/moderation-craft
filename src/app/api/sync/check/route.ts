/**
 * DynamoDB同期確認API
 */

import { NextRequest, NextResponse } from 'next/server'
import { dynamoDb, TABLE_NAME } from '@/lib/aws/dynamodb-client'
import { ScanCommand } from '@aws-sdk/lib-dynamodb'
import { validateApiKey, createAuthErrorResponse } from '@/lib/api/auth-middleware'

export async function GET(request: NextRequest) {
  // API認証の検証
  const authResult = validateApiKey(request)
  if (!authResult.isValid) {
    return createAuthErrorResponse(authResult.error!)
  }

  try {
    console.log('DynamoDB確認: テーブル名 =', TABLE_NAME)
    console.log('AWS設定:', {
      region: process.env.NEXT_PUBLIC_AWS_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ? '設定済み' : '未設定',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ? '設定済み' : '未設定',
    })

    // テーブル内のアイテム数を取得
    const scanResult = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        Select: 'COUNT',
      })
    )

    // USER#current-userのアイテムを取得
    const userItemsResult = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'begins_with(PK, :pk)',
        ExpressionAttributeValues: {
          ':pk': 'USER#current-user',
        },
        Limit: 10,
      })
    )

    console.log('DynamoDB Scan結果:', {
      totalCount: scanResult.Count,
      userItemsCount: userItemsResult.Count,
      scannedCount: scanResult.ScannedCount,
    })

    // 最初の数件のアイテムを表示（デバッグ用）
    console.log('最初の3件のアイテム:', userItemsResult.Items?.slice(0, 3))

    return NextResponse.json({
      success: true,
      tableName: TABLE_NAME,
      count: scanResult.Count || 0,
      scannedCount: scanResult.ScannedCount || 0,
      userItems: userItemsResult.Items || [],
      userItemsCount: userItemsResult.Count || 0,
      message: `テーブル ${TABLE_NAME} に ${scanResult.Count || 0} 件のアイテムがあります`,
    })
  } catch (error: any) {
    console.error('DynamoDB確認エラー:', error)
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Unknown error',
        tableName: TABLE_NAME,
      },
      { status: 500 }
    )
  }
}
