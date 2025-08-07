# 技術仕様書

## API仕様

### 内部API

#### データエクスポートAPI

**POST /api/pipeline/export**
```typescript
interface ExportRequest {
  tableName: string;
  startDate?: string;  // ISO 8601
  endDate?: string;    // ISO 8601
  format?: 'json' | 'parquet';
}

interface ExportResponse {
  jobId: string;
  status: 'initiated' | 'processing' | 'completed' | 'failed';
  s3Location?: string;
  recordCount?: number;
  error?: string;
}
```

#### データ更新API

**POST /api/pipeline/refresh**
```typescript
interface RefreshRequest {
  dataSources: ('fitbit' | 'weather' | 'calendar')[];
  userId: string;
  date?: string;  // デフォルトは今日
}

interface RefreshResponse {
  success: boolean;
  refreshedSources: {
    source: string;
    status: 'success' | 'failed';
    recordCount?: number;
    error?: string;
  }[];
  timestamp: string;
}
```

### 外部API統合

#### Fitbit API
- **認証**: OAuth 2.0 + PKCE
- **スコープ**: activity, heartrate, location, profile, settings, sleep, weight
- **レート制限**: 150リクエスト/時間
- **エンドポイント**:
  - `/1.2/user/-/sleep/date/{date}.json`
  - `/1/user/-/activities/date/{date}.json`
  - `/1/user/-/activities/heart/date/{date}/1d.json`

#### OpenWeatherMap API
- **認証**: APIキー
- **レート制限**: 1000リクエスト/日（無料プラン）
- **エンドポイント**:
  - `/data/2.5/weather`
  - `/data/2.5/forecast`
  - `/data/2.5/air_pollution`

#### Hugging Face Inference API
- **認証**: Bearer Token
- **レート制限**: モデルによって異なる
- **利用モデル**:
  - `moderation-craft/productivity-predictor`（カスタム）
  - `facebook/timeseries-anomaly-detection`
  - `meta-llama/Llama-2-7b-chat-hf`

## データスキーマ

### DynamoDBテーブル

#### moderation-craft-tokens
```typescript
interface TokenRecord {
  user_id: string;         // パーティションキー
  service: string;         // ソートキー (fitbit, google, etc)
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scope: string;
  updated_at: string;
  ttl?: number;           // 自動削除用
}
```

#### moderation-craft-sync-queue
```typescript
interface SyncQueueItem {
  id: string;              // パーティションキー
  timestamp: number;       // ソートキー
  entity_type: string;
  entity_id: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retry_count: number;
  error?: string;
  ttl: number;
}
```

### S3データ構造

#### 生データ（raw層）
```json
{
  "source": "fitbit",
  "user_id": "user-123",
  "date": "2024-02-01",
  "fetched_at": "2024-02-01T10:30:00Z",
  "data": {
    // ソース固有のデータ構造
  },
  "metadata": {
    "api_version": "1.2",
    "rate_limit_remaining": 145
  }
}
```

#### 正規化データ（staging層）
```json
{
  "id": "md5hash",
  "source": "fitbit",
  "timestamp": "2024-02-01T10:30:00Z",
  "user_id": "user-123",
  "date": "2024-02-01",
  "health_metrics": {
    "sleep": {
      "duration_hours": 7.5,
      "efficiency_percent": 85,
      "deep_sleep_hours": 1.5,
      "rem_sleep_hours": 2.0,
      "quality_score": 82
    },
    "activity": {
      "steps": 8500,
      "distance_km": 6.2,
      "calories_burned": 2100,
      "active_minutes": 45,
      "sedentary_percent": 65
    }
  }
}
```

#### 分析用データ（gold層）
```json
{
  "user_id": "user-123",
  "date": "2024-02-01",
  "productivity_score": 75,
  "health_score": 82,
  "environmental_score": 68,
  "correlations": {
    "sleep_productivity": 0.72,
    "activity_productivity": 0.58,
    "environment_productivity": 0.31
  },
  "predictions": {
    "tomorrow_productivity": 78,
    "confidence": 0.85
  },
  "insights": [
    "睡眠時間を7時間以上確保すると生産性が15%向上",
    "午前中の作業が最も効率的（14:00以降は20%低下）"
  ]
}
```

