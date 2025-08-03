/**
 * API認証ミドルウェア
 */

import { NextRequest, NextResponse } from 'next/server'

export interface AuthResult {
  isValid: boolean
  error?: string
}

/**
 * APIキー認証を検証
 */
export function validateApiKey(request: NextRequest): AuthResult {
  const apiKey = request.headers.get('x-api-key')
  const expectedApiKey = process.env.SYNC_API_KEY

  // APIキーが設定されていない場合（開発環境など）
  if (!expectedApiKey) {
    console.warn('Warning: SYNC_API_KEY is not set. API is unprotected!')
    return { isValid: true }
  }

  // APIキーがリクエストに含まれていない
  if (!apiKey) {
    return {
      isValid: false,
      error: 'API key is required. Please provide x-api-key header.',
    }
  }

  // APIキーが一致しない
  if (apiKey !== expectedApiKey) {
    return {
      isValid: false,
      error: 'Invalid API key',
    }
  }

  return { isValid: true }
}

/**
 * 認証エラーレスポンスを作成
 */
export function createAuthErrorResponse(error: string) {
  return NextResponse.json(
    {
      success: false,
      error,
      timestamp: new Date().toISOString(),
    },
    { status: 401 }
  )
}
