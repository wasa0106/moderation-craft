/**
 * Fitbit OAuth認証を開始するAPIルート
 * ユーザーをFitbitの認証ページにリダイレクトします
 */

import { NextResponse } from 'next/server';

export async function GET() {
  console.log('[API] Starting Fitbit authorization flow');

  try {
    // 環境変数から設定を取得
    const clientId = process.env.FITBIT_CLIENT_ID || '23QQC2';
    const redirectUri = process.env.FITBIT_REDIRECT_URI || 
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/fitbit/callback`;
    const scope = process.env.FITBIT_SCOPE || 
      'activity heartrate sleep profile settings location';

    // CSRF対策用のstateを生成（32文字のランダム文字列）
    const state = Array.from(
      { length: 32 },
      () => Math.random().toString(36)[2]
    ).join('');

    // 認証URLのパラメータを構築
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scope,
      state: state,
    });

    // Fitbitの認証URLを構築
    const authUrl = `https://www.fitbit.com/oauth2/authorize?${params.toString()}`;

    console.log('[API] Redirecting to Fitbit auth URL');
    console.log('[API] State:', state);

    // stateをクッキーに保存（HTTPOnly、Secure）
    const response = NextResponse.redirect(authUrl);
    response.cookies.set('fitbit_auth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10分間有効
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('[API] Authorization error:', error);
    
    // エラー時はエラーページにリダイレクト
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/settings/integrations?error=auth_failed`
    );
  }
}