# TASK-001: BaseRepositoryのbulk操作メソッド修正 - 要件定義

## 概要

BaseRepositoryクラスのbulkCreate、bulkUpdate、bulkDeleteメソッドが古い同期キュー形式を使用しているため、不要な同期処理が発生している問題を修正する。

## 問題の詳細

### 現在の実装の問題点

1. **古い同期キュー形式の使用**
   - `db.sync_queue.bulkAdd()`を直接呼び出している
   - 古い形式のフィールド（operation_id、payload等）を使用
   - 新しいSyncServiceと整合性がない

2. **過剰な同期エントリーの作成**
   - bulk操作でエンティティごとに個別の同期エントリーを作成
   - 集約処理が行われていない
   - 同期処理の効率が悪い

3. **重複チェックの欠如**
   - 同じエンティティに対する重複エントリーが作成される可能性
   - 不要なDynamoDBへの書き込みが発生

## 要件

### 機能要件

#### REQ-002: bulk操作時の新しい同期サービス使用
- システムは bulk操作（bulkCreate、bulkUpdate、bulkDelete）時に新しい同期サービスを使用しなければならない
- 具体的には、`SyncService.addToSyncQueue()`メソッドを使用する
- 古い`db.sync_queue.bulkAdd()`の直接呼び出しは削除する

#### REQ-104: bulk操作の集約
- bulk操作が実行された場合、システムは個別の同期エントリーではなく集約されたエントリーを作成しなければならない
- 可能な限り効率的に同期キューを管理する

### 非機能要件

- **後方互換性**: 既存のAPIインターフェースは変更しない
- **パフォーマンス**: bulk操作のパフォーマンスを維持または向上させる
- **エラーハンドリング**: 同期キューへの追加に失敗してもbulk操作自体は成功する

## 受け入れ基準

### bulkCreateメソッド

1. [ ] 新しいSyncService.addToSyncQueue()を使用している
2. [ ] 古い形式のsync_queue.bulkAdd()が削除されている
3. [ ] 各エンティティが正しく同期キューに追加される
4. [ ] エラーが発生してもbulk操作は継続される

### bulkUpdateメソッド

1. [ ] 新しいSyncService.addToSyncQueue()を使用している
2. [ ] 古い形式のsync_queue.bulkAdd()が削除されている
3. [ ] 更新されたエンティティが正しく同期キューに追加される
4. [ ] エラーが発生してもbulk操作は継続される

### bulkDeleteメソッド

1. [ ] 新しいSyncService.addToSyncQueue()を使用している
2. [ ] 古い形式のsync_queue.bulkAdd()が削除されている
3. [ ] 削除されたエンティティの情報が同期キューに追加される
4. [ ] エラーが発生してもbulk操作は継続される

### 共通要件

1. [ ] 同期キューへの追加がバックグラウンドで実行される
2. [ ] 同期サービスの初期化エラーがハンドリングされる
3. [ ] 既存のテストが全て通る
4. [ ] 新しいテストが追加される

## 実装詳細

### 修正対象ファイル

- `/src/lib/db/repositories/base-repository.ts`

### 修正対象メソッド

1. `bulkCreate()` - 行番号: 196-236
2. `bulkUpdate()` - 行番号: 237-285
3. `bulkDelete()` - 行番号: 286-315

### 削除すべきコード

```typescript
// 古い形式の同期操作
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

### 追加すべきコード

```typescript
// 新しい同期サービスの使用
if (this.entityType !== 'sync_queue') {
  const { SyncService } = await import('@/lib/sync/sync-service')
  const syncService = SyncService.getInstance()
  
  // 各エンティティを同期キューに追加
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

## テスト戦略

### 単体テスト

1. **正常系テスト**
   - bulk操作で複数のエンティティが作成/更新/削除される
   - 各エンティティが同期キューに追加される
   - 正しい操作タイプで同期エントリーが作成される

2. **異常系テスト**
   - 同期サービスの初期化に失敗した場合
   - 同期キューへの追加に失敗した場合
   - 一部のエンティティの同期に失敗した場合

3. **境界値テスト**
   - 空の配列でbulk操作を実行
   - 大量のエンティティ（1000件以上）でbulk操作
   - sync_queueエンティティタイプの場合（同期をスキップ）

### 統合テスト

1. **エンドツーエンドテスト**
   - bulk操作後に同期処理が実行される
   - DynamoDBに正しくデータが同期される
   - 同期エラーが適切にハンドリングされる

## リスクと対策

### リスク

1. **パフォーマンスの低下**
   - forループで個別に同期キューに追加するため、大量データで遅くなる可能性

2. **メモリ使用量の増加**
   - 各エンティティを個別に処理するため、メモリ使用量が増える可能性

### 対策

1. **バッチ処理の実装**（将来的な改善）
   - 一定数ごとにバッチ処理を行う
   - Promise.allSettled()を使用して並列処理

2. **非同期処理の最適化**
   - 同期キューへの追加を非同期で実行
   - エラーハンドリングを適切に行う

## 成功の定義

1. 不要な同期処理が発生しなくなる
2. DynamoDBへの書き込み頻度が大幅に減少する
3. システムパフォーマンスが向上する
4. 既存の機能に影響を与えない