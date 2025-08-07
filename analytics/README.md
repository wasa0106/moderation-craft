# ModerationCraft Analytics Dashboard

Phase 3実装 - Streamlitによる分析ダッシュボード

## 🚀 クイックスタート

```bash
# 1. analyticsディレクトリに移動
cd analytics

# 2. 起動スクリプトを実行
./run.sh

# または手動で起動
pip install -r requirements.txt
streamlit run app.py
```

ブラウザで http://localhost:8501 にアクセス

## 📊 機能

### 1. メインダッシュボード
- KPIカード（生産性、健康、作業時間）
- トレンドグラフ
- 相関分析
- 週間パフォーマンスヒートマップ

### 2. 生産性分析ページ
- 時系列分析（日次/週次/月次）
- 時間帯別パフォーマンス
- ポモドーロテクニック分析
- インサイト生成

### 3. 健康相関ページ
- 相関係数マトリックス
- 散布図分析
- 時系列相関トレンド
- 最適値分析
- 改善提案

### 4. データ探索ページ
- SQLエディタ
- テーブル探索
- スキーマ情報表示
- データエクスポート

## 📁 ディレクトリ構造

```
analytics/
├── app.py                  # メインダッシュボード
├── pages/                  # マルチページアプリ
│   ├── 1_📊_Productivity.py
│   ├── 2_💤_Health.py
│   └── 3_🔍_Explorer.py
├── utils/                  # ユーティリティ
│   ├── database.py        # DB接続
│   └── mock_data.py       # モックデータ生成
├── .streamlit/
│   └── config.toml        # UI設定
├── requirements.txt       # 依存パッケージ
└── run.sh                # 起動スクリプト
```

## 🔧 設定

### データソース

1. **dbtのDuckDBファイル**（推奨）
   ```bash
   # dbtを実行してデータを準備
   cd ../dbt-moderation-craft/moderation_craft
   dbt run --profiles-dir="../"
   ```

2. **モックデータ**（デモ用）
   - DBファイルがない場合は自動的にモックデータを生成
   - 90日分のサンプルデータ

### 環境変数（オプション）

```bash
# AWS S3アクセス用（将来の拡張用）
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
```

## 📈 使い方

### 基本的な流れ

1. **メインダッシュボード**で全体像を把握
2. **生産性分析**で詳細なトレンドを確認
3. **健康相関**で睡眠と生産性の関係を分析
4. **データ探索**で自由にSQLクエリを実行

### SQLクエリ例

```sql
-- 過去30日の平均生産性
SELECT 
  AVG(productivity_score) as avg_productivity,
  AVG(health_score) as avg_health
FROM mart_productivity_daily
WHERE date >= CURRENT_DATE - INTERVAL '30 days';

-- 曜日別パフォーマンス
SELECT 
  EXTRACT(DOW FROM date) as day_of_week,
  AVG(productivity_score) as avg_score
FROM mart_productivity_daily
GROUP BY day_of_week
ORDER BY day_of_week;
```

## 🎨 カスタマイズ

### テーマ変更
`.streamlit/config.toml`を編集：
```toml
[theme]
primaryColor = "#FF6B6B"
backgroundColor = "#0E1117"
```

### ページ追加
`pages/`ディレクトリに新しいPythonファイルを追加：
```python
# pages/4_🎯_Custom.py
import streamlit as st
st.title("カスタムページ")
```

## 🚀 デプロイ

### Streamlit Cloud（無料）

1. GitHubにプッシュ
2. [share.streamlit.io](https://share.streamlit.io)でデプロイ
3. `analytics/app.py`を指定

### ローカル実行

```bash
streamlit run app.py --server.port 8501
```

## 🐛 トラブルシューティング

### よくある問題

1. **モジュールが見つからない**
   ```bash
   pip install -r requirements.txt
   ```

2. **DBファイルが見つからない**
   - モックデータが自動生成されます
   - またはdbtを実行してDBファイルを作成

3. **ポート競合**
   ```bash
   streamlit run app.py --server.port 8502
   ```

## 📚 関連ドキュメント

- [Phase 3 仕様書](../docs/data-pipeline/phase-3-analytics-foundation.md)
- [テストガイド](../docs/data-pipeline/testing-guide.md)
- [Streamlit公式ドキュメント](https://docs.streamlit.io)