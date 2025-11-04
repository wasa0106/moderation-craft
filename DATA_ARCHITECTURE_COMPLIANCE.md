# データアーキテクチャ遵守ガイド

## アーキテクチャ原則

ModerationCraftのデータアーキテクチャは**3層モデル**を採用しています：

```
Staging Layer (stg_*)
    ↓
Intermediate Layer (int_*)
    ↓
Marts Layer (marts/*)
    ├── Dimensions (dim_*)
    ├── Facts (fact_*)
    └── BI Marts (mart_*, agg_*)
```

## 🔒 **重要ルール：Streamlitアプリケーションは必ずBI Marts層のみを参照すること**

### 許可されているテーブル

Streamlitアプリ（`streamlit/`）は以下のテーブル**のみ**を参照できます：

- `main_gold.mart_*` - BI分析用マート
- `main_gold.agg_*` - 集計マート
- `main_dims.dim_*` - ディメンションテーブル（プロジェクト名取得など）

### 禁止されているテーブル

以下のテーブルへの**直接参照は禁止**です：

- ❌ `main_staging.stg_*` - ステージング層（生データ）
- ❌ `main_intermediate.int_*` - 中間層（ビジネスロジック適用中）
- ❌ `main_facts.fact_*` - ファクトテーブル（トランザクション粒度）

## 現在の遵守状況

### ✅ 完全遵守ファイル

| ファイル | 参照テーブル | ステータス |
|---------|------------|----------|
| `1_📊_Productivity.py` | `mart_productivity_daily` | ✅ 遵守 |
| `2_💤_Health.py` | `mart_wellness_correlation` | ✅ 遵守 |
| `4_😴_Sleep_Work_Analysis.py` | `mart_sleep_work_correlation`, `dim_project` | ✅ 遵守 |

### 🔍 例外（調査ツール）

| ファイル | 用途 | 理由 |
|---------|------|------|
| `3_🔍_Explorer.py` | SQL自由探索 | ユーザーが任意のSQLを実行可能 |
| `app.py` | データレイヤービューア | デバッグ・探索用UI |

## 利用可能なBI Marts一覧

### 生産性分析

- **`mart_productivity_daily`**: 日次生産性と健康の統合マート
  - 総作業時間、セッション数、ポモドーロ準拠率
  - 健康スコアとの統合
  - パフォーマンスカテゴリ分類

- **`agg_productivity_daily`**: 日次生産性メトリクス中間集計
  - fact_work_sessionsからの基本集計
  - データ品質評価

### 健康×生産性相関

- **`mart_wellness_correlation`**: 健康と生産性の相関分析
  - 睡眠・活動・生産性の関係分析
  - 週間パフォーマンストレンド
  - 相関パターン分類

- **`mart_sleep_work_correlation`**: 睡眠→作業生産性の因果分析
  - 前日の睡眠データと当日の作業時間を結合
  - LAG関数による時系列相関
  - 7日移動平均
  - 睡眠品質フラグ（最適睡眠、睡眠不足）

### タスク分析

- **`mart_task_performance`**: タスクパフォーマンス分析
  - 予定vs実績比較
  - 見積もり精度評価
  - 時間通り開始/完了フラグ

- **`mart_task_completion_analysis`**: タスク完了状況分析
  - 完了率、期限管理
  - 未完了タスク追跡
  - 完了確率予測

- **`mart_task_productivity`**: タスク生産性分析
  - セッションメトリクス
  - タスクタイプ別生産性
  - 集中度カテゴリ

## 新規分析ページ作成ガイド

### ステップ1: 必要なデータを特定

1. 分析に必要なメトリクスをリストアップ
2. 既存のBI Martsで要件を満たせるか確認
3. 不足している場合は新規Mart作成を検討

### ステップ2: 既存Martの確認

```bash
# 利用可能なMartsを確認
duckdb moderation_craft_dev.duckdb -c "SHOW TABLES FROM main_gold;"
duckdb moderation_craft_dev.duckdb -c "SHOW TABLES FROM main_dims;"

# Martの構造を確認
duckdb moderation_craft_dev.duckdb -c "DESCRIBE main_gold.mart_productivity_daily;"
```

### ステップ3: 新規Mart作成（必要な場合）

