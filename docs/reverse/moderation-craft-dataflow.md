# ModerationCraft データフロー図（逆生成）

## ユーザーインタラクションフロー

### タイマー開始フロー
```mermaid
sequenceDiagram
    participant U as ユーザー
    participant UI as UIコンポーネント
    participant TS as TimerStore
    participant DB as IndexedDB
    participant SQ as SyncQueue
    participant API as Sync API
    participant DDB as DynamoDB
    
    U->>UI: タイマー開始ボタンクリック
    UI->>TS: startTimer(task)
    TS->>DB: createWorkSession()
    DB-->>TS: セッションID
    TS-->>UI: 状態更新（isRunning: true）
    UI-->>U: タイマー表示開始
    
    Note over DB,SQ: バックグラウンド処理
    DB->>SQ: 同期キューに追加
    SQ->>API: POST /api/sync
    API->>DDB: PutCommand
    DDB-->>API: 成功
    API-->>SQ: 同期完了
```

### プロジェクト作成フロー
```mermaid
flowchart TD
    A[プロジェクト作成画面] --> B[ProjectForm入力]
    B --> C[useProjectsフック]
    C --> D[projectRepository.create]
    D --> E[IndexedDB保存]
    E --> F[楽観的UI更新]
    E --> G[同期キュー追加]
    G --> H{オンライン?}
    H -->|Yes| I[即座に同期]
    H -->|No| J[キューで待機]
    I --> K[DynamoDB保存]
    J --> L[オンライン復帰時]
    L --> K
```

## データ同期フロー

### オフライン→オンライン同期
```mermaid
sequenceDiagram
    participant OD as OfflineDetector
    participant SS as SyncService
    participant SQ as SyncQueue
    participant SR as SyncRepository
    participant API as Sync API
    participant DDB as DynamoDB
    
    OD->>SS: オンライン検知
    SS->>SQ: getPendingItems()
    SQ-->>SS: 未同期アイテムリスト
    
    loop 各アイテム
        SS->>API: POST /api/sync
        API->>DDB: エンティティ保存
        DDB-->>API: 成功/失敗
        API-->>SS: レスポンス
        
        alt 成功
            SS->>SR: markAsCompleted(id)
        else 失敗
            SS->>SR: incrementRetryCount(id)
            Note over SS: リトライ戦略適用
        end
    end
```

### 競合解決フロー
```mermaid
flowchart TD
    A[同期実行] --> B{バージョン競合?}
    B -->|No| C[そのまま保存]
    B -->|Yes| D[ConflictResolver]
    D --> E{解決戦略}
    E -->|最終更新優先| F[タイムスタンプ比較]
    E -->|マージ| G[フィールドマージ]
    F --> H[新しい方を採用]
    G --> I[非競合フィールド結合]
    H --> J[DynamoDB更新]
    I --> J
```

## 状態管理フロー

### Zustand + React Query連携
```mermaid
flowchart LR
    A[UIコンポーネント] --> B[useProjects]
    B --> C[React Query]
    C --> D[キャッシュチェック]
    D -->|キャッシュあり| E[即座に返却]
    D -->|キャッシュなし| F[IndexedDB読込]
    F --> G[キャッシュ更新]
    G --> E
    
    A --> H[useProjectStore]
    H --> I[Zustand Store]
    I --> J[選択状態管理]
    
    E --> K[データ表示]
    J --> K
```

### リアルタイム更新フロー
```mermaid
sequenceDiagram
    participant C1 as コンポーネント1
    participant C2 as コンポーネント2
    participant RQ as React Query
    participant DB as IndexedDB
    participant Z as Zustand
    
    C1->>RQ: mutate(updateTask)
    RQ->>DB: タスク更新
    RQ->>RQ: キャッシュ無効化
    RQ-->>C1: 楽観的更新
    RQ-->>C2: 自動再フェッチ
    
    Note over C1,C2: UIが自動的に同期
```

## エラーハンドリングフロー

```mermaid
flowchart TD
    A[API呼び出し] --> B{エラー発生?}
    B -->|No| C[正常処理]
    B -->|Yes| D{エラー種別}
    
    D -->|認証エラー| E[401/403]
    E --> F[APIキー確認画面]
    
    D -->|ネットワークエラー| G[接続エラー]
    G --> H[オフラインモード]
    H --> I[ローカル処理継続]
    
    D -->|バリデーションエラー| J[400エラー]
    J --> K[エラーメッセージ表示]
    
    D -->|サーバーエラー| L[500エラー]
    L --> M[リトライ処理]
    M --> N{リトライ上限?}
    N -->|No| A
    N -->|Yes| O[エラー通知]
```

## タスクスケジューリングフロー

```mermaid
flowchart TD
    A[週次カレンダー] --> B[タスクドラッグ開始]
    B --> C[ドロップゾーン検知]
    C --> D[時間枠計算]
    D --> E[タスク更新]
    E --> F[IndexedDB保存]
    F --> G[カレンダー再描画]
    F --> H[同期キュー追加]
    
    I[WBS参照パネル] --> J[未スケジュールタスク]
    J --> B
```

## セッション管理フロー

```mermaid
stateDiagram-v2
    [*] --> アイドル
    アイドル --> タイマー実行中: 開始
    タイマー実行中 --> 一時停止: 停止
    タイマー実行中 --> セッション完了: 終了
    一時停止 --> タイマー実行中: 再開
    一時停止 --> セッション完了: 終了
    セッション完了 --> アイドル: リセット
    
    タイマー実行中 --> 気分記録: 気分ボタン
    気分記録 --> タイマー実行中: 記録完了
    
    タイマー実行中 --> ドーパミン記録: ドーパミンボタン
    ドーパミン記録 --> タイマー実行中: 記録完了
```