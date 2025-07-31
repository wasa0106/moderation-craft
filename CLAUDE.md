# ModerationCraft Development Guidelines

## プロジェクト概要
個人創作者向けセルフケア統合型プロジェクト管理アプリケーション

## 技術スタック
- Next.js 15.3.5 (App Router)
- TypeScript
- shadcn/ui v4
- Tailwind CSS v4
- IndexedDB (Dexie) + AWS DynamoDB
- React Query
- Zustand (状態管理)

## コーディング規約

### UIコンポーネント
- shadcn/ui v4のdashboard-01パターンに準拠
- セマンティックカラー使用（text-foreground, text-muted-foreground等）
- グリッドレイアウト: `grid gap-4 md:grid-cols-*`形式
- 境界線: 必要最小限、`border border-border`

### レイアウト
- ページ共通: `flex flex-1 flex-col gap-6 p-4 md:p-6`
- Card: 必ず`border border-border`を追加
- 色指定: gray系禁止、セマンティックカラーのみ使用

### データ管理
- オフラインファースト設計
- IndexedDBを主、DynamoDBを従とする
- 楽観的更新の実装
- React Queryでキャッシュ管理

## 重要なディレクトリ
- `/src/components/ui/` - shadcn/uiコンポーネント
- `/src/hooks/` - データフェッチ用カスタムフック
- `/src/lib/db/` - データベース関連
- `/src/stores/` - Zustand状態管理
- `/src/app/` - Next.js App Router

## 開発時の注意点
1. 新規ページは必ずMainLayoutの子要素として作成
2. 直接的な色指定（text-gray-*等）は使用禁止
3. データ更新時は必ず楽観的更新を実装
4. テスト作成を忘れずに
5. コンポーネントは`use client`を適切に使用

## コード品質チェック
### 必須チェック（実装完了時に必ず実行）
1. **typescript-quality-checker**サブエージェントを必ず実行
   - 型エラー、ESLint警告、テスト実行を確認
   - `npm run quality`でも実行可能

### 条件付きチェック（該当する変更時に実行）
1. **UIコンポーネント変更時**（*.tsx, components/配下）
   - **ui-color-system-enforcer**サブエージェントを実行
   - セマンティックカラーの使用を確認

2. **プロジェクト構造変更時**（新規ファイル追加、ディレクトリ変更）
   - **project-structure-analyzer**サブエージェントを実行
   - 依存関係とアーキテクチャを分析

3. **オフライン/同期機能変更時**（lib/db/*, lib/sync/*）
   - **offline-sync-optimizer**サブエージェントを実行
   - 同期ロジックとIndexedDB最適化を確認

4. **大規模変更時**（10ファイル以上）
   - **project-structure-analyzer**サブエージェントを実行
   - 全体的な影響を分析

### 品質チェックコマンド
- `npm run quality` - 基本的な品質チェック
- `npm run quality:full` - 完全な品質チェック（lint + type-check + test + quality）
- `npm run lint` - ESLintチェック
- `npm run type-check` - TypeScript型チェック
- `npm test` - テスト実行

## デバッグとテスト
- `npm run dev` - 開発サーバー起動
- `npm run lint` - ESLint実行
- `npm run type-check` - TypeScript型チェック
- デバッグツール: `/debug`ページで各種機能テスト可能

## 主要機能
1. **プロジェクト管理**: WBSベースのタスク階層管理
2. **タイマー機能**: ポモドーロテクニック対応
3. **スケジューリング**: 週次計画とドラッグ&ドロップ
4. **レポート**: 進捗と時間分析
5. **同期機能**: オフライン対応とクラウド同期

## Git運用
- mainブランチ保護
- 機能開発はfeature/*ブランチ
- コミットメッセージは日本語可