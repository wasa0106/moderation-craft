/**
 * DynamoDB接続テスト用エンドポイント
 */

import { NextResponse } from 'next/server'
import { dynamoDb, TABLE_NAME } from '@/lib/aws/dynamodb-client'
import { QueryCommand } from '@aws-sdk/lib-dynamodb'

export async function GET() {
  try {
    // 環境変数のチェック
    const envCheck = {
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? 'Set' : 'Missing',
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ? 'Set' : 'Missing',
      TABLE_NAME: TABLE_NAME,
      AWS_REGION: process.env.NEXT_PUBLIC_AWS_REGION,
    }

    // DynamoDBへのテスト接続
    let connectionStatus = 'Unknown'
    let connectionError = null
    
    try {
      const result = await dynamoDb.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: 'PK = :pk',
          ExpressionAttributeValues: {
            ':pk': 'USER#test-connection',
          },
          Limit: 1,
        })
      )
      connectionStatus = 'Success'
    } catch (error) {
      connectionStatus = 'Failed'
      connectionError = error instanceof Error ? error.message : String(error)
    }

    return NextResponse.json({
      success: connectionStatus === 'Success',
      environment: envCheck,
      connectionStatus,
      connectionError,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}