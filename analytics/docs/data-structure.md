# ModerationCraft Analytics データ構造リファレンス

## 目次
1. [アーキテクチャ概要](#アーキテクチャ概要)
2. [Staging層](#staging層)
3. [Intermediate層](#intermediate層)
4. [Mart層](#mart層)
5. [新規Martテーブル作成ガイド](#新規martテーブル作成ガイド)
6. [データアクセスパターン](#データアクセスパターン)

## アーキテクチャ概要

### データフロー
```
S3 (Raw Data)
    ├── Fitbit API データ
    │   ├── 睡眠データ (JSON)
    │   └── 活動データ (JSON)
    └── DynamoDB エクスポート
        └── 作業セッション (Parquet)
            ↓
    dbt (データ変換)
        ├── Staging層 (クレンジング)
        ├── Intermediate層 (集約・計算)
        └── Mart層 (ビジネスロジック)
            ↓
    DuckDB (分析エンジン)
            ↓
    Streamlit (可視化)
```

### 処理の特徴
- **増分更新**: Incrementalマテリアライゼーション対応
- **データ品質**: 各層でデータ品質チェック実装
- **タイムゾーン**: JST対応（Asia/Tokyo）
- **モックデータ**: デモ用データ自動生成機能

## Staging層

### stg_fitbit_sleep_json
**概要**: Fitbit睡眠データのクレンジングと基本的な変換

| カラム名 | データ型 | 説明 | 値の範囲/制約 |
|---------|---------|------|--------------|
| id | VARCHAR | 主キー (MD5ハッシュ) | NOT NULL, UNIQUE |
| user_id | VARCHAR | ユーザーID | デフォルト: 'default_user' |
| sleep_date | DATE | 睡眠日 | NOT NULL |
| total_sleep_minutes | INTEGER | 総睡眠時間（分） | 0-1440 |
| total_sleep_hours | DECIMAL(5,2) | 総睡眠時間（時間） | 派生: total_sleep_minutes/60 |
| sleep_efficiency | DECIMAL(5,2) | 睡眠効率（%） | 0-100 |
| minutes_asleep | INTEGER | 実睡眠時間（分） | 0-1440 |
| minutes_awake | INTEGER | 覚醒時間（分） | 0-1440 |
| time_in_bed | INTEGER | ベッドにいた時間（分） | 0-1440 |
| deep_sleep_minutes | INTEGER | 深い睡眠（分） | 0-600 |
| deep_sleep_percent | DECIMAL(5,2) | 深い睡眠の割合（%） | 派生計算 |
| light_sleep_minutes | INTEGER | 軽い睡眠（分） | 0-600 |
| light_sleep_percent | DECIMAL(5,2) | 軽い睡眠の割合（%） | 派生計算 |
| rem_sleep_minutes | INTEGER | REM睡眠（分） | 0-300 |
| rem_sleep_percent | DECIMAL(5,2) | REM睡眠の割合（%） | 派生計算 |
| wake_minutes | INTEGER | 覚醒時間（分） | 0-180 |
| sleep_start_time | TIMESTAMP | 就寝時刻 | |
| sleep_end_time | TIMESTAMP | 起床時刻 | |
| sleep_quality_category | VARCHAR | 睡眠品質カテゴリ | 'good', 'fair', 'poor' |
| sleep_duration_category | VARCHAR | 睡眠時間カテゴリ | 'optimal', 'short', 'long', 'very_short' |
| fetched_at | TIMESTAMP | データ取得時刻 | |
| source_file | VARCHAR | ソースファイルパス | |
| processed_at | TIMESTAMP | 処理時刻 | JST |

**睡眠品質カテゴリの判定ロジック**:
- good: 睡眠効率 ≥ 85%
- fair: 睡眠効率 75-84%
- poor: 睡眠効率 < 75%

**睡眠時間カテゴリの判定ロジック**:
- optimal: 7-9時間
- short: 6-7時間
- long: 9時間以上
- very_short: 6時間未満

### stg_fitbit_activity_json
**概要**: Fitbit活動データのクレンジングと基本的な変換

| カラム名 | データ型 | 説明 | 値の範囲/制約 |
|---------|---------|------|--------------|
| id | VARCHAR | 主キー (MD5ハッシュ) | NOT NULL, UNIQUE |
| user_id | VARCHAR | ユーザーID | デフォルト: 'default_user' |
| activity_date | DATE | 活動日 | NOT NULL |
| steps | INTEGER | 歩数 | 0-50000 |
| distance_km | DECIMAL(10,3) | 移動距離（km） | 0-50 |
| calories_burned | INTEGER | 消費カロリー | 0-5000 |
| activity_calories | INTEGER | 活動カロリー | 0-3000 |
| very_active_minutes | INTEGER | 高強度活動（分） | 0-300 |
| fairly_active_minutes | INTEGER | 中強度活動（分） | 0-300 |
| lightly_active_minutes | INTEGER | 低強度活動（分） | 0-600 |
| sedentary_minutes | INTEGER | 座位時間（分） | 0-1440 |
| total_active_minutes | INTEGER | 総活動時間（分） | 派生計算 |
| total_active_hours | DECIMAL(5,2) | 総活動時間（時間） | 派生計算 |
| sedentary_hours | DECIMAL(5,2) | 座位時間（時間） | 派生計算 |
| activity_level | VARCHAR | 活動レベル | 'excellent', 'good', 'fair', 'low' |
| primary_activity_type | VARCHAR | 主要活動タイプ | 'high_intensity', 'moderate_intensity', 'light_intensity', 'sedentary' |
| fetched_at | TIMESTAMP | データ取得時刻 | |
| source_file | VARCHAR | ソースファイルパス | |
| processed_at | TIMESTAMP | 処理時刻 | JST |

**活動レベルの判定ロジック**:
- excellent: 歩数 ≥ 10,000
- good: 歩数 7,500-9,999
- fair: 歩数 5,000-7,499
- low: 歩数 < 5,000

### stg_work_sessions
**概要**: DynamoDBからの作業セッションデータ

| カラム名 | データ型 | 説明 | 値の範囲/制約 |
|---------|---------|------|--------------|
| session_id | VARCHAR | セッションID | PRIMARY KEY |
| user_id | VARCHAR | ユーザーID | NOT NULL |
| project_id | VARCHAR | プロジェクトID | |
| small_task_id | VARCHAR | タスクID | |
| session_date | DATE | セッション日 | NOT NULL |
| start_time | TIMESTAMP | 開始時刻 | NOT NULL |
| end_time | TIMESTAMP | 終了時刻 | NOT NULL |
| start_time_jst | TIMESTAMP | 開始時刻（JST） | |
| end_time_jst | TIMESTAMP | 終了時刻（JST） | |
| duration_minutes | DECIMAL | セッション時間（分） | 0-480 |
| mood_rating | INTEGER | 気分評価 | 1-5 |
| dopamine_level | INTEGER | ドーパミンレベル | 1-5 |
| notes | TEXT | メモ | |
| time_slot | VARCHAR | 時間帯 | 'early_morning', 'morning', 'late_morning', 'afternoon', 'late_afternoon', 'evening', 'night' |
| day_of_week | VARCHAR | 曜日 | |
| session_productivity_score | INTEGER | セッション生産性スコア | 40-100 |
| created_at | TIMESTAMP | 作成時刻 | |
| updated_at | TIMESTAMP | 更新時刻 | |
| source_file | VARCHAR | ソースファイルパス | |
| processed_at | TIMESTAMP | 処理時刻 | JST |

**時間帯の判定ロジック**:
- early_morning: 6時前
- morning: 6-9時
- late_morning: 9-12時
- afternoon: 12-15時
- late_afternoon: 15-18時
- evening: 18-21時
- night: 21時以降

**セッション生産性スコアの計算**:
- 100点: 25-30分（完璧なポモドーロ）
- 80点: 20-35分
- 60点: 15-45分
- 40点: その他

## Intermediate層

### int_daily_health_summary
**概要**: 睡眠と活動データの日次集約

| カラム名 | データ型 | 説明 | 計算ロジック |
|---------|---------|------|------------|
| id | VARCHAR | 主キー | MD5(user_id::date) |
| user_id | VARCHAR | ユーザーID | |
| date | DATE | 日付 | |
| day_of_week | VARCHAR | 曜日 | |
| week_number | INTEGER | 週番号 | |
| month | INTEGER | 月 | |
| year | INTEGER | 年 | |
| total_sleep_hours | DECIMAL | 睡眠時間 | stg_fitbit_sleep_json |
| sleep_efficiency | DECIMAL | 睡眠効率 | stg_fitbit_sleep_json |
| deep_sleep_percent | DECIMAL | 深い睡眠% | stg_fitbit_sleep_json |
| rem_sleep_percent | DECIMAL | REM睡眠% | stg_fitbit_sleep_json |
| light_sleep_percent | DECIMAL | 軽い睡眠% | stg_fitbit_sleep_json |
| sleep_quality_category | VARCHAR | 睡眠品質 | stg_fitbit_sleep_json |
| sleep_duration_category | VARCHAR | 睡眠時間カテゴリ | stg_fitbit_sleep_json |
| steps | INTEGER | 歩数 | stg_fitbit_activity_json |
| distance_km | DECIMAL | 移動距離 | stg_fitbit_activity_json |
| calories_burned | INTEGER | 消費カロリー | stg_fitbit_activity_json |
| total_active_minutes | INTEGER | 活動時間 | stg_fitbit_activity_json |
| sedentary_minutes | INTEGER | 座位時間 | stg_fitbit_activity_json |
| activity_level | VARCHAR | 活動レベル | stg_fitbit_activity_json |
| primary_activity_type | VARCHAR | 主要活動タイプ | stg_fitbit_activity_json |
| sleep_score | DECIMAL | 睡眠スコア | 計算式参照 |
| activity_score | DECIMAL | 活動スコア | 計算式参照 |
| overall_health_score | DECIMAL | 総合健康スコア | (sleep_score + activity_score) / 2 |
| has_complete_data | BOOLEAN | データ完全性 | 睡眠と活動データの両方が存在 |
| calculated_at | TIMESTAMP | 計算時刻 | |

**睡眠スコア計算式**（100点満点）:
- 睡眠時間: 30点（8時間で満点）
- 睡眠効率: 30点（100%で満点）
- 深い睡眠: 20点（20%で満点）
- REM睡眠: 20点（25%で満点）

**活動スコア計算式**（100点満点）:
- 歩数: 40点（10,000歩で満点）
- アクティブ時間: 30点（30分で満点）
- カロリー消費: 30点（2,000kcalで満点）

### int_productivity_metrics
**概要**: 作業セッションの日次生産性メトリクス

| カラム名 | データ型 | 説明 | 計算ロジック |
|---------|---------|------|------------|
| id | VARCHAR | 主キー | MD5(user_id::date) |
| user_id | VARCHAR | ユーザーID | |
| date | DATE | 日付 | |
| day_of_week | VARCHAR | 曜日 | |
| week_number | INTEGER | 週番号 | |
| month | INTEGER | 月 | |
| year | INTEGER | 年 | |
| total_sessions | INTEGER | 総セッション数 | COUNT(DISTINCT session_id) |
| projects_worked | INTEGER | 作業プロジェクト数 | COUNT(DISTINCT project_id) |
| tasks_worked | INTEGER | 作業タスク数 | COUNT(DISTINCT small_task_id) |
| total_work_minutes | DECIMAL | 総作業時間（分） | SUM(duration_minutes) |
| total_work_hours | DECIMAL | 総作業時間（時間） | total_work_minutes / 60 |
| avg_session_duration | DECIMAL | 平均セッション時間 | AVG(duration_minutes) |
| max_session_duration | DECIMAL | 最長セッション時間 | MAX(duration_minutes) |
| min_session_duration | DECIMAL | 最短セッション時間 | MIN(duration_minutes) |
| avg_mood | DECIMAL | 平均気分 | AVG(mood_rating) |
| avg_dopamine | DECIMAL | 平均ドーパミン | AVG(dopamine_level) |
| morning_sessions | INTEGER | 朝のセッション数 | |
| afternoon_sessions | INTEGER | 午後のセッション数 | |
| evening_sessions | INTEGER | 夕方のセッション数 | |
| night_sessions | INTEGER | 夜のセッション数 | |
| most_productive_time_slot | VARCHAR | 最多作業時間帯 | MODE(time_slot) |
| pomodoro_sessions | INTEGER | ポモドーロ準拠セッション | 20-30分のセッション数 |
| pomodoro_compliance_rate | DECIMAL | ポモドーロ準拠率 | pomodoro_sessions / total_sessions * 100 |
| first_session_start | TIMESTAMP | 最初のセッション開始 | MIN(start_time_jst) |
| last_session_end | TIMESTAMP | 最後のセッション終了 | MAX(end_time_jst) |
| work_span_hours | INTEGER | 作業時間帯の広がり | 最後-最初の時間差 |
| estimated_break_minutes | DECIMAL | 推定休憩時間 | 全体時間 - 実作業時間 |
| avg_session_productivity | DECIMAL | 平均セッション生産性 | AVG(session_productivity_score) |
| focus_score | DECIMAL | 集中度スコア | 作業密度の計算 |
| overall_productivity_score | DECIMAL | 総合生産性スコア | 計算式参照 |
| data_quality | VARCHAR | データ品質 | 'high', 'medium', 'low' |
| calculated_at | TIMESTAMP | 計算時刻 | |

**総合生産性スコア計算式**（100点満点）:
- セッション生産性: 40%
- ポモドーロ準拠率: 30%
- 作業時間: 30%（8時間で満点）

**データ品質判定**:
- high: 5セッション以上
- medium: 3-4セッション
- low: 2セッション以下

## Mart層

### mart_productivity_daily
**概要**: 健康と生産性の統合日次ビュー

| カラム名 | データ型 | 説明 | ソース |
|---------|---------|------|--------|
| id | VARCHAR | 主キー | MD5(user_id::date) |
| user_id | VARCHAR | ユーザーID | |
| date | DATE | 日付 | |
| day_of_week | VARCHAR | 曜日 | |
| week_number | INTEGER | 週番号 | |
| month | INTEGER | 月 | |
| year | INTEGER | 年 | |
| quarter | INTEGER | 四半期 | |
| sleep_score | DECIMAL | 睡眠スコア | int_daily_health_summary |
| activity_score | DECIMAL | 活動スコア | int_daily_health_summary |
| health_score | DECIMAL | 健康スコア | int_daily_health_summary |
| sleep_hours | DECIMAL | 睡眠時間 | int_daily_health_summary |
| sleep_quality_category | VARCHAR | 睡眠品質 | int_daily_health_summary |
| steps | INTEGER | 歩数 | int_daily_health_summary |
| activity_level | VARCHAR | 活動レベル | int_daily_health_summary |
| work_sessions | INTEGER | 作業セッション数 | int_productivity_metrics |
| work_hours | DECIMAL | 作業時間 | int_productivity_metrics |
| avg_session_duration | DECIMAL | 平均セッション時間 | int_productivity_metrics |
| pomodoro_rate | DECIMAL | ポモドーロ準拠率 | int_productivity_metrics |
| productivity_score | DECIMAL | 生産性スコア | int_productivity_metrics |
| focus_score | DECIMAL | 集中度スコア | int_productivity_metrics |
| mood_level | DECIMAL | 気分レベル | int_productivity_metrics |
| dopamine_level | DECIMAL | ドーパミンレベル | int_productivity_metrics |
| most_productive_time_slot | VARCHAR | 最多作業時間帯 | int_productivity_metrics |
| wellness_productivity_index | DECIMAL | 複合指標 | 計算式参照 |
| performance_category | VARCHAR | パフォーマンスカテゴリ | 判定ロジック参照 |
| data_completeness | VARCHAR | データ完全性 | 'complete', 'partial', 'incomplete' |
| calculated_at | TIMESTAMP | 計算時刻 | |

**wellness_productivity_index計算式**:
- 健康スコア: 30%
- 生産性スコア: 50%
- 気分レベル: 20%

**performance_categoryの判定**:
- optimal: 生産性≥80 AND 健康≥80
- balanced: 生産性≥60 AND 健康≥60
- overworked: 生産性≥80 AND 健康<60
- underutilized: 生産性<60 AND 健康≥80
- needs_attention: その他

### mart_wellness_correlation
**概要**: 健康と生産性の相関分析用マート

| カラム名 | データ型 | 説明 | 計算ロジック |
|---------|---------|------|------------|
| id | VARCHAR | 主キー | MD5(user_id::date) |
| user_id | VARCHAR | ユーザーID | |
| date | DATE | 日付 | |
| day_of_week | VARCHAR | 曜日 | |
| week_number | INTEGER | 週番号 | |
| month | INTEGER | 月 | |
| year | INTEGER | 年 | |
| sleep_score | DECIMAL | 睡眠スコア | mart_productivity_daily |
| activity_score | DECIMAL | 活動スコア | mart_productivity_daily |
| health_score | DECIMAL | 健康スコア | mart_productivity_daily |
| productivity_score | DECIMAL | 生産性スコア | mart_productivity_daily |
| mood_level | DECIMAL | 気分レベル | mart_productivity_daily |
| dopamine_level | DECIMAL | ドーパミンレベル | mart_productivity_daily |
| sleep_change | DECIMAL | 睡眠スコア変化 | 前日比 |
| productivity_change | DECIMAL | 生産性スコア変化 | 前日比 |
| mood_change | DECIMAL | 気分変化 | 前日比 |
| sleep_7d_avg | DECIMAL | 睡眠7日移動平均 | 7日間の平均 |
| activity_7d_avg | DECIMAL | 活動7日移動平均 | 7日間の平均 |
| productivity_7d_avg | DECIMAL | 生産性7日移動平均 | 7日間の平均 |
| sleep_trend | DECIMAL | 睡眠トレンド | 現在値 - 7日平均 |
| productivity_trend | DECIMAL | 生産性トレンド | 現在値 - 7日平均 |
| correlation_pattern | VARCHAR | 相関パターン | 判定ロジック参照 |
| sleep_impact_on_productivity | VARCHAR | 睡眠の生産性への影響 | 判定ロジック参照 |
| weekly_performance | VARCHAR | 週間パフォーマンス | 判定ロジック参照 |
| significant_change | BOOLEAN | 大幅な変化フラグ | 変化量>20 |
| needs_intervention | BOOLEAN | 介入必要フラグ | トレンド<-10 |
| calculated_at | TIMESTAMP | 計算時刻 | |

**correlation_patternの判定**:
- both_improving: 睡眠↑ AND 生産性↑
- both_declining: 睡眠↓ AND 生産性↓
- sleep_up_productivity_down: 睡眠↑ AND 生産性↓
- sleep_down_productivity_up: 睡眠↓ AND 生産性↑
- stable: 変化が小さい

**weekly_performanceの判定**:
- excellent_week: 7日平均が両方80以上
- good_week: 7日平均が両方60以上
- challenging_week: その他

## 新規Martテーブル作成ガイド

### 基本テンプレート

```sql
-- models/marts/mart_[テーブル名].sql
{{ config(
    materialized='table',  -- または 'incremental'
    unique_key='id'
) }}

WITH base_data AS (
    -- 既存のmartまたはintermediate層から取得
    SELECT * FROM {{ ref('mart_productivity_daily') }}
    WHERE date >= {{ days_ago(90) }}  -- マクロ使用例
),

aggregated AS (
    -- 必要な集計処理
    SELECT
        user_id,
        DATE_TRUNC('week', date) AS week,
        AVG(productivity_score) AS avg_productivity,
        AVG(health_score) AS avg_health
    FROM base_data
    GROUP BY user_id, DATE_TRUNC('week', date)
)

SELECT
    MD5(CONCAT(user_id, '::', week)) AS id,  -- 主キー生成
    user_id,
    week,
    avg_productivity,
    avg_health,
    -- 派生メトリクス
    CASE
        WHEN avg_productivity >= 80 THEN 'high'
        WHEN avg_productivity >= 60 THEN 'medium'
        ELSE 'low'
    END AS productivity_level,
    {{ get_jst_timestamp() }} AS calculated_at  -- マクロ使用
FROM aggregated
```

### 利用可能なマクロ

```sql
-- 日付関連
{{ days_ago(n) }}  -- n日前の日付
{{ get_jst_timestamp() }}  -- 現在時刻（JST）

-- データ品質
{{ test_not_null('column_name') }}
{{ test_unique('column_name') }}
```

### 新規Mart作成手順

1. **要件定義**
   - 必要なメトリクスを明確化
   - データソースの特定
   - 更新頻度の決定

2. **SQLファイル作成**
   ```bash
   touch dbt-moderation-craft/moderation_craft/models/marts/mart_[名前].sql
   ```

3. **スキーマ定義（オプション）**
   ```yaml
   # models/marts/schema.yml
   models:
     - name: mart_[名前]
       description: "テーブルの説明"
       columns:
         - name: id
           description: "主キー"
           tests:
             - unique
             - not_null
   ```

4. **dbt実行**
   ```bash
   cd dbt-moderation-craft/moderation_craft
   dbt run --select mart_[名前]
   ```

## データアクセスパターン

### Streamlitからのアクセス

#### 基本的なクエリ実行
```python
from utils.database import get_connection, run_query

# シンプルなクエリ
df = run_query("SELECT * FROM mart_productivity_daily WHERE date >= CURRENT_DATE - 30")

# パラメータ付きクエリ
days = 30
query = f"""
    SELECT 
        date,
        productivity_score,
        health_score
    FROM mart_productivity_daily
    WHERE date >= CURRENT_DATE - {days}
    ORDER BY date DESC
"""
df = run_query(query)
```

#### キャッシュ付きデータ取得
```python
import streamlit as st

@st.cache_data(ttl=300)  # 5分間キャッシュ
def load_productivity_data(days: int):
    query = f"""
        SELECT * FROM mart_productivity_daily
        WHERE date >= CURRENT_DATE - {days}
    """
    return run_query(query)

# 使用例
df = load_productivity_data(30)
```

### 新規Streamlitページ作成

#### ファイル構造
```
analytics/
├── pages/
│   └── 4_📈_[新機能名].py  # 番号とアイコンを含める
```

#### ページテンプレート
```python
"""
[機能名]ページ
[説明]
"""
import streamlit as st
import pandas as pd
import plotly.express as px
from datetime import datetime
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils.database import run_query

# ページ設定
st.set_page_config(
    page_title="[タイトル] - ModerationCraft",
    page_icon="📈",
    layout="wide"
)

st.title("📈 [タイトル]")
st.markdown("[説明文]")

# データ取得
@st.cache_data(ttl=300)
def load_data():
    query = """
        SELECT * FROM mart_[テーブル名]
        WHERE date >= CURRENT_DATE - 30
    """
    return run_query(query)

df = load_data()

if not df.empty:
    # 可視化
    fig = px.line(
        df,
        x='date',
        y='metric',
        title="タイトル",
        template="plotly_white"  # ライトテーマ
    )
    st.plotly_chart(fig, use_container_width=True)
else:
    st.error("データが見つかりません")
```

### データ可視化のベストプラクティス

#### カラーパレット（ライトテーマ用）
```python
colors = {
    'primary': '#FF6B6B',
    'secondary': '#4ECDC4',
    'tertiary': '#45B7D1',
    'success': '#2ECC71',
    'warning': '#F39C12',
    'danger': '#E74C3C',
    'info': '#3498DB'
}
```

#### グラフテンプレート
```python
# 時系列グラフ
fig = px.line(
    df,
    x='date',
    y=['productivity_score', 'health_score'],
    title="スコアの推移",
    template="plotly_white",
    color_discrete_sequence=[colors['primary'], colors['secondary']]
)

# 相関散布図
fig = px.scatter(
    df,
    x='health_score',
    y='productivity_score',
    color='work_hours',
    size='work_hours',
    template="plotly_white",
    trendline="ols"
)

# ヒートマップ
fig = go.Figure(data=go.Heatmap(
    z=corr_matrix.values,
    x=corr_matrix.columns,
    y=corr_matrix.columns,
    colorscale='RdBu',
    zmid=0
))
```

## トラブルシューティング

### よくある問題と解決方法

#### DuckDBファイルロック
```python
# 読み取り専用モードで接続
conn = duckdb.connect(db_path, read_only=True)
```

#### データが見つからない
```python
# モックデータを自動生成
from utils.mock_data import setup_mock_database
if df.empty:
    setup_mock_database(conn)
    df = run_query(query)
```

#### パフォーマンス最適化
```python
# インデックスを活用
WHERE date >= CURRENT_DATE - 30  # 日付でフィルタ
LIMIT 1000  # 必要な行数のみ取得
```

## 参考リンク

- [dbt Documentation](https://docs.getdbt.com/)
- [DuckDB Documentation](https://duckdb.org/docs/)
- [Streamlit Documentation](https://docs.streamlit.io/)
- [Plotly Documentation](https://plotly.com/python/)