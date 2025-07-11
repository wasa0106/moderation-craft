# moderation-craft 開発仕様書（完全版）

## プロジェクト概要

### 基本情報
- **プロジェクト名**: moderation-craft
- **目的**: 個人創作者向けセルフケア統合型プロジェクト管理アプリ
- **コンセプト**: 有能な仮想上司があなたをマネジメントし、燃え尽きを防ぐ
- **開発期限**: 2025/7/15（20日間）
- **ターゲット**: 個人開発者、同人作家、副業クリエイター
- **利用形態**: MVP時点では単一ユーザー、将来的にマルチユーザー対応

### コア価値
- **中庸の実践**: 頑張りすぎず、サボりすぎない持続可能な創作
- **データ統合**: タスク・睡眠・感情をリアルタイム統合
- **予防的ケア**: 燃え尽きを事前に検知・防止

---

## アーキテクチャ設計

### レイヤード・アーキテクチャ

#### プレゼンテーション層
- **コンポーネント**: Next.js pages/components, UI状態管理（Zustand）
- **責務**: ユーザーインタラクション, 表示ロジック

#### アプリケーション層
- **サービス**: TaskManagementService, SchedulingService, SyncService, OfflineService
- **責務**: ビジネスロジック実装, データ同期制御, オフライン対応

#### インフラストラクチャ層
- **コンポーネント**: API Client (REST/WebSocket), IndexedDB Repository, DynamoDB Client, Fitbit API Client
- **責務**: データ永続化, 外部API通信

### オフラインファースト設計

#### データフロー
1. UI操作 → IndexedDB（即座に保存）
2. IndexedDB → Sync Queue（バックグラウンド）
3. Sync Queue → DynamoDB（ネットワーク接続時）

#### 同期戦略
- **ローカルストレージ**: 全データのキャッシュとオフライン編集 (IndexedDB + Dexie)
- **同期タイミング**:
  - オンライン復帰時に自動同期
  - 5分ごとのバックグラウンド同期
  - 手動同期ボタン
- **競合解決**: last-write-wins (タイムスタンプベース)
- **ユーザー通知**: 競合発生時に通知

#### 同期キュー構造
- `operation_id`: string
- `operation_type`: CREATE | UPDATE | DELETE
- `entity_type`: project | task | session | mood_entry
- `payload`: object
- `timestamp`: datetime
- `retry_count`: number
- `status`: pending | syncing | completed | failed

---

## 将来的なデータアーキテクチャ設計

### OLTP + OLAP 分離アーキテクチャ

#### OLTP層（リアルタイム処理）
- **技術**: DynamoDB
- **目的**: リアルタイム操作・同期処理
- **特性**:
  - 低レイテンシ（1-10ms）
  - 高スループット
  - 即座の読み書き
- **利用例**: タスク管理, ユーザー操作, リアルタイム同期, 日常的なCRUD操作

#### OLAP層（分析処理）
- **技術**: DuckDB + dbt
- **目的**: 高度な分析・予測処理
- **特性**:
  - 複雑なクエリ対応
  - 大量データ集計
  - 機械学習統合
- **利用例**: 生産性分析, 燃え尽き予測, 長期トレンド分析, レコメンデーション生成

#### データパイプライン
- **抽出**: DynamoDB → S3 (Parquet形式, 日次バッチ)
- **変換**: dbt (SQL変換・集計)
  - staging: 生データクリーニング
  - intermediate: ビジネスロジック適用
  - marts: 分析用最終テーブル
- **ロード**: DuckDB (高速分析クエリ実行, Python/R機械学習統合)

### データフロー（Lambda Architecture）

#### Speed Layer（リアルタイム処理）
- **パス**: User → IndexedDB → DynamoDB
- **レイテンシ**: <100ms
- **目的**: 即座のフィードバック

#### Batch Layer（分析処理）
- **パス**: DynamoDB → S3 → DuckDB → dbt → 分析結果
- **レイテンシ**: 数時間〜1日
- **目的**: 深い洞察・予測

#### Serving Layer（結果統合）
- **リアルタイムデータ**: DynamoDB（今日のデータ）
- **分析データ**: DuckDB（トレンド・予測）
- **ユーザーインターフェース**: 両者を組み合わせた統合ビュー

---

## 機能要件

### MVP機能（7/15まで実装必須）

#### ✅ プロジェクト・タスク管理
- プロジェクト目標・期限設定
- 1週間単位WBS（大タスク）作成
- 大タスク→小タスク分解
- 見積時間設定

