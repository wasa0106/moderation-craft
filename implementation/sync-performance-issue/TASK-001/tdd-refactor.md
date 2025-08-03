# TASK-001: リファクタリング（REFACTOR Phase）

## 概要
GREEN フェーズでテストが通る最小実装を完了しました。次はコードの品質を向上させるためのリファクタリングを行います。

## リファクタリング対象

### 1. 重複コードの削除
現在の実装では、bulkCreate、bulkUpdate、bulkDelete の各メソッドで同じような同期処理が繰り返されています。

### 2. エラーハンドリングの改善
エラーログの一貫性を保つため、エラーメッセージのフォーマットを統一します。

### 3. パフォーマンスの最適化
bulk操作で大量のデータを扱う場合のパフォーマンスを考慮した実装に改善します。

## 実装内容

### 1. 共通の同期処理メソッドの作成

```typescript
private async addEntitiesToSyncQueue(
  entities: T[],
  operationType: 'create' | 'update' | 'delete'
): Promise<void> {
  if (this.entityType === 'sync_queue') {
    return
  }

  const { SyncService } = await import('@/lib/sync/sync-service')
  const syncService = SyncService.getInstance()

  // バッチ処理でパフォーマンスを向上
  const batchSize = 100
  for (let i = 0; i < entities.length; i += batchSize) {
    const batch = entities.slice(i, i + batchSize)
    
    await Promise.all(
      batch.map(async (entity) => {
        try {
          await syncService.addToSyncQueue(
            this.entityType,
            entity.id,
            operationType,
            entity
          )
        } catch (error) {
          console.error(
            `Failed to add ${this.entityType} ${entity.id} to sync queue (${operationType}):`,
            error
          )
        }
      })
    )
  }
}
```

### 2. bulkCreateメソッドのリファクタリング

```typescript
async bulkCreate(items: Array<Omit<T, 'id' | 'created_at' | 'updated_at'>>): Promise<T[]> {
  if (items.length === 0) {
    return []
  }

  const entities = items.map(item => ({
    ...item,
    id: db.generateId(),
    ...db.createTimestamps(),
  } as T))

  try {
    await this.table.bulkAdd(entities)
    await this.addEntitiesToSyncQueue(entities, 'create')
    return entities
  } catch (error) {
    throw new Error(`Failed to bulk create ${this.entityType}: ${error}`)
  }
}
```

### 3. bulkUpdateメソッドのリファクタリング

```typescript
async bulkUpdate(
  updates: Array<{ id: string; data: Partial<Omit<T, 'id' | 'created_at'>> }>
): Promise<T[]> {
  if (updates.length === 0) {
    return []
  }

  const timestamp = db.getCurrentTimestamp()
  const updatedEntities: T[] = []

  try {
    await db.transaction('rw', this.table, async () => {
      for (const update of updates) {
        const updateData = {
          ...update.data,
          updated_at: timestamp,
        }

        await this.table.update(update.id, updateData as any)

        const entity = await this.table.get(update.id)
        if (entity) {
          updatedEntities.push(entity)
        }
      }
    })

    await this.addEntitiesToSyncQueue(updatedEntities, 'update')
    return updatedEntities
  } catch (error) {
    throw new Error(`Failed to bulk update ${this.entityType}: ${error}`)
  }
}
```

### 4. bulkDeleteメソッドのリファクタリング

```typescript
async bulkDelete(ids: string[]): Promise<void> {
  if (ids.length === 0) {
    return
  }

  try {
    const entities = await this.table.where('id').anyOf(ids).toArray()
    
    if (entities.length === 0) {
      return
    }

    await this.table.where('id').anyOf(ids).delete()
    await this.addEntitiesToSyncQueue(entities, 'delete')
  } catch (error) {
    throw new Error(`Failed to bulk delete ${this.entityType}: ${error}`)
  }
}
```

## リファクタリングの利点

1. **コードの重複削減**: 同期処理ロジックを一箇所に集約
2. **保守性の向上**: 同期処理の変更が必要な場合、一箇所の修正で対応可能
3. **パフォーマンスの向上**: バッチ処理により大量データの処理効率が向上
4. **エラーハンドリングの一貫性**: エラーメッセージフォーマットの統一
5. **早期リターン**: 空配列の場合の処理を最適化

## テストの確認
リファクタリング後も全てのテストが通ることを確認します。

```bash
npm test -- src/lib/db/repositories/__tests__/base-repository-bulk-sync.test.ts
```

## 次のステップ
Step 6: 品質確認
- TypeScript型チェック
- ESLintチェック
- 既存のテストスイートの実行
- パフォーマンステストの確認