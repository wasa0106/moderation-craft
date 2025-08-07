'use client';

/**
 * 外部サービス連携設定ページ
 * Fitbitなどの外部サービスとの連携を管理します
 */

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { fitbitAuth } from '@/lib/fitbit/auth';
import type { FitbitAuthState } from '@/lib/fitbit/types';
import { Activity, Heart, Moon, RefreshCw, Unlink, Link2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

// メインコンテンツを別コンポーネントに分離
function IntegrationsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authState, setAuthState] = useState<FitbitAuthState>({ isAuthenticated: false });
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // ページロード時に認証状態をチェック
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // URLパラメータからメッセージを処理
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success === 'fitbit') {
      setMessage({ type: 'success', text: 'Fitbitとの連携が完了しました！' });
      // 認証状態を再チェック
      handleSuccess();
    } else if (error) {
      const errorMessages: Record<string, string> = {
        auth_failed: '認証の開始に失敗しました',
        missing_params: '必要なパラメータが不足しています',
        state_mismatch: 'セキュリティ検証に失敗しました',
        token_exchange_failed: 'トークンの取得に失敗しました',
        callback_error: 'コールバック処理中にエラーが発生しました',
      };
      setMessage({ 
        type: 'error', 
        text: errorMessages[error] || 'エラーが発生しました' 
      });
    }

    // メッセージを5秒後に消す
    if (success || error) {
      setTimeout(() => setMessage(null), 5000);
      // URLをクリーンアップ
      router.replace('/settings/integrations');
    }
  }, [searchParams, router]);

  // 認証状態をチェック
  const checkAuthStatus = async () => {
    console.log('[UI] Checking authentication status');
    setIsLoading(true);
    
    try {
      // クッキーからユーザー情報を取得
      const userInfoCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('fitbit_user_info='));
      
      if (userInfoCookie) {
        const userInfo = JSON.parse(decodeURIComponent(userInfoCookie.split('=')[1]));
        setAuthState({
          isAuthenticated: true,
          userId: userInfo.user_id,
          lastSync: new Date(),
        });
        console.log('[UI] Auth state from cookie:', userInfo);
      } else {
        // クッキーがない場合はLocalStorageの状態を確認（後方互換性）
        const state = fitbitAuth.getAuthState();
        setAuthState(state);
        console.log('[UI] Auth state from localStorage:', state);
      }
    } catch (error) {
      console.error('[UI] Failed to check auth status:', error);
      setAuthState({ isAuthenticated: false });
    } finally {
      setIsLoading(false);
    }
  };

  // 成功時の処理
  const handleSuccess = () => {
    // クッキーが設定されているはずなので、認証状態を再チェック
    checkAuthStatus();
  };

  // Fitbit連携を開始
  const handleConnect = () => {
    console.log('[UI] Starting Fitbit connection');
    setIsLoading(true);
    // APIルートにリダイレクト（サーバーサイドでOAuth URLを生成）
    window.location.href = '/api/auth/fitbit/authorize';
  };

  // Fitbit連携を解除
  const handleDisconnect = async () => {
    if (!confirm('Fitbitとの連携を解除しますか？')) {
      return;
    }

    console.log('[UI] Disconnecting Fitbit');
    setIsLoading(true);
    
    try {
      // サーバーサイドで連携解除
      await fetch('/api/auth/fitbit/revoke', { method: 'POST' });
      
      // クッキーを削除
      document.cookie = 'fitbit_user_info=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      
      // LocalStorageもクリア（後方互換性）
      await fitbitAuth.logout();
      
      setAuthState({ isAuthenticated: false });
      setMessage({ type: 'info', text: 'Fitbitとの連携を解除しました' });
    } catch (error) {
      console.error('[UI] Failed to disconnect:', error);
      setMessage({ type: 'error', text: '連携解除に失敗しました' });
    } finally {
      setIsLoading(false);
    }
  };

  // データを同期
  const handleSync = async () => {
    console.log('[UI] Starting data sync');
    setIsSyncing(true);
    setMessage({ type: 'info', text: 'データを同期中...' });
    
    try {
      // TODO: 実際の同期処理を実装
      // const { fitbitApi } = await import('@/lib/fitbit/api');
      // const data = await fitbitApi.syncRecentData(7);
      
      // 一時的にダミーの遅延
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setMessage({ type: 'success', text: 'データの同期が完了しました' });
    } catch (error) {
      console.error('[UI] Sync failed:', error);
      setMessage({ type: 'error', text: 'データ同期に失敗しました' });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-3xl font-bold">外部サービス連携</h1>
        <p className="text-muted-foreground mt-2">
          健康データやその他の外部サービスと連携して、より詳細な分析を行えます
        </p>
      </div>

      {/* メッセージ表示 */}
      {message && (
        <Card className={`border ${
          message.type === 'success' ? 'border-green-500 bg-green-50 dark:bg-green-950' :
          message.type === 'error' ? 'border-red-500 bg-red-50 dark:bg-red-950' :
          'border-blue-500 bg-blue-50 dark:bg-blue-950'
        }`}>
          <CardContent className="flex items-center gap-3 p-4">
            {message.type === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
            {message.type === 'error' && <XCircle className="h-5 w-5 text-red-500" />}
            {message.type === 'info' && <AlertCircle className="h-5 w-5 text-blue-500" />}
            <span className={`${
              message.type === 'success' ? 'text-green-700 dark:text-green-300' :
              message.type === 'error' ? 'text-red-700 dark:text-red-300' :
              'text-blue-700 dark:text-blue-300'
            }`}>
              {message.text}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Fitbit連携カード */}
      <Card className="border border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-pink-100 dark:bg-pink-900 p-2">
                <Activity className="h-6 w-6 text-pink-600 dark:text-pink-400" />
              </div>
              <div>
                <CardTitle>Fitbit</CardTitle>
                <CardDescription>
                  睡眠、活動量、心拍数などの健康データを同期
                </CardDescription>
              </div>
            </div>
            <Badge variant={authState.isAuthenticated ? 'default' : 'secondary'}>
              {authState.isAuthenticated ? '連携中' : '未連携'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : authState.isAuthenticated ? (
            <>
              {/* 連携済みの情報 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>ユーザーID: {authState.userId || 'N/A'}</span>
                </div>
                {authState.lastSync && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <RefreshCw className="h-4 w-4" />
                    <span>
                      最終同期: {new Date(authState.lastSync).toLocaleString('ja-JP')}
                    </span>
                  </div>
                )}
              </div>

              <Separator />

              {/* 同期可能なデータタイプ */}
              <div className="space-y-2">
                <p className="text-sm font-medium">同期可能なデータ:</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Moon className="h-3 w-3" />
                    睡眠データ
                  </Badge>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    活動データ
                  </Badge>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Heart className="h-3 w-3" />
                    心拍数
                  </Badge>
                </div>
              </div>

              <Separator />

              {/* アクションボタン */}
              <div className="flex gap-3">
                <Button
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="flex-1"
                >
                  {isSyncing ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      同期中...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      データを同期
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleDisconnect}
                  variant="outline"
                  className="flex-1"
                >
                  <Unlink className="mr-2 h-4 w-4" />
                  連携解除
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* 未連携の説明 */}
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Fitbitと連携することで、以下のデータを自動的に取得できます：
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>睡眠時間と睡眠の質</li>
                  <li>歩数、消費カロリー、アクティブな時間</li>
                  <li>心拍数の変化</li>
                </ul>
                <p>
                  これらのデータは、プロジェクトの進捗と健康状態の相関を分析するために使用されます。
                </p>
              </div>

              {/* 連携開始ボタン */}
              <Button
                onClick={handleConnect}
                className="w-full"
                size="lg"
              >
                <Link2 className="mr-2 h-4 w-4" />
                Fitbitと連携する
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* その他のサービス（将来的に追加） */}
      <Card className="border border-border opacity-50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 dark:bg-blue-900 p-2">
              <Activity className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle>OpenWeatherMap</CardTitle>
              <CardDescription>
                天気データを取得して、作業環境の影響を分析（近日公開）
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}

// Suspense境界でラップしたメインコンポーネント
export default function IntegrationsPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    }>
      <IntegrationsPageContent />
    </Suspense>
  );
}