#### ✅ 日次実行機能
- タイマー付き時間記録（オフライン対応）
- 実行時間とタスクの紐付け
- 集中力状況記録（9段階）
- 突発タスク記録
- **予実差分の視覚的フィードバック（色強調）**

#### ✅ スケジュール管理
- 週間カレンダー表示
- ドラッグ&ドロップによるリスケジューリング
- 翌日スケジュール調整（23時時点）

#### ✅ Fitbit連携
- **前日の睡眠時間・歩数データ取得（リアルタイム不要）**
- 毎朝6時に前日データを同期
- Fitbit Web API使用

#### ✅ 基本レポート
- 実績vs見積時間比較（差分を色で強調表示）
- 週次実行サマリー
- タスク完了率

### Phase 5機能（分析基盤構築）

#### 🔧 データパイプライン基盤
- DynamoDB → S3 日次エクスポート
- dbt変換処理基盤
- DuckDB分析環境構築
- 基本的な集計テーブル作成

#### 📊 基本分析機能
- 週次/月次生産性レポート
- 睡眠と生産性の相関分析
- 時間帯別パフォーマンス分析
- 基本的な可視化ダッシュボード

### Phase 6機能（高度な分析）

#### 🧠 予測・最適化機能
- 燃え尽きリスク早期警告
- 最適作業時間帯レコメンデーション
- プロジェクト完了予測
- 生産性向上提案

#### 📈 高度なレポート
- 長期トレンド分析
- 季節性パターン検出
- 目標達成予測
- パフォーマンス最適化レポート

### Phase 7機能（AI統合）

#### 🤖 AI レコメンデーション
- 個人化されたスケジュール提案
- 動的な休憩時間調整
- コンディション予測アラート
- 自動タスク優先度調整

#### 🔗 外部システム統合
- カレンダーアプリ連携
- 他の健康管理アプリ統合
- チームメンバーとの共有機能
- **マルチユーザー対応（SaaS化）**

---

## データ構造

### 階層関係
```
プロジェクト（1-3ヶ月）
├── 大タスク（1週間単位）
    └── 小タスク（日次スケジュール）
        └── 作業記録（実績データ）
            └── 分析データマート（集計・予測）
```

### 主要エンティティ

#### User
| フィールド | 型 | 説明 |
|---|---|---|
| id | string | PK |
| name | string | ユーザー名 |
| email | string | メールアドレス |
| created_at | timestamp | 作成日時 |
| updated_at | timestamp | 更新日時 |
| timezone | string | タイムゾーン（分析用） |
| preferences | json | 個人設定 |

#### Project
| フィールド | 型 | 説明 |
|---|---|---|
| id | string | PK |
| user_id | string | FK: User |
| name | string | プロジェクト名 |
| goal | string | 定量目標 |
| deadline | date | 期限 |
| status | enum | planning \| active \| completed |
| created_at | timestamp | 作成日時 |
| updated_at | timestamp | 更新日時 |
| version | number | 楽観的ロック用 |
| estimated_total_hours | number | 分析用 |


#### BigTask（更新）
| フィールド | 型 | 説明 |
|---|---|---|
| id | string | PK |
| project_id | string | FK: Project |
| user_id | string | FK: User |
| name | string | タスク名 |
| category | string | カテゴリ名（分析用） |
| week_number | number | プロジェクト開始からの週数 |
| estimated_hours | number | 見積時間 |
| actual_hours | number | 実績時間集計 |
| status | enum | pending \| active \| completed |
| created_at | timestamp | 作成日時 |
| updated_at | timestamp | 更新日時 |

#### SmallTask
| フィールド | 型 | 説明 |
|---|---|---|
| id | string | PK |
| big_task_id | string | FK: BigTask |
| user_id | string | FK: User |
| name | string | タスク名 |
| estimated_minutes | number | 見積時間（分） |
| scheduled_start | datetime | 予定開始時刻 |
| scheduled_end | datetime | 予定終了時刻 |
| actual_start | datetime? | 実際の開始時刻 |
| actual_end | datetime? | 実際の終了時刻 |
| actual_minutes | number? | 実際の作業時間 |
| focus_level | number? | 任意入力（1-9段階） |
| notes | string? | メモ |
| is_emergency | boolean | 突発タスクフラグ |
| variance_ratio | number? | 予実差分率（実績/見積） |
| created_at | timestamp | 作成日時 |
| updated_at | timestamp | 更新日時 |

