/**
 * FitbitトークンリフレッシュAPIルート
 * 期限切れのアクセストークンを新しいトークンに更新します
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('[API] Refreshing Fitbit token');

  try {
    // リクエストボディからリフレッシュトークンを取得
    const body = await request.json();
    const { refreshToken } = body;

    if (!refreshToken) {
      console.error('[API] No refresh token provided');
      return NextResponse.json(
        { error: 'Refresh token is required' },
        { status: 400 }
      );
    }

    // Fitbit API設定
    const clientId = process.env.FITBIT_CLIENT_ID || '23QQC2';
    const clientSecret = process.env.FITBIT_CLIENT_SECRET || '2d5a030ee0a6d4e5e4f6288c0342490f';

    // Basic認証用のBase64エンコード
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    // Fitbit APIにリフレッシュリクエストを送信
    const response = await fetch('https://api.fitbit.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[API] Token refresh failed:', errorData);
      
      // 401の場合はリフレッシュトークンが無効
      if (response.status === 401) {
        return NextResponse.json(
          { error: 'Invalid refresh token. Please re-authenticate.' },
          { status: 401 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to refresh token' },
        { status: response.status }
      );
    }

    const tokenData = await response.json();
    console.log('[API] Token refreshed successfully');
    console.log('[API] New token expires in:', tokenData.expires_in, 'seconds');

    // 新しいトークンデータを返す
    return NextResponse.json(tokenData);
  } catch (error) {
    console.error('[API] Refresh error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}