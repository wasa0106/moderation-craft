# ModerationCraft アーキテクチャ設計（逆生成）

## 分析日時
2025-08-02

## システム概要

### 実装されたアーキテクチャ
- **パターン**: オフラインファースト + レイヤードアーキテクチャ
- **フレームワーク**: Next.js 15.3.5 (App Router)
- **構成**: フルスタックTypeScriptアプリケーション

### 技術スタック

#### フロントエンド
- **フレームワーク**: React 19 + Next.js 15.3.5
- **状態管理**: Zustand v5（ローカル状態）+ React Query v5（サーバー状態）
- **UI ライブラリ**: shadcn/ui v4（Radix UI + Tailwind CSS）
- **スタイリング**: Tailwind CSS v4（CSSカスタムプロパティベース）
- **フォーム管理**: React Hook Form v7 + Zod v3
- **その他**: 
  - DnD Kit（ドラッグ&ドロップ）
  - Recharts（グラフ表示）
  - Lucide React（アイコン）

#### バックエンド
- **フレームワーク**: Next.js API Routes（App Router）
- **認証方式**: APIキー認証（ヘッダーベース）
- **データアクセス**: リポジトリパターン
- **バリデーション**: Zod（型安全なスキーマ検証）

#### データベース
- **ローカルDB**: IndexedDB（Dexie v4ラッパー）
- **クラウドDB**: AWS DynamoDB（NoSQL）
- **同期方式**: キューベースの楽観的更新
- **接続**: AWS SDK v3

#### インフラ・ツール
- **ビルドツール**: Next.js組み込み（Turbopack）
- **テストフレームワーク**: Vitest v3 + Testing Library
- **コード品質**: ESLint v9 + Prettier v3
- **Storybook**: v9（UIコンポーネントカタログ）

## レイヤー構成

### 発見されたレイヤー
```
src/
├── app/                    # プレゼンテーション層（ページ・ルート）
│   ├── api/               # APIエンドポイント層
│   └── [pages]/           # UIページ
├── components/            # UIコンポーネント層
│   ├── ui/               # 基礎UIコンポーネント
│   └── [features]/       # 機能別コンポーネント
├── hooks/                 # ビジネスロジック層（カスタムフック）
├── lib/                   # インフラストラクチャ層
│   ├── db/               # データアクセス
│   ├── sync/             # 同期サービス
│   └── aws/              # 外部サービス連携
├── stores/                # 状態管理層
└── types/                 # 型定義層
```

### レイヤー責務分析
- **プレゼンテーション層**: Next.js App Router、React コンポーネント
- **アプリケーション層**: カスタムフック（use-*.ts）、Zustandストア
- **ドメイン層**: TypeScript型定義、ビジネスルール
- **インフラストラクチャ層**: リポジトリ実装、外部API連携、DB接続

## デザインパターン

### 発見されたパターン
- **Repository Pattern**: 全エンティティで実装（BaseRepository抽象クラス）
- **Observer Pattern**: Zustand（状態変更の自動通知）
- **Strategy Pattern**: 同期戦略（ConflictResolver）
- **Factory Pattern**: リポジトリインスタンス生成
- **Singleton Pattern**: SyncService、データベースインスタンス

## 非機能要件の実装状況

### セキュリティ
- **認証**: APIキー認証（X-API-Keyヘッダー）
- **認可**: ユーザーIDベースのデータアクセス制御
- **CORS設定**: Next.js標準設定
- **データ検証**: Zodによる入力検証

### パフォーマンス
- **キャッシュ**: React Queryによるクライアントキャッシュ
- **データベース最適化**: 
  - IndexedDBインデックス（12カラム）
  - DynamoDB GSI（2つ）
- **バンドル最適化**: Turbopack使用
- **レンダリング最適化**: React 19の並行機能

### 運用・監視
- **ログ出力**: カスタムロガー実装（syncLogger等）
- **エラートラッキング**: try-catchブロックでのエラー捕捉
- **デバッグ機能**: 複数のデバッグページ実装
- **ヘルスチェック**: `/api/health`エンドポイント

## オフラインファースト設計

### 実装アプローチ
1. **ローカルファースト**: 全操作をまずIndexedDBで実行
2. **楽観的更新**: UIを即座に更新、バックグラウンドで同期
3. **同期キュー**: 失敗した操作を記録、自動リトライ
4. **競合解決**: タイムスタンプベースの最終更新優先

### 同期メカニズム
```
[ユーザー操作] → [IndexedDB更新] → [UI即座更新]
                        ↓
                  [同期キュー追加]
                        ↓
                  [バックグラウンド同期]
                        ↓
                    [DynamoDB更新]
```

## 状態管理アーキテクチャ

### 二層状態管理
- **ローカル状態**: Zustand（UI状態、一時データ）
- **サーバー状態**: React Query（永続データ、キャッシュ）

### ストア構成
- `project-store`: プロジェクト選択状態
- `task-store`: タスク管理状態
- `timer-store`: タイマー実行状態
- `sync-store`: 同期状態管理
- `project-creation-store`: プロジェクト作成フロー

## テーマ・スタイリング設計

### CSSカスタムプロパティ
- セマンティックカラー変数（--color-background、--color-foreground等）
- ダークモード対応（CSS変数の動的切り替え）
- Tailwind CSS v4のカスタムユーティリティ

### コンポーネントスタイリング
- CVA（Class Variance Authority）によるバリアント管理
- cn()ユーティリティによるクラス結合
- shadcn/uiのコンポーネント設計パターン