#### WorkSession
| フィールド | 型 | 説明 |
|---|---|---|
| id | string | PK |
| small_task_id | string? | FK: SmallTask（nullable） |
| user_id | string | FK: User |
| start_time | datetime | 開始時刻 |
| end_time | datetime? | 終了時刻 |
| duration_minutes | number | 作業時間（分） |
| focus_level | number? | 任意入力 |
| mood_notes | string? | 気分メモ |
| is_synced | boolean | DynamoDBとの同期状態 |
| created_at | timestamp | 作成日時 |
| updated_at | timestamp | 更新日時 |

#### MoodEntry
| フィールド | 型 | 説明 |
|---|---|---|
| id | string | PK |
| user_id | string | FK: User |
| timestamp | datetime | 感情記録時刻 |
| mood_level | number | 1-9（1=とても悪い、9=とても良い） |
| notes | string? | 自由記述（何があったか） |
| created_at | timestamp | 作成日時 |

#### DailyCondition
| フィールド | 型 | 説明 |
|---|---|---|
| date | date | PK |
| user_id | string | FK: User |
| sleep_hours | number? | Fitbitから前日分を取得 |
| steps | number? | Fitbitから前日分を取得 |
| fitbit_sync_date | datetime? | Fitbitデータ同期日時 |
| subjective_mood | enum? | excellent \| good \| fair \| poor |
| energy_level | number? | 1-5段階 |
| notes | string? | メモ |
| created_at | timestamp | 作成日時 |

### 分析用データマート（Phase 5以降）

#### ProductivityMetrics
| フィールド | 型 | 説明 |
|---|---|---|
| user_id | string | ユーザーID |
| date | date | 日付 |
| session_count | number | セッション数 |
| total_minutes | number | 総作業時間 |
| avg_focus_level | number | 平均集中力 |
| productivity_score | number | 独自算出指標 |
| sleep_hours | number | 睡眠時間 |
| steps | number | 歩数 |
| work_start_time | time | 作業開始時刻 |
| work_end_time | time | 作業終了時刻 |


##### CategoryMetrics
| フィールド | 型 | 説明 |
|---|---|---|
| user_id | string | ユーザーID |
| project_id | string | プロジェクトID |
| category | string | カテゴリ名 |
| total_estimated_hours | number | 見積時間合計 |
| total_actual_hours | number | 実績時間合計 |
| efficiency_ratio | number | 効率性（実績/見積） |
| task_count | number | タスク数 |
| completion_rate | number | 完了率 |


#### BurnoutIndicators
| フィールド | 型 | 説明 |
|---|---|---|
| user_id | string | ユーザーID |
| week_start | date | 週開始日 |
| overwork_flag | boolean | 過労フラグ |
| focus_decline_flag | boolean | 集中力低下フラグ |
| sleep_deprivation_flag | boolean | 睡眠不足フラグ |
| burnout_risk_score | number | 0-1の予測スコア |
| recommendation | string | レコメンデーション |

#### OptimalSchedule
| フィールド | 型 | 説明 |
|---|---|---|
| user_id | string | ユーザーID |
| hour_of_day | number | 時間帯 |
| avg_productivity | number | 平均生産性 |
| optimal_task_type | string | 最適なタスク種別 |
| recommendation_confidence | number | レコメンデーション信頼度 |

---

## データベース設計

### DynamoDB テーブル設計（OLTP）

#### 基本設計
- **テーブル名**: moderation-craft-data
- **パーティションキー**: PK
- **ソートキー**: SK

#### アクセスパターン
- ユーザーの全プロジェクト取得
- プロジェクトの全タスク取得
- 特定週の全タスク取得
- 日付範囲でのセッション検索
- 日付でのコンディション取得

#### キー設計例
| エンティティ | PK | SK |
|---|---|---|
| プロジェクト | USER#user123 | PROJECT#proj001 |
| 大タスク | PROJECT#proj001 | BIGTASK#week01#task001 |
| 小タスク | BIGTASK#task001 | SMALLTASK#2025-07-08#stask001 |
| ワークセッション | USER#user123#DATE#2025-07-08 | SESSION#14:30:00 |
| コンディション | USER#user123 | CONDITION#2025-07-08 |

#### Global Secondary Indexes (GSI)
| GSI | 用途 | PK | SK |
|---|---|---|---|
| GSI1 | 週次タスク検索 | USER#user123#WEEK#2025-W28 | TASK#timestamp |
| GSI2 | プロジェクト別検索 | PROJECT#proj001 | ENTITY#type#timestamp |
| GSI3 | 日付範囲検索 | USER#user123#YEARMONTH#2025-07 | DATE#2025-07-08#entity_type#id |
| GSI4 | 分析用同期検索 | ANALYTICS_EXPORT#pending | UPDATED_AT#timestamp |

