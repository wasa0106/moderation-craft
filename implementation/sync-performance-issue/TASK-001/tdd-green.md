# TASK-001: 最小実装（GREEN Phase）

## 実装内容

BaseRepositoryのbulk操作メソッドを修正して、新しいSyncServiceを使用するようにします。これにより、REDフェーズで失敗したテストを通るようにします。

## 修正対象

`/src/lib/db/repositories/base-repository.ts`

### 修正内容

1. **bulkCreateメソッド**
   - 古い同期キュー形式の削除
   - SyncService.addToSyncQueue()の使用

2. **bulkUpdateメソッド**
   - 古い同期キュー形式の削除
   - SyncService.addToSyncQueue()の使用

3. **bulkDeleteメソッド**
   - 古い同期キュー形式の削除
   - SyncService.addToSyncQueue()の使用

## 実装の詳細

### 1. 古い同期処理の削除

現在の実装では、以下のような古い形式の同期キューエントリーを作成しています：

```typescript
const syncOperations = entities.map(entity => ({
  operation_id: db.generateId(),
  operation_type: 'CREATE' as const,
  entity_type: this.entityType,
  entity_id: entity.id,
  payload: entity,
  timestamp: entity.created_at,
  retry_count: 0,
  max_retries: 3,
  status: 'pending' as const,
}))

await db.sync_queue.bulkAdd(syncOperations as any)
```

### 2. 新しい同期処理の実装

新しい実装では、SyncServiceを使用します：

```typescript
if (this.entityType !== 'sync_queue') {
  const { SyncService } = await import('@/lib/sync/sync-service')
  const syncService = SyncService.getInstance()
  
  for (const entity of entities) {
    try {
      await syncService.addToSyncQueue(
        this.entityType,
        entity.id,
        'create', // または 'update', 'delete'
        entity
      )
    } catch (error) {
      console.error(`Failed to add entity ${entity.id} to sync queue:`, error)
      // エラーをログに記録するが、bulk操作は継続
    }
  }
}
```

## テストが通ることの確認

実装後、以下のテストが通るようになります：

1. ✅ SyncService.getInstance()が呼ばれる
2. ✅ mockAddToSyncQueue()が正しい回数呼ばれる
3. ✅ sync_queue.bulkAdd()が呼ばれない
4. ✅ エラーが発生してもbulk操作は成功する

## 実装時の注意点

- 既存のAPIインターフェースは変更しない
- エラーハンドリングを適切に行う
- sync_queueエンティティタイプの場合は同期をスキップ