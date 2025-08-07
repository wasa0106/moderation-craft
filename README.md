# ModerationCraft

個人創作者向けセルフケア統合型プロジェクト管理アプリケーション

## 概要

ModerationCraftは、創作活動とセルフケアを統合的に管理するためのWebアプリケーションです。タスク管理、時間追跡、健康データの分析を通じて、持続可能な創作活動をサポートします。

## 主要機能

### ✅ 実装済み機能

- **プロジェクト管理**: WBSベースのタスク階層管理
- **タイマー機能**: ポモドーロテクニック対応の作業タイマー
- **スケジューリング**: 週次計画とドラッグ&ドロップ対応
- **レポート**: 進捗と時間分析
- **同期機能**: オフライン対応とクラウド同期（IndexedDB + DynamoDB）
- **データパイプライン**: DynamoDB → S3自動エクスポート

### 🔄 開発中機能

- **外部データ連携**: Fitbit、天候データの統合
- **分析基盤**: DuckDB WASMによるブラウザ内分析
- **ML統合**: Hugging Faceによる予測分析

## 技術スタック

- **フロントエンド**: Next.js 15.3.5 (App Router), TypeScript
- **UI**: shadcn/ui v4, Tailwind CSS v4
- **データベース**: IndexedDB (Dexie), AWS DynamoDB
- **状態管理**: Zustand, React Query
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
npm run lint
npm run type-check

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
│   ├── lib/           # ユーティリティ
│   │   ├── db/       # データベース
│   │   └── aws/      # AWS統合
│   ├── hooks/         # カスタムフック
│   └── stores/        # Zustand状態管理
├── docs/              # ドキュメント
│   ├── data-pipeline/ # データパイプライン
│   └── features/      # 機能説明
└── public/            # 静的ファイル
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