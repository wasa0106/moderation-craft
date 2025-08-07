'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Download, Clock, Database, Cloud, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

interface ExportHistoryItem {
  key: string;
  size: number;
  lastModified: string;
  date: string;
  tableName: string;
}

interface ExportResult {
  statusCode: number;
  body: {
    message: string;
    tableName?: string;
    itemCount?: number;
    s3Location?: string;
    exportDate?: string;
    error?: string;
  };
}

export default function PipelineDebugPage() {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [exportHistory, setExportHistory] = useState<ExportHistoryItem[]>([]);
  const [lastExportResult, setLastExportResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // エクスポート履歴を取得
  const fetchExportHistory = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const response = await fetch('/api/pipeline/status');
      const data = await response.json();
      
      if (data.success) {
        setExportHistory(data.data.exports);
      } else {
        setError(data.error || 'Failed to fetch export history');
      }
    } catch (error) {
      console.error('Failed to fetch export history:', error);
      setError('エクスポート履歴の取得に失敗しました');
    } finally {
      setRefreshing(false);
    }
  };

  // エクスポートを手動実行
  const triggerExport = async () => {
    setLoading(true);
    setError(null);
    setLastExportResult(null);
    
    try {
      const response = await fetch('/api/pipeline/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableName: 'moderation-craft-data' }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setLastExportResult(data.data);
        // 履歴を更新
        setTimeout(fetchExportHistory, 2000);
      } else {
        setError(data.error || 'Export failed');
      }
    } catch (error) {
      console.error('Export failed:', error);
      setError('エクスポートの実行に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 最新データを取得
  const downloadLatest = async () => {
    try {
      const response = await fetch('/api/pipeline/latest');
      const data = await response.json();
      
      if (data.success) {
        // JSONデータをダウンロード
        const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `export-${new Date().toISOString()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Download failed:', error);
      setError('ダウンロードに失敗しました');
    }
  };

  useEffect(() => {
    fetchExportHistory();
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">データパイプライン管理</h1>
          <p className="text-muted-foreground">
            DynamoDB → S3 エクスポートの管理とモニタリング
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={fetchExportHistory} 
            variant="outline"
            disabled={refreshing}
          >
            {refreshing && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
            更新
          </Button>
          <Button onClick={triggerExport} disabled={loading}>
            {loading ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Database className="mr-2 h-4 w-4" />
            )}
            手動エクスポート
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="flex items-center gap-2 pt-6">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="status" className="flex-1">
        <TabsList>
          <TabsTrigger value="status">ステータス</TabsTrigger>
          <TabsTrigger value="history">履歴</TabsTrigger>
          <TabsTrigger value="config">設定</TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="space-y-4">
          {/* 最新のエクスポート結果 */}
          {lastExportResult && (
            <Card className="border border-border">
              <CardHeader>
                <CardTitle>最新のエクスポート結果</CardTitle>
                <CardDescription>
                  ステータスコード: {lastExportResult.statusCode}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">メッセージ:</span> {lastExportResult.body.message}
                  </p>
                  {lastExportResult.body.itemCount !== undefined && (
                    <p className="text-sm">
                      <span className="font-medium">レコード数:</span> {lastExportResult.body.itemCount}
                    </p>
                  )}
                  {lastExportResult.body.s3Location && (
                    <p className="text-sm">
                      <span className="font-medium">保存先:</span> 
                      <code className="ml-2 text-xs bg-muted px-1 py-0.5 rounded">
                        {lastExportResult.body.s3Location}
                      </code>
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* エクスポート統計 */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  総エクスポート数
                </CardTitle>
                <Cloud className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{exportHistory.length}</div>
                <p className="text-xs text-muted-foreground">
                  過去7日間
                </p>
              </CardContent>
            </Card>

            <Card className="border border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  最終エクスポート
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {exportHistory[0]?.date || '-'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {exportHistory[0]?.tableName || 'データなし'}
                </p>
              </CardContent>
            </Card>

            <Card className="border border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  データサイズ
                </CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {exportHistory[0] 
                    ? formatFileSize(exportHistory[0].size)
                    : '-'}
                </div>
                <p className="text-xs text-muted-foreground">
                  最新ファイル
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card className="border border-border">
            <CardHeader>
              <CardTitle>エクスポート履歴</CardTitle>
              <CardDescription>
                過去7日間のエクスポート履歴
              </CardDescription>
            </CardHeader>
            <CardContent>
              {exportHistory.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  エクスポート履歴がありません
                </p>
              ) : (
                <div className="space-y-2">
                  {exportHistory.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{item.tableName}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(item.lastModified), 'yyyy/MM/dd HH:mm', { locale: ja })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {formatFileSize(item.size)}
                        </Badge>
                        {index === 0 && (
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={downloadLatest}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config">
          <Card className="border border-border">
            <CardHeader>
              <CardTitle>パイプライン設定</CardTitle>
              <CardDescription>
                現在のAWSリソース設定
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium">S3バケット</p>
                <code className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded">
                  moderation-craft-data-800860245583
                </code>
              </div>
              <div>
                <p className="text-sm font-medium">Lambda関数</p>
                <code className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded">
                  moderation-craft-export-dynamodb
                </code>
              </div>
              <div>
                <p className="text-sm font-medium">スケジュール</p>
                <p className="text-sm text-muted-foreground">
                  毎日 14:00 JST (cron: 0 5 * * ? *)
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">DynamoDBテーブル</p>
                <code className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded">
                  moderation-craft-data
                </code>
              </div>
              <div>
                <p className="text-sm font-medium">AWSリージョン</p>
                <code className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded">
                  ap-northeast-1
                </code>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}