'use client';

/**
 * Fitbit APIデバッグページ
 * Fitbit APIの動作テストやデータ確認を行うためのデバッグUI
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fitbitAuth } from '@/lib/fitbit/auth';
import { fitbitApi } from '@/lib/fitbit/api';
import type { FitbitAuthState, NormalizedHealthData } from '@/lib/fitbit/types';
import { 
  Activity, 
  Heart, 
  Moon, 
  RefreshCw, 
  Download, 
  Calendar, 
  User,
  Key,
  CheckCircle,
  XCircle,
  Copy,
  Eye,
  EyeOff
} from 'lucide-react';

export default function FitbitDebugPage() {
  const [authState, setAuthState] = useState<FitbitAuthState>({ isAuthenticated: false });
  const [isLoading, setIsLoading] = useState(false);
  const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0]);
  const [testResult, setTestResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<any>(null);

  // ページロード時に認証状態をチェック
  useEffect(() => {
    checkAuthState();
    loadTokenInfo();
  }, []);

  // 認証状態を確認
  const checkAuthState = () => {
    const state = fitbitAuth.getAuthState();
    setAuthState(state);
    console.log('[Debug] Auth state:', state);
  };

  // トークン情報を取得
  const loadTokenInfo = async () => {
    try {
      const token = await fitbitAuth.getToken();
      if (token) {
        const expiresIn = Math.max(0, Math.floor((token.expiresAt - Date.now()) / 1000));
        setTokenInfo({
          userId: token.userId,
          scope: token.scope,
          expiresIn: expiresIn,
          isExpired: fitbitAuth.isTokenExpired(token),
          accessToken: token.accessToken,
          refreshToken: token.refreshToken,
        });
      }
    } catch (error) {
      console.error('[Debug] Failed to load token info:', error);
    }
  };

  // APIテスト実行
  const runApiTest = async (testType: string) => {
    console.log(`[Debug] Running ${testType} test`);
    setIsLoading(true);
    setError(null);
    setTestResult(null);

    try {
      let result;
      switch (testType) {
        case 'profile':
          result = await fitbitApi.getProfile();
          break;
        case 'sleep':
          result = await fitbitApi.getSleepData(testDate);
          break;
        case 'activity':
          result = await fitbitApi.getActivityData(testDate);
          break;
        case 'heart':
          result = await fitbitApi.getHeartRateData(testDate);
          break;
        case 'steps':
          result = await fitbitApi.getStepsData(testDate);
          break;
        case 'calories':
          result = await fitbitApi.getCaloriesData(testDate);
          break;
        case 'all':
          result = await fitbitApi.getAllHealthData(testDate);
          break;
        case 'sync7days':
          result = await fitbitApi.syncRecentData(7);
          break;
        default:
          throw new Error(`Unknown test type: ${testType}`);
      }
      
      setTestResult(result);
      console.log('[Debug] Test result:', result);
    } catch (err: any) {
      console.error('[Debug] Test failed:', err);
      setError(err.message || 'Test failed');
    } finally {
      setIsLoading(false);
    }
  };

  // トークンをリフレッシュ
  const handleRefreshToken = async () => {
    console.log('[Debug] Refreshing token');
    setIsLoading(true);
    setError(null);
    
    try {
      const token = await fitbitAuth.getToken();
      if (token) {
        const refreshed = await fitbitAuth.refreshToken(token.refreshToken);
        if (refreshed) {
          await fitbitAuth.saveToken(refreshed);
          checkAuthState();
          loadTokenInfo();
          setTestResult({ message: 'Token refreshed successfully', ...refreshed });
        } else {
          throw new Error('Failed to refresh token');
        }
      } else {
        throw new Error('No token found');
      }
    } catch (err: any) {
      console.error('[Debug] Refresh failed:', err);
      setError(err.message || 'Refresh failed');
    } finally {
      setIsLoading(false);
    }
  };

  // テスト結果をコピー
  const copyTestResult = () => {
    if (testResult) {
      navigator.clipboard.writeText(JSON.stringify(testResult, null, 2));
    }
  };

  // トークンをコピー
  const copyToken = (value: string) => {
    navigator.clipboard.writeText(value);
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-3xl font-bold">Fitbit APIデバッグ</h1>
        <p className="text-muted-foreground mt-2">
          Fitbit APIの動作テストとデータ確認
        </p>
      </div>

      {/* 認証状態 */}
      <Card className="border border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>認証状態</CardTitle>
            <Badge variant={authState.isAuthenticated ? 'default' : 'secondary'}>
              {authState.isAuthenticated ? '認証済み' : '未認証'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {authState.isAuthenticated && tokenInfo ? (
            <>
              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">ユーザーID:</span>
                  <span className="text-sm text-muted-foreground">{tokenInfo.userId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">スコープ:</span>
                  <span className="text-sm text-muted-foreground break-all">{tokenInfo.scope}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">有効期限:</span>
                  <div className="flex items-center gap-2">
                    {tokenInfo.isExpired ? (
                      <Badge variant="destructive">期限切れ</Badge>
                    ) : (
                      <Badge variant="outline">{Math.floor(tokenInfo.expiresIn / 60)}分</Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* トークン表示 */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm">アクセストークン</Label>
                  <div className="flex gap-2">
                    <Input
                      type={showToken ? 'text' : 'password'}
                      value={tokenInfo.accessToken}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setShowToken(!showToken)}
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => copyToken(tokenInfo.accessToken)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleRefreshToken}
                disabled={isLoading}
                className="w-full"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                トークンをリフレッシュ
              </Button>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">
                認証されていません。設定ページからFitbitと連携してください。
              </p>
              <Button onClick={() => window.location.href = '/settings/integrations'}>
                設定ページへ
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* APIテスト */}
      {authState.isAuthenticated && (
        <Card className="border border-border">
          <CardHeader>
            <CardTitle>APIテスト</CardTitle>
            <CardDescription>
              各APIエンドポイントをテストしてデータを確認
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">基本</TabsTrigger>
                <TabsTrigger value="health">ヘルス</TabsTrigger>
                <TabsTrigger value="sync">同期</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <div className="grid gap-3">
                  <Button onClick={() => runApiTest('profile')} disabled={isLoading}>
                    <User className="mr-2 h-4 w-4" />
                    プロフィール取得
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="health" className="space-y-4">
                <div className="space-y-2">
                  <Label>テスト日付</Label>
                  <Input
                    type="date"
                    value={testDate}
                    onChange={(e) => setTestDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div className="grid gap-3">
                  <Button onClick={() => runApiTest('sleep')} disabled={isLoading}>
                    <Moon className="mr-2 h-4 w-4" />
                    睡眠データ取得
                  </Button>
                  <Button onClick={() => runApiTest('activity')} disabled={isLoading}>
                    <Activity className="mr-2 h-4 w-4" />
                    活動データ取得
                  </Button>
                  <Button onClick={() => runApiTest('heart')} disabled={isLoading}>
                    <Heart className="mr-2 h-4 w-4" />
                    心拍数データ取得
                  </Button>
                  <Button onClick={() => runApiTest('steps')} disabled={isLoading} variant="outline">
                    歩数データ取得
                  </Button>
                  <Button onClick={() => runApiTest('calories')} disabled={isLoading} variant="outline">
                    カロリーデータ取得
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="sync" className="space-y-4">
                <div className="grid gap-3">
                  <Button onClick={() => runApiTest('all')} disabled={isLoading}>
                    <Download className="mr-2 h-4 w-4" />
                    全データ取得（指定日）
                  </Button>
                  <Button onClick={() => runApiTest('sync7days')} disabled={isLoading}>
                    <Calendar className="mr-2 h-4 w-4" />
                    過去7日間を同期
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* テスト結果 */}
      {(testResult || error) && (
        <Card className={`border ${error ? 'border-red-500' : 'border-green-500'}`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {error ? (
                  <>
                    <XCircle className="h-5 w-5 text-red-500" />
                    エラー
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    テスト結果
                  </>
                )}
              </CardTitle>
              {testResult && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyTestResult}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-96 text-xs">
              {error ? (
                <code className="text-red-500">{error}</code>
              ) : (
                <code>{JSON.stringify(testResult, null, 2)}</code>
              )}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}