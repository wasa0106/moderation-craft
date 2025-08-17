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

### モーダル/ダイアログ
- **基本構成**: shadcn/ui の Dialog コンポーネントを使用
- **背景色設定**:
  - DialogContent: `bg-background` クラス（テーマ自動切替）
    - ライトモード: HSL(214 17% 94%)
    - ダークモード: HSL(220 13% 9%)
  - DialogOverlay: `bg-black/50`（50%透明の黒）
- **実装ルール**:
  - 直接的な色指定（bg-white, bg-gray-900等）は禁止
  - 必ずセマンティックカラークラスを使用
  - 境界線: `border border-border`
  - アニメーション: shadcn/ui デフォルト設定を使用
- **コンポーネント構造**:
  ```tsx
  <Dialog>
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>タイトル</DialogTitle>
        <DialogDescription>説明文</DialogDescription>
      </DialogHeader>
      {/* コンテンツ */}
      <DialogFooter>
        {/* アクションボタン */}
      </DialogFooter>
    </DialogContent>
  </Dialog>
  ```

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
  - `/debug/pipeline` - データパイプライン管理UI

## 主要機能
1. **プロジェクト管理**: WBSベースのタスク階層管理
2. **タイマー機能**: ポモドーロテクニック対応
3. **スケジューリング**: 週次計画とドラッグ&ドロップ
4. **レポート**: 進捗と時間分析
5. **同期機能**: オフライン対応とクラウド同期
6. **データパイプライン**: DynamoDB → S3自動エクスポート

