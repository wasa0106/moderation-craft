# /sync-check - 同期処理チェック

IndexedDBとDynamoDBの同期処理の実装状況をチェックします。

## チェック項目
1. 楽観的更新の実装
2. エラーハンドリング
3. 競合解決ロジック
4. オフライン時の挙動
5. 同期ステータスの表示

## 使用例
```
/sync-check src/hooks/use-projects.ts
```