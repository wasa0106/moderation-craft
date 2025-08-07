'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDuckDB } from '@/hooks/useDuckDB';
import { Loader2, Database, CheckCircle, XCircle, Play, RefreshCw } from 'lucide-react';

export default function AnalyticsDebugPage() {
  const { query, getProductivityDaily, getWellnessCorrelation, getPerformanceSummary, loading, error, isInitialized } = useDuckDB();
  const [testResults, setTestResults] = useState<any>({});
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [queryResult, setQueryResult] = useState<any>(null);
  const [customQuery, setCustomQuery] = useState('SELECT 1 as test, \'Hello DuckDB\' as message');

  // 接続状態の確認
  const runConnectionTest = async () => {
    setIsRunningTests(true);
    const results: any = {};
    
    try {
      // 基本的な接続テスト
      const basicTest = await query('SELECT 1 as test');
      results.connection = { status: 'success', data: basicTest };
      
      // S3アクセステスト（実際のバケットパスを使用）
      try {
        const s3Test = await query(`
          SELECT COUNT(*) as file_count 
          FROM glob('s3://moderation-craft-data-800860245583/raw/**/*.parquet')
          LIMIT 1
        `);
        results.s3Access = { status: 'success', data: s3Test };
      } catch (e) {
        results.s3Access = { status: 'error', error: (e as Error).message };
      }
      
      // データマートの存在確認
      try {
        const martTest = await query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_type = 'VIEW'
        `);
        results.dataMarts = { status: 'success', data: martTest };
      } catch (e) {
        results.dataMarts = { status: 'error', error: (e as Error).message };
      }
      
    } catch (e) {
      results.connection = { status: 'error', error: (e as Error).message };
    }
    
    setTestResults(results);
    setIsRunningTests(false);
  };

  // サンプルクエリの実行
  const runSampleQueries = async () => {
    setIsRunningTests(true);
    const results: any = {};
    
    try {
      // 生産性データの取得（仮のユーザーID使用）
      const productivityData = await getProductivityDaily('default_user', 7);
      results.productivity = { status: 'success', data: productivityData };
    } catch (e) {
      results.productivity = { status: 'error', error: (e as Error).message };
    }
    
    try {
      // 相関データの取得
      const correlationData = await getWellnessCorrelation('default_user', 7);
      results.correlation = { status: 'success', data: correlationData };
    } catch (e) {
      results.correlation = { status: 'error', error: (e as Error).message };
    }
    
    try {
      // パフォーマンスサマリーの取得
      const summaryData = await getPerformanceSummary('default_user');
      results.summary = { status: 'success', data: summaryData };
    } catch (e) {
      results.summary = { status: 'error', error: (e as Error).message };
    }
    
    setTestResults(results);
    setIsRunningTests(false);
  };

  // カスタムクエリの実行
  const runCustomQuery = async () => {
    try {
      const result = await query(customQuery);
      setQueryResult({ status: 'success', data: result });
    } catch (e) {
      setQueryResult({ status: 'error', error: (e as Error).message });
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics Debug</h1>
        <p className="text-muted-foreground">DuckDB WASM分析基盤のテストページ</p>
      </div>

      {/* 接続状態 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            接続状態
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isInitialized && !error && <CheckCircle className="h-4 w-4 text-green-500" />}
              {error && <XCircle className="h-4 w-4 text-red-500" />}
              <span>
                {loading && '初期化中...'}
                {isInitialized && !error && 'DuckDB接続完了'}
                {error && `エラー: ${error.message}`}
              </span>
            </div>
            {isInitialized && (
              <div className="mt-4 space-x-2">
                <Button onClick={runConnectionTest} disabled={isRunningTests}>
                  {isRunningTests ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  接続テスト実行
                </Button>
                <Button onClick={runSampleQueries} disabled={isRunningTests} variant="outline">
                  {isRunningTests ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  サンプルクエリ実行
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* テスト結果 */}
      {Object.keys(testResults).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>テスト結果</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(testResults).map(([key, result]: [string, any]) => (
                <div key={key} className="border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    {result.status === 'success' ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="font-medium">{key}</span>
                  </div>
                  {result.status === 'success' ? (
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  ) : (
                    <Alert variant="destructive">
                      <AlertDescription>{result.error}</AlertDescription>
                    </Alert>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* カスタムクエリ */}
      <Card>
        <CardHeader>
          <CardTitle>カスタムクエリ実行</CardTitle>
          <CardDescription>
            DuckDB SQLを直接実行できます
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <textarea
              className="w-full h-32 p-3 border rounded-lg font-mono text-sm"
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              placeholder="SELECT * FROM ..."
            />
            <Button onClick={runCustomQuery} disabled={!isInitialized}>
              <Play className="mr-2 h-4 w-4" />
              クエリ実行
            </Button>
            {queryResult && (
              <div className="mt-4 border rounded-lg p-3">
                {queryResult.status === 'success' ? (
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                    {JSON.stringify(queryResult.data, null, 2)}
                  </pre>
                ) : (
                  <Alert variant="destructive">
                    <AlertDescription>{queryResult.error}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* サンプルクエリ集 */}
      <Card>
        <CardHeader>
          <CardTitle>サンプルクエリ集</CardTitle>
          <CardDescription>
            コピーして使用できるクエリ例
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="basic">
            <TabsList>
              <TabsTrigger value="basic">基本</TabsTrigger>
              <TabsTrigger value="s3">S3アクセス</TabsTrigger>
              <TabsTrigger value="analytics">分析</TabsTrigger>
            </TabsList>
            <TabsContent value="basic" className="space-y-2">
              <pre className="text-xs bg-muted p-3 rounded">
{`-- DuckDBバージョン確認
SELECT version();

-- 現在の日時
SELECT CURRENT_TIMESTAMP;

-- 簡単な計算
SELECT 
  1 + 1 as sum,
  10 * 5 as product,
  100 / 3.0 as division;`}
              </pre>
            </TabsContent>
            <TabsContent value="s3" className="space-y-2">
              <pre className="text-xs bg-muted p-3 rounded">
{`-- S3ファイル一覧（Parquet）
SELECT * FROM glob('s3://moderation-craft-data-800860245583/raw/**/*.parquet') LIMIT 10;

-- S3 JSONファイル読み込み
SELECT * FROM read_json_auto('s3://moderation-craft-data-800860245583/raw/fitbit/**/*.json') LIMIT 5;

-- S3 Parquetファイル読み込み
SELECT * FROM read_parquet('s3://moderation-craft-data-800860245583/raw/internal/**/*.parquet') LIMIT 5;`}
              </pre>
            </TabsContent>
            <TabsContent value="analytics" className="space-y-2">
              <pre className="text-xs bg-muted p-3 rounded">
{`-- 生産性トレンド（過去7日）
SELECT 
  date,
  productivity_score,
  health_score,
  wellness_productivity_index
FROM mart_productivity_daily
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC;

-- 睡眠と生産性の相関
SELECT 
  date,
  sleep_score,
  productivity_score,
  correlation_pattern
FROM mart_wellness_correlation
WHERE significant_change = true
ORDER BY date DESC
LIMIT 10;

-- 週間パフォーマンスサマリー
SELECT 
  WEEK(date) as week_number,
  AVG(productivity_score) as avg_productivity,
  AVG(health_score) as avg_health,
  COUNT(*) as days_tracked
FROM mart_productivity_daily
GROUP BY WEEK(date)
ORDER BY week_number DESC;`}
              </pre>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}