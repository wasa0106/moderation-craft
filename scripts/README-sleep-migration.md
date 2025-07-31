# 睡眠スケジュールデータ移行ガイド

## 概要
このスクリプトは、睡眠スケジュールデータを旧形式からFitbit API互換の新形式に移行します。

### 変更内容
- **旧形式**: 基準日（`date`）と時・分・翌日フラグで管理
- **新形式**: 起床日（`date_of_sleep`）とISO 8601形式の時刻で管理

## 移行手順

### 1. 開発サーバーの起動
```bash
npm run dev
```

### 2. ブラウザでアプリケーションを開く
```
http://localhost:3000
```

### 3. ブラウザの開発者ツールを開く
- Chrome/Edge: F12 または 右クリック → 「検証」
- Firefox: F12 または 右クリック → 「要素を調査」
- Safari: Command + Option + I

### 4. コンソールタブで移行スクリプトを実行
```javascript
// スクリプトを読み込む
const script = document.createElement('script');
script.src = '/scripts/migrate-sleep-schedules.js';
document.head.appendChild(script);

// 少し待ってから実行（スクリプトの読み込み待ち）
setTimeout(() => {
  migrateSleepSchedules();
}, 1000);
```

### 5. 移行結果の確認
コンソールに以下のような出力が表示されます：
```
睡眠スケジュールデータの移行を開始します...
3件のデータを移行します
バックアップをlocalStorageに保存しました
✓ ID: xxx を移行しました (2024-07-30 → 2024-07-31)
✓ ID: yyy を移行しました (2024-07-31 → 2024-08-01)
✓ ID: zzz を移行しました (2024-08-01 → 2024-08-02)

移行完了:
  成功: 3件
  失敗: 0件
  スキップ: 0件

✅ すべてのデータが正常に移行されました！
```

## バックアップの復元（必要な場合）

移行に失敗した場合、localStorageに保存されたバックアップから復元できます：

```javascript
// バックアップデータの確認
const backup = JSON.parse(localStorage.getItem('sleep_schedules_backup'));
console.log('バックアップデータ:', backup);

// 復元が必要な場合は、手動でデータベースに戻す必要があります
// ※この操作は慎重に行ってください
```

## 注意事項

1. **移行前にバックアップ**: 重要なデータがある場合は、事前に手動でバックアップを取ることを推奨します
2. **一度だけ実行**: 移行スクリプトは一度だけ実行してください。重複実行しても既に移行済みのデータはスキップされます
3. **エラーの確認**: エラーが発生した場合は、コンソールに詳細が表示されます

## トラブルシューティング

### スクリプトが見つからない場合
TypeScriptファイルをJavaScriptにコンパイルする必要があります：
```bash
npx tsc scripts/migrate-sleep-schedules.ts --outDir public/scripts
```

### 移行後の動作確認
1. スケジュールページ（/schedule）で睡眠予定が正しく表示されることを確認
2. 新しい睡眠予定を作成できることを確認
3. 既存の睡眠予定を編集できることを確認

## データ形式の例

### 旧形式
```json
{
  "id": "123",
  "user_id": "user1",
  "date": "2024-07-30",
  "bedtime_hour": 23,
  "bedtime_minute": 30,
  "bedtime_is_next_day": false,
  "wake_time_hour": 7,
  "wake_time_minute": 0,
  "wake_time_is_next_day": true
}
```

### 新形式（移行後）
```json
{
  "id": "123",
  "user_id": "user1",
  "date_of_sleep": "2024-07-31",
  "scheduled_start_time": "2024-07-30T23:30:00.000Z",
  "scheduled_end_time": "2024-07-31T07:00:00.000Z",
  "scheduled_duration_minutes": 450
}
```