### IndexedDB設計（Dexie）

#### データベース設定
- **データベース名**: moderation-craft-local
- **バージョン**: 1

#### テーブル設計
| テーブル | スキーマ | インデックス |
|---|---|---|
| projects | "id, user_id, status, updated_at" | ["user_id", "status", "updated_at"] |
| big_tasks | "id, project_id, week_number, status" | ["project_id", "[project_id+week_number]"] |
| small_tasks | "id, big_task_id, scheduled_start, status" | ["big_task_id", "scheduled_start", "[big_task_id+scheduled_start]"] |
| work_sessions | "id, small_task_id, start_time, is_synced" | ["small_task_id", "start_time", "is_synced"] |
| mood_entries | "id, user_id, timestamp" | ["[user_id+timestamp]", "timestamp"] |
| daily_conditions | "date, user_id, fitbit_sync_date" | ["[user_id+date]", "fitbit_sync_date"] |
| sync_queue | "++id, operation_type, entity_type, timestamp, status" | ["status", "timestamp"] |

### DuckDB設計（OLAP - Phase 5以降）

#### データベース設定
- **データベース名**: moderation_craft_analytics.db

#### dbt models構造
| レイヤー | モデル | 説明 |
|---|---|---|
| staging | stg_work_sessions | 生の作業記録クリーニング |
|  | stg_tasks | タスクデータ正規化 |
|  | stg_daily_conditions | コンディションデータ |
|  | stg_mood_entries | 感情データ |
| intermediate | int_daily_productivity | 日次生産性指標 |
|  | int_weekly_patterns | 週次パターン |
|  | int_sleep_correlation | 睡眠相関データ |
| marts | productivity_metrics | 生産性分析用 |
|  | burnout_indicators | 燃え尽き予測用 |
|  | optimal_schedule | 最適スケジュール用 |
|  | trend_analysis | 長期トレンド分析用 |

#### パーティション戦略
- **分割方法**: 年月でパーティション分割
- **ユーザー対応**: 将来のマルチユーザー対応
- **保持期間**: 3年間保持（設定可能）

---

## 画面構成

### 1. ダッシュボード（/dashboard）
**目的**: 日次実行のメイン画面

**表示要素**:
- 実施中タスク情報
- タイマー（スタート/ストップ/ポーズ）
- 集中力入力（9段階）
- 今日のスケジュール一覧
- コンディション状況（前日の睡眠・歩数含む）
- **実績vs予定時間（差分を色で強調）**
  - 超過: 赤系グラデーション
  - 適正: 緑色
  - 未達: 青系グラデーション
- **AI レコメンデーション（Phase 6以降）**

**主要機能**:
- タスク開始/完了
- 時間記録
- 突発タスク追加
- 簡易メモ記録
- オフライン時の動作継続

### 2. 週間スケジュール（/schedule/weekly）
**目的**: 週次計画立案・調整

**表示要素**:
- 7日分の縦型カレンダー
- タスクブロック（ドラッグ可能）
- タスクリスト（未配置）
- WBS参照エリア
- **予実差分の色分け表示**

**主要機能**:
- ドラッグ&ドロップでタスク移動
- タスク追加/編集/削除
- 見積時間調整
- スケジュール保存

### 3. 明日のスケジュール調整（/schedule/tomorrow）
**目的**: 23時時点での翌日調整

**表示要素**:
- 今日の未完了タスク
- 明日の予定スケジュール
- 調整後スケジュール
- ドラッグ&ドロップエリア

**主要機能**:
- 未完了タスクの翌日移動
- スケジュール再配置
- 緊急度に基づく優先順位調整

### 4. プロジェクト管理（/projects）
**目的**: プロジェクト設定・WBS作成

**表示要素**:
- プロジェクト一覧
- 目標・期限設定フォーム
- WBSガントチャート
- 進捗状況

**主要機能**:
- プロジェクト CRUD
- 大タスク作成・編集
- 週次計画立案
- 進捗追跡

### 5.プロジェクト作成画面（/projects/new）
**目的**: プロジェクトの基本情報入力とWBS作成を1画面で完結

**構成**:
1. **プロジェクト基本情報**
   - プロジェクト名（必須）
   - 定量目標（必須）
   - 開始日・期限（必須）
   - 期間自動計算表示

2. **投下可能時間の計算**
   - 平日/休日の作業可能日数（選択式）
   - 平日/休日の作業可能時間（時間単位）
   - バッファ率（50-100%、デフォルト80%）
   - 週間作業可能時間の自動計算・表示

