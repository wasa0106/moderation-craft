# 同期問題デバッグガイド

## デバッグモードの有効化

本番環境で同期問題を診断するために、環境変数を設定してデバッグログを有効にできます。

### 1. 環境変数の設定

`.env.local`または`.env.production`に以下を追加：

```bash
NEXT_PUBLIC_DEBUG_SYNC=true
```

### 2. ログの確認ポイント

#### A. ID変更の検出

プル同期時にIDが変更されているかを確認：

```
🔍 Creating new project from cloud: {
  cloudId: "abc123",
  cloudUpdatedAt: "2024-01-20T10:00:00Z",
  cloudName: "Project A"
}
✅ Created project with ID: {
  originalId: "abc123",
  newId: "xyz789",
  idChanged: true,  // ← これがtrueなら問題発生
  name: "Project A"
}
```

#### B. 同期キューへの追加元

どこから同期キューに追加されているかを確認：

```
📤 Adding to sync queue (create): {
  entityType: "project",
  entityId: "xyz789",
  operation: "create",
  caller: "at PullSyncService.mergeData", // ← 呼び出し元
  entityName: "Project A"
}
```

#### C. 同期キューの状態

30秒ごとの同期処理開始時：

```
🔄 Starting sync process { timestamp: "2024-01-20T10:00:30Z" }
📊 Sync queue status: {
  pendingCount: 5,
  items: [
    {
      id: "queue-item-1",
      entityType: "project",
      entityId: "xyz789",
      operation: "CREATE",
      attemptCount: 0,
      createdAt: "2024-01-20T10:00:00Z"
    },
    // ...
  ]
}
```

#### D. 5分ごとの統計情報

```
📈 Sync Statistics (5min interval): {
  pendingItems: 10,
  failedItems: 2,
  totalQueueSize: 12,
  isOnline: true,
  isSyncing: false,
  lastSyncTime: "2024-01-20T10:00:00Z",
  autoSyncEnabled: true,
  queueByEntityType: {
    project: 3,
    big_task: 4,
    small_task: 3,
    work_session: 0
  },
  queueByStatus: {
    pending: 10,
    processing: 0,
    failed: 2
  }
}
```

## 問題の診断

### 1. IDが変わっている場合

`idChanged: true`が表示される場合、BaseRepositoryのcreateメソッドが新しいIDを生成しています。これが無限ループの原因です。

### 2. 保留アイテムが増え続ける場合

- `queueByEntityType`で特定のエンティティタイプが異常に多い
- `caller`が`PullSyncService.mergeData`の場合、プル同期が原因

### 3. 同期間隔の確認

- プッシュ同期: 30秒ごと（`🔄 Starting sync process`）
- プル同期: 5分ごと（pull-sync-service.tsのログ）

## デバッグ完了後

問題の原因が特定できたら、環境変数を削除またはfalseに設定してデバッグログを無効化してください：

```bash
NEXT_PUBLIC_DEBUG_SYNC=false
```

## トラブルシューティング

### ログが表示されない場合

1. ブラウザの開発者ツールのコンソールを確認
2. Next.jsの再起動が必要な場合があります
3. 本番ビルドの場合は`npm run build`後に`npm start`

### ログが多すぎる場合

特定のログのみを確認したい場合は、ブラウザのコンソールでフィルタリング：

```javascript
// 例: IDの変更のみを確認
console.log.toString().includes('idChanged')
```