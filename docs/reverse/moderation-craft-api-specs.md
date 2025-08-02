# ModerationCraft API仕様書（逆生成）

## ベースURL
`/api`（Next.js App Router APIルート）

## 認証方式
**APIキー認証**
- ヘッダー名: `X-API-Key`
- 形式: 任意の文字列（現在の実装では "test-api-key"）
- 認証失敗時: 401 Unauthorized

## エンドポイント一覧

### ヘルスチェック

#### GET /api/health
**説明**: APIサーバーの稼働状況確認

**認証**: 不要

**レスポンス**:
```typescript
{
  status: "ok",
  timestamp: string // ISO 8601形式
}
```

**例**:
```json
{
  "status": "ok",
  "timestamp": "2025-08-02T10:30:00.000Z"
}
```

### 同期関連

#### POST /api/sync
**説明**: エンティティの作成・更新・削除

**認証**: 必須（X-API-Key）

**リクエストボディ**:
```typescript
interface SyncRequest {
  entity_type: 'project' | 'big_task' | 'small_task' | 'work_session' | 
               'mood_entry' | 'dopamine_entry' | 'daily_condition' | 
               'schedule_memo' | 'sleep_schedule';
  operation?: 'CREATE' | 'UPDATE' | 'DELETE'; // デフォルト: 'CREATE'
  payload: any; // エンティティタイプに応じたデータ
}
```

**レスポンス**:
```typescript
{
  success: boolean;
  message?: string;
  syncedItem?: any;
  syncedEntityId?: string;
  syncedEntityType?: string;
  error?: string;
}
```

**エラーレスポンス**:
```typescript
{
  success: false;
  error: string;
}
```

**例（プロジェクト作成）**:
```json
// リクエスト
{
  "entity_type": "project",
  "operation": "CREATE",
  "payload": {
    "id": "proj_123",
    "user_id": "user_456",
    "name": "新規プロジェクト",
    "goal": "アプリ開発",
    "deadline": "2025-12-31",
    "status": "active",
    "version": 1,
    "color": "hsl(137, 42%, 55%)"
  }
}

// レスポンス
{
  "success": true,
  "message": "Project synced successfully",
  "syncedEntityId": "proj_123",
  "syncedEntityType": "project"
}
```

#### GET /api/sync/pull
**説明**: ユーザーの全データを取得（プル同期）

**認証**: 必須（X-API-Key）

**クエリパラメータ**:
- `userId`: ユーザーID（省略時: "current-user"）
- `lastSyncTime`: 最終同期時刻（ISO 8601形式、省略可）

**レスポンス**:
```typescript
{
  success: boolean;
  data: {
    projects: Project[];
    bigTasks: BigTask[];
    smallTasks: SmallTask[];
    moodEntries: MoodEntry[];
    dopamineEntries: DopamineEntry[];
    workSessions: WorkSession[];
  };
  lastSyncTime: string;
}
```

**例**:
```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": "proj_123",
        "user_id": "user_456",
        "name": "プロジェクトA",
        "status": "active"
      }
    ],
    "bigTasks": [],
    "smallTasks": [],
    "moodEntries": [],
    "dopamineEntries": [],
    "workSessions": []
  },
  "lastSyncTime": "2025-08-02T10:30:00.000Z"
}
```

#### GET /api/sync/check
**説明**: 同期ステータスの確認

**認証**: 必須（X-API-Key）

**クエリパラメータ**:
- `userId`: ユーザーID

**レスポンス**:
```typescript
{
  success: boolean;
  pendingOperations: number;
  lastSyncTime?: string;
  syncStatus: 'idle' | 'syncing' | 'error';
}
```

### テスト用エンドポイント

#### GET /api/test-dynamodb
**説明**: DynamoDB接続テスト（開発環境用）

**認証**: 不要

**レスポンス**:
```typescript
{
  success: boolean;
  message: string;
  data?: {
    tables: string[];
    testWrite?: any;
    testRead?: any;
  };
  error?: string;
}
```

## エラーコード体系

### HTTPステータスコード

| コード | 意味 | 使用場面 |
|--------|------|----------|
| 200 | OK | 正常処理完了 |
| 400 | Bad Request | バリデーションエラー、必須パラメータ不足 |
| 401 | Unauthorized | APIキー未提供または無効 |
| 403 | Forbidden | APIキーは有効だがアクセス権限なし |
| 500 | Internal Server Error | サーバー内部エラー |

### アプリケーションエラーコード

現在の実装では構造化されたエラーコードは使用されていませんが、以下のようなエラーメッセージが返されます：

- `"Invalid or missing API key"` - APIキー認証失敗
- `"entity_type and payload are required"` - 必須パラメータ不足
- `"Unknown entity type: {type}"` - 不明なエンティティタイプ
- 各種DynamoDBエラーメッセージ

## レスポンス共通形式

### 成功レスポンス
```typescript
{
  success: true,
  data?: T; // エンドポイントに応じた型
  message?: string; // 追加情報
}
```

### エラーレスポンス
```typescript
{
  success: false,
  error: string; // エラーメッセージ
  details?: any; // 詳細情報（開発環境のみ）
}
```

## データ型定義

### エンティティ共通フィールド
```typescript
interface DatabaseEntity {
  id: string;
  created_at: string; // ISO 8601形式
  updated_at: string; // ISO 8601形式
}
```

### 主要エンティティ
- `Project`: プロジェクト情報
- `BigTask`: 大タスク（WBSレベル2）
- `SmallTask`: 小タスク（実行可能タスク）
- `WorkSession`: 作業セッション記録
- `MoodEntry`: 気分記録
- `DopamineEntry`: ドーパミン記録
- `ScheduleMemo`: 週次メモ
- `SleepSchedule`: 睡眠スケジュール

## 使用上の注意

1. **楽観的更新**: クライアント側でIndexedDBを先に更新し、その後API経由で同期
2. **冪等性**: CREATE/UPDATE操作は冪等（同じリクエストを複数回実行しても結果が同じ）
3. **バージョニング**: 各エンティティにversion フィールドがあり、競合解決に使用
4. **タイムアウト**: 現在の実装では明示的なタイムアウト設定なし（Next.jsのデフォルト）