3. **タスク一覧**
   - 週単位の大きなタスクを入力（日々の細かいタスクは各週の始めに詳細化）
   - カテゴリ（選択式）、タスク名、見積時間の表形式入力
   - ドラッグ&ドロップで順序変更
   - カテゴリ別時間配分をプログレスバーで可視化

4. **週別タスク配分**
   - タスクを週ごとに自動配分（作業可能時間考慮）
   - 週ごとの作業負荷を可視化
   - 超過時は警告表示
   - 将来的にガントチャートに置き換え予定


### 6. レポート（/reports）
**目的**: 実績分析・振り返り

**MVP版表示要素**:
- 週次サマリー
- **予実差分グラフ（色分け強調）**
- タスク完了率
- コンディション相関（睡眠・歩数との関連）

**Phase 6以降追加要素**:
- 長期トレンド分析
- 燃え尽きリスク指標
- 生産性最適化提案
- 予測ダッシュボード

**主要機能**:
- 期間指定レポート
- CSV エクスポート
- 分析チャート表示
- **PDF レポート生成（Phase 6）**

### 7. 分析ダッシュボード（/analytics - Phase 6以降）
**目的**: 高度な分析・予測表示

**表示要素**:
- 燃え尽きリスク指標
- 最適作業時間帯
- 生産性トレンド
- 睡眠×パフォーマンス相関
- AI レコメンデーション

**主要機能**:
- インタラクティブグラフ
- 期間比較分析
- 予測シミュレーション
- カスタムレポート作成

### デザインシステム

#### カラースキーム（Material Theme）
css
:root {
  /* Primary Colors */
  --primary: #5E621B;
  --on-primary: #FFFFFF;
  --primary-container: #E3E892;
  --on-primary-container: #464A02;

  /* Secondary Colors */
  --secondary: #5F6044;
  --on-secondary: #FFFFFF;
  --secondary-container: #E4E5C0;
  --on-secondary-container: #47492E;

  /* Tertiary Colors */
  --tertiary: #3C6659;
  --on-tertiary: #FFFFFF;
  --tertiary-container: #BEECDB;
  --on-tertiary-container: #244E42;

  /* Error Colors */
  --error: #BA1A1A;
  --on-error: #FFFFFF;
  --error-container: #FFDAD6;
  --on-error-container: #93000A;

  /* Background & Surface */
  --background: #FCFAEC;
  --on-background: #1C1C14;
  --surface: #FCFAEC;
  --on-surface: #1C1C14;
  --surface-variant: #E5E3D2;
  --on-surface-variant: #47473B;

  /* Other Colors */
  --outline: #787869;
  --outline-variant: #C9C7B6;
  }


## 技術仕様

### フロントエンド
- **フレームワーク**: Next.js 14 (App Router)
- **言語**: TypeScript
- **状態管理**:
  - サーバー状態: TanStack Query（楽観的更新、バックグラウンドリフェッシュ、キャッシュ管理）
  - UI状態: Zustand（UIコンポーネント状態）
  - 永続状態: Dexie (IndexedDB wrapper)（オフラインデータ・同期キュー）
- **UIライブラリ**: shadcn/ui + TailwindCSS
- **オフライン対応**: Service Worker, IndexedDB, Background Sync API
- **可視化（Phase 5以降）**: Recharts + D3.js（インタラクティブグラフ、リアルタイム更新、カスタムチャート）

### バックエンド
- **ランタイム**: AWS Lambda (Node.js/TypeScript)
- **API Gateway**: REST API（一般的なCRUD操作）、WebSocket（リアルタイム同期通知）
- **認証**:
  - MVP: Basic Auth + API Key
  - 将来: AWS Cognito（マルチユーザー対応）
- **データベース**:
  - OLTP: DynamoDB
  - OLAP: DuckDB (Phase 5以降)
- **ファイルストレージ**: S3
- **外部API**: Fitbit
  - エンドポイント: https://api.fitbit.com/1.2/
  - データ種別: sleep/date（前日の睡眠時間）、activities/steps/date（前日の歩数）
  - 同期スケジュール: 毎日6:00 (Lambda Cron)

#### Phase 5以降の追加技術スタック
- **データパイプライン**:
  - 抽出: AWS Lambda (DynamoDB → S3)
  - 変換: dbt Core
  - ロード: DuckDB
- **オーケストレーション**: AWS Step Functions
- **監視**: CloudWatch + DataDog
- **MLプラットフォーム**: Python + scikit-learn

### データパイプライン（Phase 5以降）

