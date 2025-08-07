/**
 * Fitbit OAuth認証処理
 * 認証フローの管理とトークン管理を行います
 */

import { secureStore, secureRetrieve, secureRemove } from './crypto';
import type { FitbitToken, FitbitTokenResponse, FitbitAuthState } from './types';

const TOKEN_KEY = 'fitbit_token';
const STATE_KEY = 'fitbit_auth_state';

/**
 * Fitbit認証管理クラス
 */
export class FitbitAuth {
  private clientId: string;
  private redirectUri: string;
  private scope: string;

  constructor() {
    // 環境変数から設定を読み込み
    this.clientId = process.env.NEXT_PUBLIC_FITBIT_CLIENT_ID || '23QQC2';
    this.redirectUri = process.env.NEXT_PUBLIC_FITBIT_REDIRECT_URI || 
      `${typeof window !== 'undefined' ? window.location.origin : ''}/api/auth/fitbit/callback`;
    this.scope = process.env.NEXT_PUBLIC_FITBIT_SCOPE || 
      'activity heartrate sleep profile settings location';
  }

  /**
   * 認証URLを生成
   * @returns 認証URL
   */
  generateAuthUrl(): string {
    // ランダムなstateを生成（CSRF対策）
    const state = this.generateRandomString(32);
    
    // stateをセッションストレージに保存
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('fitbit_auth_state', state);
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scope,
      state: state,
    });

    return `https://www.fitbit.com/oauth2/authorize?${params.toString()}`;
  }

  /**
   * stateの検証
   * @param state 受け取ったstate
   * @returns 検証結果
   */
  verifyState(state: string): boolean {
    if (typeof window === 'undefined') return false;
    
    const savedState = sessionStorage.getItem('fitbit_auth_state');
    sessionStorage.removeItem('fitbit_auth_state');
    
    return savedState === state;
  }

  /**
   * トークンを保存
   * @param tokenResponse Fitbit APIからのトークンレスポンス
   */
  async saveToken(tokenResponse: FitbitTokenResponse): Promise<void> {
    const token: FitbitToken = {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt: Date.now() + (tokenResponse.expires_in * 1000),
      userId: tokenResponse.user_id,
      scope: tokenResponse.scope,
    };

    // 暗号化して保存
    await secureStore(TOKEN_KEY, JSON.stringify(token));
    
    // 認証状態を更新
    const authState: FitbitAuthState = {
      isAuthenticated: true,
      userId: token.userId,
      lastSync: new Date(),
    };
    
    localStorage.setItem(STATE_KEY, JSON.stringify(authState));
  }

  /**
   * トークンを取得
   * @returns 保存されているトークン
   */
  async getToken(): Promise<FitbitToken | null> {
    try {
      const encryptedToken = await secureRetrieve(TOKEN_KEY);
      if (!encryptedToken) return null;
      
      const token: FitbitToken = JSON.parse(encryptedToken);
      
      // トークンの有効期限をチェック
      if (this.isTokenExpired(token)) {
        console.log('Token is expired, needs refresh');
        return token; // リフレッシュが必要
      }
      
      return token;
    } catch (error) {
      console.error('Failed to get token:', error);
      return null;
    }
  }

  /**
   * トークンが期限切れかチェック
   * @param token トークン
   * @returns 期限切れの場合true
   */
  isTokenExpired(token: FitbitToken): boolean {
    // 5分の余裕を持って判定
    return Date.now() >= (token.expiresAt - 5 * 60 * 1000);
  }

  /**
   * アクセストークンを取得（必要に応じてリフレッシュ）
   * @returns 有効なアクセストークン
   */
  async getValidAccessToken(): Promise<string | null> {
    const token = await this.getToken();
    if (!token) return null;

    // トークンが期限切れの場合はリフレッシュ
    if (this.isTokenExpired(token)) {
      const refreshed = await this.refreshToken(token.refreshToken);
      if (refreshed) {
        await this.saveToken(refreshed);
        return refreshed.access_token;
      }
      return null;
    }

    return token.accessToken;
  }

  /**
   * トークンをリフレッシュ
   * @param refreshToken リフレッシュトークン
   * @returns 新しいトークン
   */
  async refreshToken(refreshToken: string): Promise<FitbitTokenResponse | null> {
    try {
      const response = await fetch('/api/auth/fitbit/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to refresh token:', error);
      return null;
    }
  }

  /**
   * 認証状態を取得
   * @returns 認証状態
   */
  getAuthState(): FitbitAuthState {
    if (typeof window === 'undefined') {
      return { isAuthenticated: false };
    }

    const stateJson = localStorage.getItem(STATE_KEY);
    if (!stateJson) {
      return { isAuthenticated: false };
    }

    try {
      return JSON.parse(stateJson);
    } catch {
      return { isAuthenticated: false };
    }
  }

  /**
   * ログアウト（連携解除）
   */
  async logout(): Promise<void> {
    // トークンを削除
    secureRemove(TOKEN_KEY);
    localStorage.removeItem(STATE_KEY);
    
    // サーバーサイドでも連携解除
    try {
      await fetch('/api/auth/fitbit/revoke', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Failed to revoke token:', error);
    }
  }

  /**
   * ランダム文字列生成
   * @param length 文字列長
   * @returns ランダム文字列
   */
  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    if (typeof window !== 'undefined' && window.crypto) {
      const randomValues = new Uint8Array(length);
      window.crypto.getRandomValues(randomValues);
      
      for (let i = 0; i < length; i++) {
        result += chars[randomValues[i] % chars.length];
      }
    } else {
      // サーバーサイドまたは古いブラウザの場合
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }
    
    return result;
  }
}

// シングルトンインスタンスをエクスポート
export const fitbitAuth = new FitbitAuth();