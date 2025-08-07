/**
 * Fitbit OAuthコールバックAPIルート
 * Fitbitからの認証コードを受け取り、アクセストークンと交換します
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('[API] Fitbit callback received');

  try {
    // URLパラメータからcodeとstateを取得
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // エラーがある場合（ユーザーが認証を拒否した等）
    if (error) {
      console.error('[API] Fitbit returned error:', error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/settings/integrations?error=${error}`
      );
    }

    // 必須パラメータのチェック
    if (!code || !state) {
      console.error('[API] Missing code or state');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/settings/integrations?error=missing_params`
      );
    }

    // stateの検証（CSRF対策）
    const savedState = request.cookies.get('fitbit_auth_state')?.value;
    if (!savedState || savedState !== state) {
      console.error('[API] State mismatch');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/settings/integrations?error=state_mismatch`
      );
    }

    console.log('[API] State verified successfully');

    // 認証コードをアクセストークンと交換
    const clientId = process.env.FITBIT_CLIENT_ID || '23QQC2';
    const clientSecret = process.env.FITBIT_CLIENT_SECRET || '2d5a030ee0a6d4e5e4f6288c0342490f';
    const redirectUri = process.env.FITBIT_REDIRECT_URI || 
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/fitbit/callback`;

    // Basic認証用のBase64エンコード
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    // トークン交換リクエスト
    const tokenResponse = await fetch('https://api.fitbit.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('[API] Token exchange failed:', errorData);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/settings/integrations?error=token_exchange_failed`
      );
    }

    const tokenData = await tokenResponse.json();
    console.log('[API] Token exchange successful');
    console.log('[API] User ID:', tokenData.user_id);

    // トークンをクッキーに保存（サーバーサイドで管理）
    const response = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/settings/integrations?success=fitbit`
    );

    // アクセストークンを保存
    response.cookies.set('fitbit_access_token', tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokenData.expires_in || 28800, // デフォルト8時間
      path: '/',
    });

    // リフレッシュトークンを保存
    response.cookies.set('fitbit_refresh_token', tokenData.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30日間
      path: '/',
    });

    // ユーザー情報を保存（クライアント表示用）
    response.cookies.set('fitbit_user_info', JSON.stringify({
      user_id: tokenData.user_id,
      scope: tokenData.scope,
    }), {
      httpOnly: false, // クライアントで読み取り可能
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30日間
      path: '/',
    });

    // stateクッキーを削除
    response.cookies.delete('fitbit_auth_state');

    return response;
  } catch (error) {
    console.error('[API] Callback error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/settings/integrations?error=callback_error`
    );
  }
}