#### 日次エクスポート
- **トリガー**: CloudWatch Events (毎日 AM 1:00)
- **ソース**: DynamoDB
- **デスティネーション**: S3
- **フォーマット**: Parquet
- **パーティション**: year/month/day

#### dbt変換
- **トリガー**: S3 Event（新ファイル検知）
- **ランタイム**: AWS Batch / Lambda
- **モデル**:
  - staging: データクリーニング
  - intermediate: ビジネスロジック
  - marts: 分析用テーブル

#### 分析更新
- **トリガー**: dbt完了後
- **プロセス**: DuckDB集計更新
- **キャッシュ**: Redis（高速アクセス用）

#### MLパイプライン
- **トリガー**: 週次（日曜日）
- **プロセス**:
  - 特徴量エンジニアリング
  - モデル再学習
  - 予測スコア更新
- **デプロイメント**: Lambda関数自動更新

### エラーハンドリング・監視

#### エラーハンドリング
- **ネットワークエラー**: exponential_backoff（最大5回再試行）、オフラインフォールバック
- **同期エラー**: CloudWatch Logs、ユーザー通知（トースト）、手動再同期オプション
- **データ競合**: last-write-wins、変更履歴保存

#### 監視
- **アプリケーション**: CloudWatch Metrics、Lambda関数エラー率、API応答時間
- **ビジネス**: 同期成功率、アクティブユーザー数、タスク完了率
- **分析（Phase 5以降）**: データパイプライン監視、dbt実行状況、分析クエリパフォーマンス、予測精度メトリクス

### セキュリティ設計

#### データ保護
- **保存時**: DynamoDB暗号化（AWS managed）、S3暗号化（SSE-S3）、DuckDB暗号化（Phase 5以降）
- **転送時**: HTTPS必須、WebSocket over TLS

#### 認証
- **MVP**: Basic認証 + API Key（単一ユーザー想定）
- **将来**: AWS Cognito、JWT tokens、MFA対応

#### APIセキュリティ
- CORS設定（特定オリジンのみ許可）
- Rate Limiting (API Gateway)
- Request validation

#### 機密データ
- Fitbit APIトークン: AWS Secrets Manager
- ユーザー認証情報: 暗号化保存
- 分析データ: 個人識別情報の匿名化

### パフォーマンス最適化

#### フロントエンド
- コード分割（dynamic imports）
- 画像最適化（Next.js Image）
- 仮想スクロール（大量タスク表示）
- Service Workerキャッシュ

#### バックエンド
- Lambda コールドスタート最適化
- DynamoDB読み取り/書き込み容量調整
- バッチ処理による効率化

#### データ
- ページネーション（20件/ページ）
- 必要なフィールドのみ取得
- IndexedDB定期クリーンアップ

#### 分析（Phase 5以降）
- DuckDBクエリ最適化
- 分析結果キャッシュ（Redis）
- 増分更新による高速化
- 非同期バックグラウンド処理

---

## Fitbit連携仕様

### データ取得仕様
- **認証方法**: OAuth 2.0
- **トークン保存**: AWS Secrets Manager
- **リフレッシュ戦略**: 自動更新（期限1時間前）

### データ収集
- **スケジュール**: 毎日06:00 JST、前日分のみ
- **エンドポイント**:
  - sleep: `/1.2/user/-/sleep/date/{yesterday}.json`
    - 取得フィールド: summary.totalMinutesAsleep, summary.stages
  - activity: `/1.2/user/-/activities/date/{yesterday}.json`
    - 取得フィールド: summary.steps, summary.activeMinutes

### エラーハンドリング
- **API制限超過**: 翌日まで待機
- **認証エラー**: トークンリフレッシュ
- **データ未取得**: NULL値として保存

### ストレージ
- **生データ**: S3（JSONバックアップ）
- **処理済みデータ**: DynamoDB（DailyCondition）
- **分析データ**: DuckDB（Phase 5以降）

---

## 開発優先度

### Phase 1（Week 1）: 基盤構築
1. **プロジェクト基盤**
   - Next.js + TypeScript セットアップ
   - 基本的なルーティング
   - shadcn/ui 導入
   - 将来のマルチユーザー対応を考慮した設計

2. **データ層実装**
   - IndexedDB（Dexie）セットアップ
   - 基本的なRepository パターン実装
   - 同期キュー設計

3. **認証基盤**
   - 単一ユーザー用のBasic認証
   - APIキー管理
   - 将来の拡張を考慮した認証レイヤー

### Phase 2（Week 2）: コア機能実装
1. **プロジェクト・タスク管理**
   - CRUD機能実装
   - オフライン対応
   - 楽観的更新

