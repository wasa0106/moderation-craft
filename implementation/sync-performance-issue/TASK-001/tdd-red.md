# TASK-001: テスト実装（RED Phase）

## 実装内容

BaseRepositoryのbulk操作メソッドに対するテストコードを実装しました。このテストは現在の実装に対して失敗することを確認します。

## 作成したテストファイル

`/src/lib/db/repositories/__tests__/base-repository-bulk-sync.test.ts`

## テストの概要

### 1. テスト構造

- **テスト対象**: BaseRepositoryのbulkCreate、bulkUpdate、bulkDeleteメソッド
- **モック対象**: SyncService、IndexedDB、sync_queue.bulkAdd
- **テスト用Repository**: TestRepositoryクラスを作成してテスト

### 2. 主要なテストケース

#### bulkCreateのテスト
- ✅ 新しいSyncServiceを使用して各エンティティを同期キューに追加する
- ✅ 古いsync_queue.bulkAdd()を呼び出さない
- ✅ 同期キューへの追加が失敗してもbulk操作は成功する
- ✅ 空の配列の場合、同期処理をスキップする
- ✅ entityTypeがsync_queueの場合、同期処理をスキップする

#### bulkUpdateのテスト
- ✅ 新しいSyncServiceを使用して更新されたエンティティを同期キューに追加する
- ✅ 古いsync_queue.bulkAdd()を呼び出さない

#### bulkDeleteのテスト
- ✅ 新しいSyncServiceを使用して削除されたエンティティを同期キューに追加する
- ✅ 古いsync_queue.bulkAdd()を呼び出さない
- ✅ 削除前のエンティティデータを同期キューに含める

#### パフォーマンステスト
- ✅ 1000件のbulk操作でも5秒以内に処理される

## テスト実行結果（想定）

現在の実装では以下のような失敗が発生するはずです：

```bash
FAIL src/lib/db/repositories/__tests__/base-repository-bulk-sync.test.ts
  BaseRepository - Bulk操作の同期処理
    bulkCreate
      ✕ 新しいSyncServiceを使用して各エンティティを同期キューに追加する
      ✕ 古いsync_queue.bulkAdd()を呼び出さない
    bulkUpdate
      ✕ 新しいSyncServiceを使用して更新されたエンティティを同期キューに追加する
      ✕ 古いsync_queue.bulkAdd()を呼び出さない
    bulkDelete
      ✕ 新しいSyncServiceを使用して削除されたエンティティを同期キューに追加する
      ✕ 古いsync_queue.bulkAdd()を呼び出さない
```

### 失敗の理由

1. **SyncService.addToSyncQueue()が呼ばれない**
   - 現在の実装は古い形式を使用しているため
   - 期待: 3回呼ばれる、実際: 0回

2. **sync_queue.bulkAdd()が呼ばれる**
   - 現在の実装は直接sync_queueテーブルに追加している
   - 期待: 呼ばれない、実際: 1回呼ばれる

## 次のステップ

Step 4（GREEN Phase）で、これらのテストを通すための最小限の実装を行います。具体的には：

1. 古いsync_queue.bulkAdd()の呼び出しを削除
2. SyncService.addToSyncQueue()を使用するように変更
3. エラーハンドリングの追加

## テストコードのポイント

### モックの設定
```typescript
mockAddToSyncQueue = jest.fn().mockResolvedValue(undefined)
mockSyncService = {
  addToSyncQueue: mockAddToSyncQueue,
} as any
```

### アサーション例
```typescript
// 正しいパラメータで呼ばれることを確認
expect(mockAddToSyncQueue).toHaveBeenNthCalledWith(
  index + 1,
  'test_entity',
  expect.stringMatching(/^id-/),
  'create',
  expect.objectContaining({
    name: items[index].name,
    status: items[index].status,
  })
)
```

このテストにより、現在の実装の問題が明確になり、修正すべき箇所が特定されました。