1. **dbtモデルを作成**: `dbt/models/marts/bi/mart_your_analysis.sql`
2. **ドキュメント追加**: `dbt/models/marts/_marts.yml`に定義追加
3. **ビルド実行**:
   ```bash
   cd dbt
   dbt run --select +mart_your_analysis
   dbt test --select mart_your_analysis
   ```

### ステップ4: Streamlitページ作成

```python
# ✅ 正しい例
query = """
SELECT *
FROM main_gold.mart_productivity_daily
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
"""

# ❌ 間違った例（禁止）
query = """
SELECT *
FROM main_staging.stg_fitbit_sleep_json  -- ❌ staging層を直接参照
WHERE sleep_date >= CURRENT_DATE - INTERVAL '30 days'
"""
```

## ベストプラクティス

### 1. ビジネスロジックはdbtに集約

❌ **悪い例（Streamlit内でビジネスロジック）**:
```python
# Streamlitで複雑な計算
df['sleep_category'] = df['sleep_hours'].apply(
    lambda x: '<6' if x < 6 else '6-7' if x < 7 else '7-8'
)
df['prev_sleep'] = df['sleep_hours'].shift(1)
```

✅ **良い例（dbtで事前計算）**:
```sql
-- dbt/models/marts/bi/mart_sleep_analysis.sql
SELECT
    date,
    sleep_hours,
    CASE
        WHEN sleep_hours < 6 THEN '<6'
        WHEN sleep_hours < 7 THEN '6-7'
        ELSE '7-8'
    END AS sleep_category,
    LAG(sleep_hours, 1) OVER (ORDER BY date) AS prev_sleep
FROM ...
```

### 2. プロジェクト名はdim_projectから取得

❌ **悪い例**:
```python
query = """
SELECT ws.*, p.project_name
FROM main_facts.fact_work_sessions ws
LEFT JOIN main_staging.stg_projects p ON ws.project_id = p.project_id
"""
```

✅ **良い例**:
```python
query = """
SELECT ws.*, dp.project_name
FROM main_gold.mart_productivity_daily ws
LEFT JOIN main_dims.dim_project dp ON ws.project_id = dp.project_id
"""
```

### 3. 移動平均はdbtで計算

❌ **悪い例（Streamlit内で計算）**:
```python
df['sleep_7d_avg'] = df['sleep_hours'].rolling(window=7).mean()
```

✅ **良い例（dbtで事前計算）**:
```sql
-- dbt/models/marts/bi/mart_with_trends.sql
SELECT
    *,
    AVG(sleep_hours) OVER (
        ORDER BY date
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) AS sleep_7d_avg
FROM ...
```

## トラブルシューティング

### 問題: 必要なデータがMartに存在しない

**解決策**:
1. 既存のMartを拡張するか、新規Mart作成
2. dbtモデルを修正
3. `dbt run --select +your_mart`で再ビルド

### 問題: staging層を参照したくなる

**理由**: Martに必要なデータが不足している証拠

**解決策**:
1. **問題の特定**: 何のデータが不足しているか
2. **Mart修正**: dbtモデルに必要なカラム/計算を追加
3. **再ビルド**: `dbt run --select +your_mart`

## アーキテクチャ遵守チェックリスト

新規Streamlitページ作成時は以下を確認：

- [ ] `main_staging.*`を参照していないか
- [ ] `main_intermediate.*`を参照していないか
- [ ] `main_facts.*`を直接参照していないか（Mart経由が正しい）
- [ ] ビジネスロジック（LAG、CASE文、移動平均等）がdbtに実装されているか
- [ ] プロジェクト名は`dim_project`から取得しているか
- [ ] 複雑な計算・集計はMart内で完結しているか

## まとめ

**アーキテクチャの意図**:
- **保守性**: ビジネスロジックをdbtに集約することで、変更が一箇所で完結
- **再利用性**: 一度作成したMartは他の分析でも利用可能
- **パフォーマンス**: 事前集計により、Streamlit側の処理を高速化
- **テスト可能性**: dbt testでデータ品質を保証

**3層アーキテクチャは無駄ではなく、むしろプロジェクトの成長に必須です。**

---

最終更新日: 2025-11-04
作成者: Claude (ModerationCraft Development Team)