2. **タイマー・実行機能**
   - タイマー実装（オフライン対応）
   - 実行記録保存
   - 予実差分計算・色分け表示

3. **基本的な同期機能**
   - オンライン検知
   - 同期キュー処理
   - 競合解決（last-write-wins）

### Phase 3（Week 3）: スケジュール・外部連携
1. **スケジュール管理**
   - 週間カレンダー実装
   - ドラッグ&ドロップ機能
   - リスケジュール機能

2. **Fitbit連携**
   - OAuth認証実装
   - 前日データ取得（6時定期実行）
   - エラーハンドリング

3. **レポート基本機能**
   - 週次サマリー
   - 予実差分グラフ（色分け）
   - データエクスポート

### Phase 4（Final Days）: 品質向上・デプロイ
1. **UX改善**
   - エラーハンドリング強化
   - ローディング状態改善
   - オフライン時のフィードバック

2. **パフォーマンス最適化**
   - バンドルサイズ削減
   - 初回ロード時間改善
   - キャッシュ戦略実装

3. **デプロイ・運用準備**
   - AWS環境構築
   - CI/CD設定
   - 監視・ログ設定

### Phase 5（MVP後1ヶ月）: 分析基盤構築
1. **データパイプライン基盤**
   - DynamoDB → S3 日次エクスポート自動化
   - dbt環境構築・基本モデル作成
   - DuckDB分析環境セットアップ
   - 基本的な集計テーブル実装

2. **分析ダッシュボード基盤**
   - 分析用API実装
   - 基本的な可視化コンポーネント
   - 週次/月次レポート自動生成

3. **運用体制構築**
   - データ品質監視
   - パイプライン障害対応
   - 分析結果検証プロセス

### Phase 6（MVP後3ヶ月）: 高度な分析機能
1. **予測・最適化機能**
   - 燃え尽きリスク予測モデル
   - 最適作業時間レコメンデーション
   - プロジェクト完了予測
   - 生産性向上提案アルゴリズム

2. **高度な分析レポート**
   - 長期トレンド分析
   - 季節性パターン検出
   - パフォーマンス最適化レポート
   - カスタム分析ダッシュボード

3. **機械学習統合**
   - 個人化アルゴリズム
   - 異常検知システム
   - 予測精度継続改善

### Phase 7（MVP後6ヶ月）: AI統合・SaaS化
1. **AI レコメンデーション**
   - 個人化されたスケジュール提案
   - 動的な休憩時間調整
   - コンディション予測アラート
   - 自動タスク優先度調整

2. **マルチユーザー対応**
   - チーム機能
   - 有料プラン設計
   - API公開
   - サードパーティ連携

3. **SaaS本格展開**
   - マーケティング自動化
   - カスタマーサクセス
   - スケーラビリティ対応

---

## 成功指標

### 技術指標
- 初回ロード時間 < 1秒
- 操作応答時間 < 100ms
- オフライン→オンライン同期成功率 > 98%
- Fitbit前日データ取得成功率 > 95%

### UX指標
- タスク作成から実行開始まで < 30秒
- スケジュール調整操作が直感的
- データ紛失ゼロ（オフライン対応）
- 予実差分の視覚的認識 < 1秒

### 機能指標
- プロジェクト→WBS→スケジュール→実行の一連フロー完動
- 実績データの正確な記録・集計
- 予実差分の色分け表示による即座の状況把握
- 前日の睡眠・歩数データの確実な反映

### 分析指標（Phase 5以降）
- データパイプライン実行成功率 > 99%
- 分析クエリ応答時間 < 5秒
- 燃え尽き予測精度 > 80%
- レコメンデーション採用率 > 60%

### 将来性指標
- マルチユーザー化への移行容易性
- データ構造の拡張性
- API設計の汎用性
- 機械学習モデルの継続改善性

---

## リスク・制約事項

### 技術リスク
- **Fitbit API**: API制限（150リクエスト/時）→ 前日データのみ1日1回取得で十分
- **IndexedDB**: ブラウザ間の実装差異 → Dexieによる抽象化、主要ブラウザテスト
- **オフライン同期**: データ競合、同期失敗 → last-write-wins、再試行機能
- **分析基盤（Phase 5以降）**: DuckDB の本番運用実績不足 → PostgreSQL への移行可能性を考慮した設計

### 開発リスク
- **短期間開発（20日）**: MVP機能の厳密な絞り込み、段階的リリース計画
- **個人開発**: 既存ライブラリの積極活用、コード品質より動作優先
- **分析機能の複雑性（Phase 5以降）**: 段階的な機能追加、外部専門家との連携検討

