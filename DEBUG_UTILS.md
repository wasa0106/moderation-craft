# Debug Utilities for moderation-craft

## 概要
「不明なプロジェクト」問題を調査するためのデバッグユーティリティを実装しました。

## 使用方法

### 1. ブラウザコンソールを開く
- Chrome/Edge: F12 または Ctrl+Shift+I (Mac: Cmd+Option+I)
- Firefox: F12 または Ctrl+Shift+K (Mac: Cmd+Option+K)

### 2. 利用可能なコマンド

#### クイックデバッグ
```javascript
// BigTaskとProjectの関係を素早くチェック
quickDebug()
```

#### 詳細なデバッグ
```javascript
// BigTask-Project関係の詳細チェック
debugUtils.checkBigTaskProjectRelations()

// データベース全体の詳細情報
debugUtils.showDetailedDataInfo()

// プロジェクト作成プロセスの診断
debugUtils.diagnoseProjectCreation()

// 孤立したBigTaskを修復（プロジェクトIDを指定）
debugUtils.repairOrphanedBigTasks('target-project-id')
```

## 問題の診断手順

### ステップ1: データの状態を確認
```javascript
await quickDebug()
```
これにより以下が表示されます：
- 全プロジェクトのリスト
- 全BigTaskのリスト
- 孤立したBigTaskの数

### ステップ2: 詳細な関係性を確認
```javascript
await debugUtils.checkBigTaskProjectRelations()
```
これにより以下が表示されます：
- 各BigTaskのproject_id
- 対応するプロジェクトの存在有無
- 孤立したタスクの詳細

### ステップ3: 問題があれば修復
もし孤立したBigTaskが見つかった場合：
1. 正しいプロジェクトIDを確認
2. 修復コマンドを実行：
```javascript
await debugUtils.repairOrphanedBigTasks('正しいプロジェクトID')
```

## トラブルシューティング

### 「不明なプロジェクト」が表示される原因
1. **プロジェクトが削除された**: BigTaskが参照しているプロジェクトが削除された
2. **データ同期の問題**: プロジェクト作成時にBigTaskのproject_idが正しく設定されなかった
3. **手動でのデータ編集**: 開発中にデータベースを直接編集した

### 解決方法
1. デバッグユーティリティで状態を確認
2. 孤立したタスクを特定
3. 適切なプロジェクトに再割り当て
4. または、不要なタスクを削除

## 開発者向け情報

デバッグユーティリティは以下のファイルに実装されています：
- `/src/utils/debug-utils.ts` - メインのデバッグ機能
- `/src/utils/quick-debug.ts` - クイックチェック機能
- `/src/components/providers/debug-provider.tsx` - 自動読み込み

これらは開発環境でのみ有効になります（`NODE_ENV === 'development'`）。