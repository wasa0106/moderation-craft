/**
 * Fitbitトークン取り消しAPIルート
 * Fitbit連携を解除し、トークンを無効化します
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('[API] Revoking Fitbit token');

  try {
    // リクエストボディからトークンを取得（オプション）
    let token: string | undefined;
    
    try {
      const body = await request.json();
      token = body.token;
    } catch {
      // ボディがない場合は無視
    }

    // トークンが提供されている場合は、Fitbit APIに取り消しリクエストを送信
    if (token) {
      const clientId = process.env.FITBIT_CLIENT_ID || '23QQC2';
      const clientSecret = process.env.FITBIT_CLIENT_SECRET || '2d5a030ee0a6d4e5e4f6288c0342490f';
      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

      try {
        const revokeResponse = await fetch('https://api.fitbit.com/oauth2/revoke', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            token: token,
          }).toString(),
        });

        if (revokeResponse.ok) {
          console.log('[API] Token revoked successfully on Fitbit');
        } else {
          console.warn('[API] Failed to revoke token on Fitbit:', revokeResponse.status);
          // エラーでも処理を続行（ローカルのトークンは削除）
        }
      } catch (error) {
        console.error('[API] Error revoking token on Fitbit:', error);
        // エラーでも処理を続行
      }
    }

    // クッキーをクリア（存在する場合）
    const response = NextResponse.json({
      success: true,
      message: 'Fitbit connection revoked',
    });

    // 関連するクッキーを削除
    response.cookies.delete('fitbit_auth_state');
    response.cookies.delete('fitbit_token_temp');

    return response;
  } catch (error) {
    console.error('[API] Revoke error:', error);
    return NextResponse.json(
      { error: 'Failed to revoke token' },
      { status: 500 }
    );
  }
}