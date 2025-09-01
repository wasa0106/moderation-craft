# ModerationCraft

個人創作者向けセルフケア統合型プロジェクト管理アプリケーション

## 概要

ModerationCraftは、創作活動とセルフケアを統合的に管理するためのWebアプリケーションです。タスク管理、時間追跡、健康データの分析を通じて、持続可能な創作活動をサポートします。

## 主要機能

### ✅ 実装済み機能

- **プロジェクト管理**: WBSベースのタスク階層管理
- **BigTask管理**: プロジェクト単位の大タスク管理
  - 見積もり時間と実績時間の追跡
  - カテゴリ分類（開発、設計、テスト、その他）
  - 期間管理（開始日〜終了日）
- **カンバンボード** (`/kanban`): ビジュアルタスク管理
  - ドラッグ&ドロップ対応
  - ステータス別表示（active, completed, cancelled）
  - フィルタリング機能
- **タイマー機能**: ポモドーロテクニック対応の作業タイマー
- **スケジューリング**: 週次計画とドラッグ&ドロップ対応
- **レポート**: 進捗と時間分析
- **Fitbit連携** (`/settings/integrations`): 健康データ統合
  - OAuth認証フロー実装済み
  - 睡眠・活動量・心拍変動データ取得
- **同期機能**: オフライン対応とクラウド同期（IndexedDB + DynamoDB）
- **データパイプライン**: DynamoDB → S3自動エクスポート（Phase 1完了）
- **サイトマップ** (`/sitemap`): 全機能へのナビゲーション

### 🔄 開発中機能

- **外部データ連携**: 天候データの統合（Fitbitは実装済み）
- **分析基盤**: DuckDB WASMによるブラウザ内分析（基盤構築中）
- **ML統合**: Hugging Faceによる予測分析
- **データパイプライン Phase 2-4**: 外部連携、分析基盤、高度な分析

## 技術スタック

- **フロントエンド**: Next.js 15.3.5 (App Router), TypeScript
- **UI**: shadcn/ui v4, Tailwind CSS v4
- **データベース**: IndexedDB (Dexie), AWS DynamoDB
- **状態管理**: Zustand, React Query
- **テスト**: Vitest (ユニットテスト), MSW (Mock Service Worker)
- **UIコンポーネント開発**: Storybook v9
- **分析**: DuckDB WASM (ブラウザ内データ分析)
- **ロギング**: vibelogger (構造化ロギング)
- **クラウド**: AWS (S3, Lambda, EventBridge)

## セットアップ

### 前提条件

- Node.js 18以上
- npm または yarn
- AWS アカウント（データパイプライン機能を使用する場合）

### インストール

```bash
# リポジトリのクローン
git clone https://github.com/yourusername/moderation-craft.git
cd moderation-craft

# 依存関係のインストール
npm install
# ※ postinstallスクリプトによりDuckDB WASMファイルが自動コピーされます

# 環境変数の設定
cp .env.example .env.local
# .env.localを編集して必要な設定を追加
```

### 環境変数

`.env.local`に以下の環境変数を設定:

```env
# AWS設定（オプション）
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# データパイプライン設定（オプション）
S3_BUCKET_NAME=moderation-craft-data-xxxxx
LAMBDA_EXPORT_FUNCTION=moderation-craft-export-dynamodb
DYNAMODB_TABLE_NAME=moderation-craft-data
```

## 開発

```bash
# 開発サーバーの起動
npm run dev

# コード品質チェック
npm run lint        # ESLintチェック
npm run type-check  # TypeScript型チェック
npm run format      # コード整形
npm run format:check # 整形チェック

# テスト
npm test            # Vitestユニットテスト実行
npm run test:coverage # カバレッジレポート生成
npm run test:watch  # ウォッチモードでテスト

# UIコンポーネント開発
npm run storybook   # Storybook起動（開発用）
npm run build-storybook # Storybook静的ビルド

# ビルド
npm run build
```

## 使い方

### 基本的な使い方

1. **プロジェクト作成**: `/projects`でプロジェクトを作成
2. **タスク管理**: WBS形式でタスクを階層的に管理
3. **タイマー**: `/timer`でポモドーロタイマーを使用
4. **レポート確認**: `/reports`で進捗を確認

### デバッグ機能

開発・デバッグ用の機能にアクセス:

- `/debug` - デバッグメニュー
- `/debug/pipeline` - データパイプライン管理UI
- `/debug/fitbit` - Fitbit連携デバッグ
- `/debug/analytics` - 分析機能デバッグ
- `/debug-bigtasks` - BigTask機能デバッグ
- `/debug-projects` - プロジェクト機能デバッグ

## ドキュメント

- [開発ガイドライン](./CLAUDE.md)
- [データパイプライン](./docs/data-pipeline/README.md)
- [機能説明書](./docs/features/)
  - [パイプライン管理](./docs/features/pipeline-management.md)

## プロジェクト構造

```
moderation-craft/
├── src/
│   ├── app/           # Next.js App Router
│   ├── components/    # UIコンポーネント
│   │   ├── ui/      # shadcn/uiコンポーネント
│   │   ├── kanban/  # カンバンボード関連
│   │   └── task/    # BigTask/SmallTask関連
│   ├── lib/           # ユーティリティ
│   │   ├── db/       # データベース（IndexedDB/DynamoDB）
│   │   ├── aws/      # AWS統合
│   │   └── sync/     # 同期機能
│   ├── hooks/         # カスタムフック
│   └── stores/        # Zustand状態管理
├── docs/              # ドキュメント
│   ├── data-pipeline/ # データパイプライン
│   └── features/      # 機能説明
├── .storybook/        # Storybook設定
├── __tests__/         # テストファイル
└── public/            # 静的ファイル
    └── mockServiceWorker.js # MSWワーカー
```

## コントリビューション

1. Issueを作成して機能提案やバグ報告
2. フォークしてFeatureブランチを作成
3. コミット（日本語可）
4. プルリクエストを送信

### コーディング規約

- UIコンポーネント: shadcn/ui v4のパターンに準拠
- セマンティックカラー使用（gray系禁止）
- オフラインファースト設計
- 楽観的更新の実装

詳細は[CLAUDE.md](./CLAUDE.md)を参照。

## ライセンス

[MIT License](./LICENSE)

## サポート

- Issues: [GitHub Issues](https://github.com/yourusername/moderation-craft/issues)
- Documentation: [プロジェクトWiki](https://github.com/yourusername/moderation-craft/wiki)

---

Built with ❤️ for creative professionals