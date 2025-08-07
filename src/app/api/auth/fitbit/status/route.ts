/**
 * Fitbit認証状態APIルート
 * 現在の認証状態とユーザー情報を返します
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('[API] Checking Fitbit auth status');

  try {
    // 一時トークンクッキーをチェック（コールバック後の処理）
    const tempToken = request.cookies.get('fitbit_token_temp')?.value;
    
    if (tempToken) {
      console.log('[API] Found temporary token, returning it');
      
      // 一時トークンを返して削除
      const response = NextResponse.json({
        isAuthenticated: true,
        tokenData: JSON.parse(tempToken),
        isTemporary: true,
      });
      
      // クッキーを削除
      response.cookies.delete('fitbit_token_temp');
      
      return response;
    }

    // 通常の認証状態チェック（将来的にはデータベースから取得）
    // 現在はクライアントサイドのLocalStorageを使用しているため、
    // サーバーサイドでは確認できない
    
    return NextResponse.json({
      isAuthenticated: false,
      message: 'Check client-side authentication state',
    });
  } catch (error) {
    console.error('[API] Status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check authentication status' },
      { status: 500 }
    );
  }
}