## Git運用
- mainブランチ保護
- 機能開発はfeature/*ブランチ
- コミットメッセージは日本語可

## データパイプラインアーキテクチャ

### 概要
個人創作者の生産性と健康データを統合分析するモダンデータスタック

### アーキテクチャ構成
```
データソース → 取り込み → データレイク → 変換 → 分析 → サービング
   ↓            ↓           ↓            ↓       ↓        ↓
Multiple     Lambda        S3          dbt   DuckDB   Dashboard
Sources      Functions
```

### データソース層

#### 内部データソース
- **ModerationCraft**: タスク、プロジェクト、作業セッション
- **IndexedDB**: オフラインファーストデータ
- **DynamoDB**: 同期済みクラウドデータ

#### 外部データソース
- **健康データ**
  - Fitbit: 睡眠、心拍変動、活動量、ストレススコア
  - Apple Health: iOS連携データ
  - Google Fit: Android連携データ

- **環境データ**
  - OpenWeatherMap: 気温、湿度、気圧、大気質
  - 日照時間、UV指数

- **活動データ**
  - Google Calendar: スケジュール、会議
  - GitHub: コミット、PR活動
  - Spotify: 作業中BGM、集中度指標

### データレイク設計（S3）

#### ディレクトリ構造
```
s3://moderation-craft-data/
├── raw/                    # 生データ層（不変）
│   ├── internal/           # 内部アプリデータ
│   │   ├── dynamodb-exports/dt=YYYY-MM-DD/
│   │   └── app-events/dt=YYYY-MM-DD/
│   ├── external/           # 外部APIデータ
│   │   ├── fitbit/
│   │   │   ├── sleep/dt=YYYY-MM-DD/
│   │   │   ├── activity/dt=YYYY-MM-DD/
│   │   │   └── vitals/dt=YYYY-MM-DD/
│   │   ├── weather/
│   │   │   ├── hourly/dt=YYYY-MM-DD/
│   │   │   └── daily/dt=YYYY-MM-DD/
│   │   └── calendar/dt=YYYY-MM-DD/
│   └── manual/             # 手動アップロード
│       └── mood-journals/
├── staging/                # 変換中間層
│   ├── cleaned/           # クレンジング済み
│   ├── standardized/      # 標準化済み
│   └── unified/           # 統合済み
├── gold/                  # 分析用データマート（ビジネス向け集計済み）
│   ├── daily_summaries/   # 日次集計
│   ├── weekly_reports/    # 週次レポート
│   ├── correlations/      # 相関分析
│   └── predictions/       # 予測モデル用
└── ml/                    # 機械学習用
    ├── features/          # 特徴量
    ├── training/          # 学習用データセット
    └── models/            # モデルアーティファクト
```

#### データフォーマット
- **raw層**: JSON/CSV（元の形式を保持）
- **staging層**: Parquet（圧縮・高速化）
- **gold層**: Parquet/Delta Lake（ACID保証）

### データ変換層（dbt）

#### モデル階層
1. **ステージング層**
   - `stg_*`: 生データのクレンジング、型変換
   - データ品質チェック、NULL処理

2. **中間層**
   - `int_*`: ビジネスロジック適用
   - データ統合、計算フィールド追加

3. **マート層**
   - `mart_*`: 最終的な分析用テーブル
   - 集計、ピボット、時系列処理

#### 主要データモデル
- `mart_productivity_daily`: 日次生産性指標
- `mart_wellness_correlation`: 健康×生産性相関
- `mart_environmental_impact`: 環境要因影響分析
- `mart_predictive_features`: ML用特徴量

### 分析エンジン（DuckDB）

#### 採用理由
- **高速**: カラムナストレージで分析クエリ最適化
- **軽量**: サーバーレス、組み込み可能
- **S3対応**: Parquetファイル直接クエリ
- **WASM対応**: ブラウザ内実行可能

#### 利用パターン
1. **ローカル分析**: オフライン時の分析継続
2. **エッジ分析**: CDNエッジでの前処理
3. **バッチ分析**: 大規模集計処理
4. **リアルタイム**: ストリーミングデータ処理

### データ取り込みパイプライン

#### Lambda Functions
- `ingest-fitbit`: 日次健康データ取得（毎日午前2時）
- `ingest-weather`: 日次天候データ取得（毎日午前3時）
- `export-dynamodb`: 日次DynamoDBエクスポート（毎日午前1時）
- `refresh-report-data`: オンデマンドデータ更新（レポート画面の更新ボタン）

#### ワークフロー管理（Step Functions）
```
開始 → データ取得 → バリデーション → S3保存 → dbt実行 → 通知
         ↓                ↓
     リトライ         エラー処理
```

### データガバナンス

#### データ品質管理
- dbtテストによる自動検証
- Great Expectationsによる期待値検証
- データリネージの追跡
- スキーマ進化の管理

### 分析ユースケース

#### 1. 生産性最適化
- 最適作業時間帯の特定
- 集中力パターン分析
- タスク完了予測

#### 2. 健康相関分析
- 睡眠と生産性の相関
- 運動と創造性の関係
- ストレスと品質の影響

#### 3. 環境影響分析
- 天候と気分の関係
- 気圧と集中力
- 季節性パターン

#### 4. パーソナライズド推奨
- 個人別最適スケジュール
- 休憩タイミング提案
- 健康改善アドバイス

### 実装フェーズ

#### Phase 1: 基盤構築（2週間）✅ 完了
- ✅ S3バケット設定
- ✅ 基本Lambda関数
- ✅ DynamoDB → S3エクスポート
- ✅ アプリケーション統合（デバッグUI）

#### Phase 2: 外部連携（3週間）
- Fitbit API統合
- 天候API統合
- データ標準化処理

#### Phase 3: 分析基盤（3週間）
- dbtプロジェクト構築
- 基本マート作成
- DuckDB統合

#### Phase 4: 高度な分析（4週間）
- 相関分析実装
- 予測モデル構築
- ダッシュボード開発

### 技術スタック拡張
- **データレイク**: AWS S3
- **データ変換**: dbt Core
- **分析DB**: DuckDB (WASM)
- **オーケストレーション**: AWS Step Functions
- **モニタリング**: CloudWatch
- **ML**: Hugging Face

### ロギング ###
* ライブラリ: vibelogger
* 使い方: https://github.com/fladdict/vibe-logger
* vibeloggerはコーディングエージェント用に高度な構造化データを出力するロガーです。
* ログにはvibeloggerを可能な限り利用し、ログからAIが自律的に何が起きてるかを把握できるようにする
* vibeloggerにはステップ、プロセス、コンテキスト情報、TODOなど様々な情報を構造化して記録できます。
* デバッグ時には./logsの出力を参照する
