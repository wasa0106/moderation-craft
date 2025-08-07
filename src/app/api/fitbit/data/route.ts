/**
 * Fitbit APIプロキシルート
 * クライアントからのリクエストを受けて、サーバーサイドでFitbit APIを呼び出します
 * CORS問題を回避し、トークン管理をサーバーサイドで行います
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Fitbit APIのベースURL
const FITBIT_API_BASE = 'https://api.fitbit.com';

// 許可されたFitbit APIエンドポイントのホワイトリスト
const ALLOWED_ENDPOINTS = [
  // プロフィール
  '/1/user/-/profile.json',
  // 睡眠データ
  /^\/1\.2\/user\/-\/sleep\/date\/[\d-]+\.json$/,
  /^\/1\.2\/user\/-\/sleep\/date\/[\d-]+\/[\d-]+\.json$/,
  // 活動データ
  /^\/1\/user\/-\/activities\/date\/[\d-]+\.json$/,
  // 心拍数データ
  /^\/1\/user\/-\/activities\/heart\/date\/[\d-]+\/1d\/(1sec|1min|5min|15min)\.json$/,
  // 歩数データ
  /^\/1\/user\/-\/activities\/steps\/date\/[\d-]+\/1d\.json$/,
  // カロリーデータ
  /^\/1\/user\/-\/activities\/calories\/date\/[\d-]+\/1d\.json$/,
];

/**
 * エンドポイントが許可されているかチェック
 */
function isEndpointAllowed(endpoint: string): boolean {
  return ALLOWED_ENDPOINTS.some(pattern => {
    if (typeof pattern === 'string') {
      return pattern === endpoint;
    }
    return pattern.test(endpoint);
  });
}

/**
 * トークンを取得（クッキーまたはヘッダーから）
 */
async function getAccessToken(request: NextRequest): Promise<string | null> {
  // まずAuthorizationヘッダーをチェック
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // 次にクッキーからトークンを取得試行
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get('fitbit_access_token');
  if (tokenCookie) {
    return tokenCookie.value;
  }

  // 一時トークンクッキーをチェック（コールバック後）
  const tempToken = cookieStore.get('fitbit_token_temp');
  if (tempToken) {
    try {
      const tokenData = JSON.parse(tempToken.value);
      return tokenData.access_token;
    } catch {
      // JSONパースエラーは無視
    }
  }

  return null;
}

/**
 * GETリクエストハンドラ
 * Fitbit APIへのプロキシリクエストを処理
 */
export async function GET(request: NextRequest) {
  console.log('[API Proxy] Fitbit data request received');

  try {
    // URLパラメータからエンドポイントを取得
    const searchParams = request.nextUrl.searchParams;
    const endpoint = searchParams.get('endpoint');

    if (!endpoint) {
      console.error('[API Proxy] No endpoint specified');
      return NextResponse.json(
        { error: 'Endpoint is required' },
        { status: 400 }
      );
    }

    // エンドポイントの検証
    if (!isEndpointAllowed(endpoint)) {
      console.error('[API Proxy] Endpoint not allowed:', endpoint);
      return NextResponse.json(
        { error: 'Endpoint not allowed' },
        { status: 403 }
      );
    }

    // アクセストークンを取得
    const accessToken = await getAccessToken(request);
    if (!accessToken) {
      console.error('[API Proxy] No access token available');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Fitbit API URLを構築
    const fitbitUrl = `${FITBIT_API_BASE}${endpoint}`;
    console.log('[API Proxy] Proxying to:', fitbitUrl);

    // Fitbit APIへリクエスト
    const fitbitResponse = await fetch(fitbitUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    // レート制限情報をログ
    const rateLimitRemaining = fitbitResponse.headers.get('Fitbit-Rate-Limit-Remaining');
    const rateLimitReset = fitbitResponse.headers.get('Fitbit-Rate-Limit-Reset');
    
    if (rateLimitRemaining) {
      console.log(`[API Proxy] Rate limit remaining: ${rateLimitRemaining}`);
    }
    if (rateLimitReset) {
      const resetTime = new Date(parseInt(rateLimitReset) * 1000).toISOString();
      console.log(`[API Proxy] Rate limit resets at: ${resetTime}`);
    }

    // エラーハンドリング
    if (!fitbitResponse.ok) {
      const errorData = await fitbitResponse.json();
      console.error('[API Proxy] Fitbit API error:', errorData);
      
      // 401の場合はトークンが無効
      if (fitbitResponse.status === 401) {
        return NextResponse.json(
          { error: 'Token expired or invalid', details: errorData },
          { status: 401 }
        );
      }
      
      // 429の場合はレート制限
      if (fitbitResponse.status === 429) {
        return NextResponse.json(
          { error: 'Rate limit exceeded', details: errorData },
          { status: 429 }
        );
      }
      
      return NextResponse.json(
        { error: 'Fitbit API error', details: errorData },
        { status: fitbitResponse.status }
      );
    }

    // 成功レスポンスを返す
    const data = await fitbitResponse.json();
    console.log('[API Proxy] Request successful');
    
    // レート制限情報をヘッダーに含める
    const response = NextResponse.json(data);
    if (rateLimitRemaining) {
      response.headers.set('X-RateLimit-Remaining', rateLimitRemaining);
    }
    if (rateLimitReset) {
      response.headers.set('X-RateLimit-Reset', rateLimitReset);
    }
    
    return response;
  } catch (error) {
    console.error('[API Proxy] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POSTリクエストハンドラ
 * トークンの保存や更新に使用
 */
export async function POST(request: NextRequest) {
  console.log('[API Proxy] Token management request received');

  try {
    const body = await request.json();
    const { action, token } = body;

    if (action === 'save') {
      // トークンをクッキーに保存
      const response = NextResponse.json({ success: true });
      
      // HTTPOnlyクッキーとして保存
      response.cookies.set('fitbit_access_token', token.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: token.expires_in || 28800, // デフォルト8時間
        path: '/',
      });
      
      // リフレッシュトークンも保存
      if (token.refresh_token) {
        response.cookies.set('fitbit_refresh_token', token.refresh_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30, // 30日
          path: '/',
        });
      }
      
      return response;
    }

    if (action === 'refresh') {
      // トークンをリフレッシュ
      const cookieStore = await cookies();
      const refreshToken = cookieStore.get('fitbit_refresh_token')?.value;
      
      if (!refreshToken) {
        return NextResponse.json(
          { error: 'No refresh token available' },
          { status: 401 }
        );
      }
      
      // Fitbit OAuth設定
      const clientId = process.env.FITBIT_CLIENT_ID || '23QQC2';
      const clientSecret = process.env.FITBIT_CLIENT_SECRET || '2d5a030ee0a6d4e5e4f6288c0342490f';
      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      
      // リフレッシュリクエスト
      const tokenResponse = await fetch('https://api.fitbit.com/oauth2/token', {
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
      
      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        console.error('[API Proxy] Token refresh failed:', errorData);
        return NextResponse.json(
          { error: 'Token refresh failed', details: errorData },
          { status: tokenResponse.status }
        );
      }
      
      const newToken = await tokenResponse.json();
      console.log('[API Proxy] Token refreshed successfully');
      
      // 新しいトークンを保存
      const response = NextResponse.json({ success: true, token: newToken });
      
      response.cookies.set('fitbit_access_token', newToken.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: newToken.expires_in || 28800,
        path: '/',
      });
      
      if (newToken.refresh_token) {
        response.cookies.set('fitbit_refresh_token', newToken.refresh_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30,
          path: '/',
        });
      }
      
      return response;
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[API Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}