### 運用リスク
- **将来のマルチユーザー化**: 初期設計で考慮済み、データ構造にuser_id含む
- **スケーラビリティ**: サーバーレス採用、必要に応じたリソース調整
- **データプライバシー（分析機能）**: 個人識別情報の匿名化、GDPR準拠の設計

---

## 今後の拡張計画

### Phase 5（MVP後1ヶ月）: 分析基盤構築
- dbt + DuckDB データパイプライン構築
- 基本的な分析ダッシュボード
- 生産性指標の可視化
- 睡眠と生産性の相関分析

### Phase 6（MVP後3ヶ月）: 高度な分析・予測
- 燃え尽きリスク予測モデル
- 最適作業時間レコメンデーション
- 長期トレンド分析
- カスタム分析レポート

### Phase 7（MVP後6ヶ月）: AI統合・SaaS化
- 個人化されたAIレコメンデーション
- マルチユーザー対応
- チーム機能
- 有料プラン設計

### Phase 8（MVP後1年）: プラットフォーム化
- API公開
- サードパーティ連携
- プラグインシステム
- 企業版機能

---

## 分析機能詳細仕様（Phase 5以降）

### dbt変換処理

#### Stagingレイヤー
- **stg_work_sessions**: 作業記録の基本クリーニング
  - 変換処理: 時間データの正規化、異常値の除外、欠損値補完
- **stg_daily_conditions**: 日次コンディション正規化
  - 変換処理: Fitbitデータとの結合、睡眠品質カテゴリ化、エネルギーレベル正規化

#### Intermediateレイヤー
- **int_daily_productivity**: 日次生産性指標計算
  - メトリクス: セッション数、総作業時間、平均集中力、生産性スコア
- **int_weekly_patterns**: 週次パターン分析
  - 特徴量: 曜日別傾向、週内変動、作業時間分布

#### Martsレイヤー
- **productivity_metrics**: 総合生産性分析
  - 粒度: 日次
  - ディメンション: [user_id, date, day_of_week]
  - メジャー: [productivity_score, focus_level, work_duration]
- **burnout_indicators**: 燃え尽きリスク分析
  - 粒度: 週次
  - リスク要因: 過労指標、集中力低下、睡眠不足、ストレスレベル

### 機械学習パイプライン

#### 特徴量エンジニアリング
- **時系列特徴量**: 移動平均（3日、7日、30日）、曜日・月・季節性、前日からの変化率
- **行動特徴量**: 作業時間の安定性、集中力の変動、休憩パターン
- **コンテキスト特徴量**: 睡眠時間、歩数、天気データ（外部API）

#### モデル
- **燃え尽き予測**: Gradient Boosting、ターゲット：燃え尽きリスク（0-1）、特徴量：過去2週間の行動データ、更新頻度：週次
- **最適スケジュール**: Collaborative Filtering、ターゲット：時間帯別生産性、特徴量：個人履歴+類似ユーザー、更新頻度：月次
- **異常検知**: Isolation Forest、ターゲット：異常な行動パターン、特徴量：日次活動指標、更新頻度：日次

### レコメンデーション仕様

#### スケジュール最適化
- **入力**: 今週の予定タスク
- **出力**: 最適な時間配置
- **ロジック**: 過去の時間帯別パフォーマンス、タスクの複雑性、予想される集中力レベル

#### 休憩提案
- **入力**: 現在の作業状況
- **出力**: 休憩タイミングと長さ
- **ロジック**: 連続作業時間、集中力の低下傾向、過去の効果的な休憩パターン

#### 作業量調整
- **入力**: 今週の作業量と体調
- **出力**: 作業量調整提案
- **ロジック**: 燃え尽きリスクスコア、過去の持続可能なペース、目標達成とのバランス

---

## 関連技術ドキュメント

### 参考資料
- [DynamoDB設計パターン](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [dbt公式ドキュメント](https://docs.getdbt.com/)
- [DuckDB公式ドキュメント](https://duckdb.org/docs/)
- [Fitbit Web API](https://dev.fitbit.com/build/reference/web-api/)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Next.js App Router](https://nextjs.org/docs/app)

### アーキテクチャ参考
- [Lambda Architecture](http://lambda-architecture.net/)
- [Data Mesh原則](https://martinfowler.com/articles/data-mesh-principles.html)
- [Event-Driven Architecture](https://microservices.io/patterns/data/event-driven-architecture.html)

---

**最終更新**: 2025年7月8日
**バージョン**: 1.0.0
**作成者**: moderation-craft開発チーム
