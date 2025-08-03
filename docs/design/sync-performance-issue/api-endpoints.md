# API エンドポイント仕様

## 概要

同期パフォーマンス改善のためのAPI設計。効率的なバッチ処理、エラーハンドリング、監視機能を提供します。

## 認証

すべてのエンドポイントはAPI Key認証を使用します（開発環境）。

```
x-api-key: {API_KEY}
```

## エンドポイント一覧

### 1. 同期処理

#### POST /api/sync
単一エンティティの同期処理

**リクエスト:**
```json
{
  "entity_type": "project|big_task|small_task|work_session|mood_entry|dopamine_entry|daily_condition|schedule_memo|sleep_schedule",
  "operation": "CREATE|UPDATE|DELETE",
  "payload": {
    "id": "uuid",
    "user_id": "uuid",
    // エンティティ固有のフィールド
  }
}
```

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "entity_id": "uuid",
    "synced_at": "2024-01-20T10:00:00Z",
    "version": 2
  }
}
```

**エラーレスポンス:**
```json
{
  "success": false,
  "error": {
    "code": "SYNC_ERROR",
    "message": "同期に失敗しました",
    "type": "network|auth|rate_limit|validation",
    "details": {}
  }
}
```

#### POST /api/sync/batch
複数エンティティの一括同期（改善版）

**リクエスト:**
```json
{
  "entity_type": "project|big_task|small_task|...",
  "operations": [
    {
      "operation": "CREATE",
      "payload": { /* エンティティデータ */ }
    },
    {
      "operation": "UPDATE",
      "payload": { /* エンティティデータ */ }
    }
  ],
  "compression": "gzip", // オプション
  "bulk_operation_id": "uuid" // クライアント側でのグループ識別子
}
```

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "processed_count": 10,
    "success_count": 9,
    "failed_count": 1,
    "results": [
      {
        "entity_id": "uuid",
        "success": true,
        "synced_at": "2024-01-20T10:00:00Z"
      },
      {
        "entity_id": "uuid",
        "success": false,
        "error": "Validation error: missing required field"
      }
    ],
    "bulk_operation_id": "uuid",
    "processing_time_ms": 150
  }
}
```

### 2. 同期状態管理

#### GET /api/sync/queue
同期キューの状態を取得

**リクエストパラメータ:**
- `status`: pending|processing|failed|dormant（オプション）
- `limit`: 取得件数（デフォルト: 100）
- `offset`: オフセット（ページネーション用）

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "entity_type": "project",
        "entity_id": "uuid",
        "operation_type": "UPDATE",
        "status": "pending",
        "attempt_count": 2,
        "next_retry_after": "2024-01-20T10:05:00Z",
        "created_at": "2024-01-20T10:00:00Z"
      }
    ],
    "total_count": 150,
    "page_info": {
      "limit": 100,
      "offset": 0,
      "has_next": true
    }
  }
}
```

#### POST /api/sync/queue/cleanup
完了済みまたは失敗した同期アイテムのクリーンアップ

**リクエスト:**
```json
{
  "target": "completed|failed|all",
  "older_than_days": 7,
  "max_attempts": 10 // failedの場合のみ
}
```

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "deleted_count": 523,
    "remaining_count": 45
  }
}
```

### 3. 同期統計・監視

#### GET /api/sync/statistics
同期統計情報の取得

**リクエストパラメータ:**
- `period`: hour|day|week|month（デフォルト: day）
- `from`: 開始日時（ISO 8601形式）
- `to`: 終了日時（ISO 8601形式）

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_syncs": 1523,
      "successful_syncs": 1456,
      "failed_syncs": 67,
      "success_rate": 95.6,
      "average_duration_ms": 234
    },
    "errors_by_type": {
      "network": 45,
      "auth": 2,
      "rate_limit": 15,
      "unknown": 5
    },
    "bulk_optimization": {
      "operations_optimized": 234,
      "entities_processed": 2340,
      "data_saved_bytes": 567890,
      "compression_ratio": 0.73
    },
    "timeline": [
      {
        "timestamp": "2024-01-20T10:00:00Z",
        "syncs": 45,
        "errors": 2,
        "duration_ms": 210
      }
    ]
  }
}
```

#### GET /api/sync/health
同期システムのヘルスチェック

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "status": "healthy|degraded|unhealthy",
    "checks": {
      "queue_size": {
        "status": "healthy",
        "value": 45,
        "threshold": 1000
      },
      "error_rate": {
        "status": "healthy",
        "value": 2.3,
        "threshold": 10.0
      },
      "processing_time": {
        "status": "healthy",
        "value": 234,
        "threshold": 5000
      },
      "database_connection": {
        "status": "healthy",
        "latency_ms": 12
      }
    },
    "last_sync": "2024-01-20T10:00:00Z",
    "uptime_seconds": 345600
  }
}
```

### 4. 手動同期制御

#### POST /api/sync/trigger
手動で同期を実行

**リクエスト:**
```json
{
  "force": true, // 通常の制限を無視して実行
  "entity_types": ["project", "big_task"], // 特定のエンティティタイプのみ（オプション）
  "retry_failed": true // 失敗したアイテムもリトライ
}
```

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "sync_id": "uuid",
    "items_queued": 45,
    "estimated_time_ms": 5000
  }
}
```

#### POST /api/sync/pause
同期処理を一時停止

**リクエスト:**
```json
{
  "duration_minutes": 30, // オプション：自動再開までの時間
  "reason": "maintenance" // オプション：停止理由
}
```

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "paused_at": "2024-01-20T10:00:00Z",
    "resume_at": "2024-01-20T10:30:00Z",
    "pending_items": 23
  }
}
```

### 5. デバッグ・診断

#### GET /api/sync/debug/:entity_id
特定エンティティの同期履歴を取得

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "entity_id": "uuid",
    "entity_type": "project",
    "sync_history": [
      {
        "sync_id": "uuid",
        "operation": "UPDATE",
        "status": "completed",
        "timestamp": "2024-01-20T10:00:00Z",
        "duration_ms": 234,
        "attempt_count": 1
      }
    ],
    "current_state": {
      "local_version": 5,
      "remote_version": 5,
      "is_synced": true,
      "last_modified": "2024-01-20T10:00:00Z"
    }
  }
}
```

## エラーコード

| コード | 説明 | HTTPステータス |
|--------|------|----------------|
| SYNC_ERROR | 一般的な同期エラー | 500 |
| ENTITY_NOT_FOUND | エンティティが見つからない | 404 |
| VALIDATION_ERROR | バリデーションエラー | 400 |
| AUTH_ERROR | 認証エラー | 401 |
| RATE_LIMIT | レート制限 | 429 |
| CONFLICT | 競合エラー | 409 |
| PAYLOAD_TOO_LARGE | ペイロードサイズ超過 | 413 |

## レート制限

- 通常エンドポイント: 100リクエスト/分
- バッチエンドポイント: 20リクエスト/分
- 統計エンドポイント: 60リクエスト/分

## ベストプラクティス

1. **バッチ処理の活用**
   - 複数の変更がある場合は`/api/sync/batch`を使用
   - 最大100エンティティ/リクエストを推奨

2. **エラーハンドリング**
   - 指数バックオフでリトライ
   - エラータイプに応じた適切な処理

3. **圧縮の使用**
   - 大きなペイロードはgzip圧縮を使用
   - `compression`パラメータで指定

4. **監視**
   - 定期的に`/api/sync/health`をチェック
   - 統計情報でパフォーマンスを追跡