## エラーコード定義

| コード | 名称 | 説明 | 対処法 |
|-------|------|------|--------|
| E001 | AUTH_FAILED | 認証失敗 | トークンをリフレッシュ |
| E002 | RATE_LIMIT | レート制限超過 | リトライまたは待機 |
| E003 | DATA_VALIDATION | データ検証エラー | データ形式を確認 |
| E004 | S3_ACCESS | S3アクセスエラー | IAMロールを確認 |
| E005 | DYNAMO_THROTTLE | DynamoDBスロットリング | 容量を増加 |
| E006 | EXTERNAL_API | 外部API障害 | リトライまたはフォールバック |
| E007 | TRANSFORM_ERROR | データ変換エラー | スキーマを確認 |
| E008 | TIMEOUT | タイムアウト | タイムアウト値を調整 |
| E009 | MEMORY_LIMIT | メモリ制限超過 | Lambdaメモリを増加 |
| E010 | INVALID_SCHEMA | スキーマ不一致 | スキーマバージョンを確認 |

## パフォーマンス要件

### レスポンスタイム
- API応答: < 500ms (p95)
- ダッシュボード読込: < 3秒
- データ更新: < 10秒
- バッチ処理: < 30分/日

### スループット
- 同時ユーザー: 100
- API呼び出し: 1000/分
- データ処理: 100万レコード/時

### 可用性
- アップタイム: 99.5%
- RPO: 24時間
- RTO: 4時間

## セキュリティ仕様

### 認証・認可
- **ユーザー認証**: Cognito または Auth0
- **API認証**: APIキー + JWT
- **サービス間通信**: IAMロール

### データ保護
- **保存時暗号化**: S3 SSE-S3, DynamoDB暗号化
- **転送時暗号化**: TLS 1.2以上
- **機密情報管理**: AWS Secrets Manager

### アクセス制御
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::ACCOUNT:role/DataPipelineRole"
      },
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::moderation-craft-data/*",
      "Condition": {
        "StringEquals": {
          "s3:x-amz-server-side-encryption": "AES256"
        }
      }
    }
  ]
}
```

## ログ設計

### ログレベル
- **ERROR**: システムエラー、API失敗
- **WARN**: リトライ、パフォーマンス低下
- **INFO**: 正常処理、ステータス変更
- **DEBUG**: 詳細なデバッグ情報

### ログフォーマット
```json
{
  "timestamp": "2024-02-01T10:30:00Z",
  "level": "INFO",
  "service": "data-pipeline",
  "function": "export-dynamodb",
  "requestId": "uuid",
  "userId": "user-123",
  "message": "Export completed",
  "metadata": {
    "tableName": "moderation-craft-sessions",
    "recordCount": 1500,
    "duration": 2340,
    "s3Location": "s3://bucket/key"
  }
}
```

## 依存関係

### NPMパッケージ
```json
{
  "@aws-sdk/client-dynamodb": "^3.478.0",
  "@aws-sdk/client-s3": "^3.478.0",
  "@aws-sdk/client-lambda": "^3.478.0",
  "@aws-sdk/client-secrets-manager": "^3.478.0",
  "@duckdb/duckdb-wasm": "^1.28.0",
  "@tanstack/react-query": "^5.17.0",
  "@nivo/heatmap": "^0.84.0",
  "dbt-duckdb": "^1.7.0",
  "zod": "^3.22.0"
}
```

### AWSサービス
- S3: データレイク
- Lambda: サーバーレス処理
- DynamoDB: メタデータ管理
- Step Functions: ワークフロー
- Secrets Manager: 認証情報管理
- EventBridge: イベント駆動

### 外部サービス
- Fitbit API: 健康データ
- OpenWeatherMap: 天候データ
- Hugging Face: ML推論
- GitHub Actions: CI/CD

---

*最終更新: 2024年2月*
*バージョン: 1.0.0*