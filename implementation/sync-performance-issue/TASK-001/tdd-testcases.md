# TASK-001: BaseRepositoryのbulk操作メソッド修正 - テストケース

## テストケース概要

BaseRepositoryのbulk操作メソッドが新しいSyncServiceを使用し、古い同期キュー形式を使用しないことを確認するテストケースを定義する。

## テスト対象

- `BaseRepository.bulkCreate()`
- `BaseRepository.bulkUpdate()`  
- `BaseRepository.bulkDelete()`

## テストケース詳細

### 1. bulkCreateメソッドのテスト

#### TC-001-1: 正常系 - 複数エンティティの作成と同期キュー追加

**前提条件:**
- BaseRepositoryのサブクラス（例：ProjectRepository）を使用
- SyncServiceがモック化されている

**入力:**
```typescript
const items = [
  { name: 'Project 1', status: 'active' },
  { name: 'Project 2', status: 'active' },
  { name: 'Project 3', status: 'active' }
]
```

**期待される動作:**
1. 3つのエンティティがIndexedDBに作成される
2. SyncService.addToSyncQueue()が3回呼び出される
3. 各呼び出しで正しいパラメータが渡される：
   - entityType: 'project'
   - entityId: 生成されたID
   - operation: 'create'
   - data: エンティティ全体
4. db.sync_queue.bulkAdd()は呼び出されない

#### TC-001-2: 異常系 - 同期キュー追加失敗時の処理

**前提条件:**
- SyncService.addToSyncQueue()が2番目の呼び出しでエラーをスローする

**入力:**
```typescript
const items = [
  { name: 'Project 1', status: 'active' },
  { name: 'Project 2', status: 'active' }, // これの同期が失敗
  { name: 'Project 3', status: 'active' }
]
```

**期待される動作:**
1. 3つのエンティティ全てがIndexedDBに作成される
2. エラーがconsole.errorでログ出力される
3. 1番目と3番目のエンティティは正常に同期キューに追加される
4. bulkCreate自体は成功し、作成されたエンティティを返す

#### TC-001-3: 境界値 - 空配列でのbulkCreate

**入力:**
```typescript
const items = []
```

**期待される動作:**
1. 空の配列が返される
2. SyncService.addToSyncQueue()は呼び出されない
3. エラーは発生しない

#### TC-001-4: 特殊ケース - sync_queueエンティティの場合

**前提条件:**
- entityTypeが'sync_queue'のRepositoryを使用

**期待される動作:**
1. エンティティはIndexedDBに作成される
2. SyncService.addToSyncQueue()は呼び出されない
3. 同期処理がスキップされる

### 2. bulkUpdateメソッドのテスト

#### TC-002-1: 正常系 - 複数エンティティの更新と同期キュー追加

**前提条件:**
- 既存のエンティティが3つ存在する

**入力:**
```typescript
const updates = [
  { id: 'id1', data: { name: 'Updated Project 1' } },
  { id: 'id2', data: { name: 'Updated Project 2' } },
  { id: 'id3', data: { name: 'Updated Project 3' } }
]
```

**期待される動作:**
1. 3つのエンティティがIndexedDBで更新される
2. SyncService.addToSyncQueue()が3回呼び出される
3. 各呼び出しで操作タイプが'update'になっている
4. 更新されたエンティティデータが渡される

#### TC-002-2: 異常系 - 存在しないエンティティの更新

**入力:**
```typescript
const updates = [
  { id: 'invalid-id', data: { name: 'Updated Project' } }
]
```

**期待される動作:**
1. 更新が失敗する（エンティティが見つからない）
2. SyncService.addToSyncQueue()は呼び出されない
3. 適切なエラーがスローされる

### 3. bulkDeleteメソッドのテスト

#### TC-003-1: 正常系 - 複数エンティティの削除と同期キュー追加

**前提条件:**
- 削除対象のエンティティが3つ存在する

**入力:**
```typescript
const ids = ['id1', 'id2', 'id3']
```

**期待される動作:**
1. 3つのエンティティがIndexedDBから削除される
2. SyncService.addToSyncQueue()が3回呼び出される
3. 各呼び出しで操作タイプが'delete'になっている
4. 削除前のエンティティデータが渡される

#### TC-003-2: 部分的失敗 - 一部のエンティティが存在しない

**入力:**
```typescript
const ids = ['id1', 'invalid-id', 'id3']
```

**期待される動作:**
1. 存在するエンティティ（id1, id3）は削除される
2. 存在しないエンティティはスキップされる
3. 削除されたエンティティのみ同期キューに追加される

### 4. 共通テスト

#### TC-004-1: パフォーマンステスト - 大量データのbulk操作

**入力:**
```typescript
const items = Array.from({ length: 1000 }, (_, i) => ({
  name: `Project ${i}`,
  status: 'active'
}))
```

**期待される動作:**
1. 1000件のエンティティが正常に処理される
2. 処理時間が妥当な範囲内（例：5秒以内）
3. メモリ使用量が急激に増加しない

#### TC-004-2: 統合テスト - 実際の同期処理との連携

**前提条件:**
- 実際のSyncServiceを使用（モックなし）
- オンライン状態

**期待される動作:**
1. bulk操作後、同期キューにエントリーが作成される
2. 自動同期が有効な場合、同期処理が開始される
3. 同期が成功すると、エントリーがcompletedになる

## モックとスタブ

### SyncServiceのモック

```typescript
const mockSyncService = {
  addToSyncQueue: jest.fn().mockResolvedValue(undefined),
  getInstance: jest.fn().mockReturnValue(this)
}

jest.mock('@/lib/sync/sync-service', () => ({
  SyncService: mockSyncService
}))
```

### IndexedDBのモック

```typescript
const mockDb = {
  generateId: jest.fn().mockReturnValue('generated-id'),
  createTimestamps: jest.fn().mockReturnValue({
    created_at: '2024-01-20T10:00:00Z',
    updated_at: '2024-01-20T10:00:00Z'
  }),
  sync_queue: {
    bulkAdd: jest.fn() // これが呼ばれないことを確認
  }
}
```

## テスト実行順序

1. 単体テスト（モックを使用）
   - bulkCreateの各テストケース
   - bulkUpdateの各テストケース
   - bulkDeleteの各テストケース
   
2. 統合テスト（実際のサービスを使用）
   - エンドツーエンドのシナリオテスト

## 成功基準

- 全てのテストケースが通る
- コードカバレッジが95%以上
- パフォーマンステストが基準時間内に完了
- 既存のテストに影響を与えない