# プロジェクト作成のトラブルシューティング

## デバッグ手順

### 1. データベーススキーマの確認
```javascript
// ブラウザコンソールで実行
await projectCreationDebug.checkDatabaseSchema()
```

このコマンドで以下を確認：
- データベースバージョン
- テーブル一覧
- big_tasksテーブルのスキーマ
- projectsテーブルのスキーマ

### 2. プロジェクト作成のテスト
```javascript
// 単体でプロジェクト作成をテスト
await projectCreationDebug.testProjectCreation()
```

成功すれば「✅ プロジェクト作成成功」と表示されます。

### 3. BigTask作成のテスト
```javascript
// 単体でBigTask作成をテスト
await projectCreationDebug.testBigTaskCreation()
```

成功すれば「✅ BigTask作成成功」と表示されます。

### 4. 実際のプロジェクト作成時のデバッグ

プロジェクト作成画面で「プロジェクトを作成」ボタンをクリックすると、コンソールに詳細なログが出力されます：

```
=== プロジェクト作成開始 ===
作成するプロジェクトデータ: {...}
作成されたプロジェクト: {...}
BigTask作成開始. 週配分数: 5
週1の日付: {startDate: ..., endDate: ...}
週1のBigTaskデータ: {...}
週1のBigTask作成成功: {...}
...
```

## よくあるエラーと解決方法

### 1. 「週Xの日付が無効です」エラー

**原因**: WeeklyAllocationの日付データが正しくDate型になっていない

**解決方法**:
```javascript
// 週配分データを検証
console.log('週配分:', weeklyAllocations)
weeklyAllocations.forEach(a => {
  console.log(`週${a.weekNumber}:`, {
    startDate: a.startDate,
    endDate: a.endDate,
    startType: typeof a.startDate,
    endType: typeof a.endDate
  })
})
```

### 2. IndexedDBエラー

**原因**: スキーマの不整合またはデータベースの破損

**解決方法**:
1. IndexedDBをクリア：
   - Chrome DevTools > Application > Storage > IndexedDB
   - ModerationCraftDBを右クリック > Delete
2. ページをリロード

### 3. BigTask作成時の型エラー

**原因**: week_start_dateやweek_end_dateの型が不正

**解決方法**:
```javascript
// 日付を正しくISO文字列に変換
const bigTaskData = {
  // ... 他のフィールド
  week_start_date: new Date(allocation.startDate).toISOString(),
  week_end_date: new Date(allocation.endDate).toISOString(),
}
```

### 4. 権限エラー

**原因**: user_idが不正または認証の問題

**解決方法**:
- user_idが正しく設定されているか確認
- 'current-user'が適切な値か確認

## 一時的な回避策

日付範囲の処理が原因の場合、一時的に無効化できます：

```javascript
// src/app/projects/new/page.tsx の BigTask作成部分
const bigTaskData = {
  project_id: newProject.id,
  user_id: 'current-user',
  name: `第${allocation.weekNumber}週のタスク`,
  category,
  week_number: allocation.weekNumber,
  // week_start_date: weekStart.toISOString(), // 一時的にコメントアウト
  // week_end_date: weekEnd.toISOString(),     // 一時的にコメントアウト
  estimated_hours: allocation.totalAllocatedHours,
  status: 'pending' as const,
}
```

## デバッグ情報の収集

エラーが発生した場合、以下の情報を収集してください：

1. **ブラウザコンソールのエラーメッセージ**（赤文字の部分）
2. **デバッグログの内容**（console.logの出力）
3. **ネットワークタブのエラー**（もしあれば）
4. **プロジェクト作成フォームの入力内容**

これらの情報があれば、より具体的な解決策を提示できます。