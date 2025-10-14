"""
ModerationCraft Analytics Dashboard - dbtモデル表示版（実データ・ドキュメント形式対応）
"""
import streamlit as st
import pandas as pd
import json
from datetime import datetime
from utils.database import get_connection, run_query, get_available_tables

# ページ設定
st.set_page_config(
    page_title="ModerationCraft dbt Models",
    page_icon="📊",
    layout="wide"
)

# タイトル
st.title("📊 ModerationCraft dbt Models Viewer")
st.markdown("dbtで定義されたモデルのデータを表示します（JSON/表形式）")

# データベース接続
def initialize_database():
    """データベース接続を初期化"""
    conn = get_connection()
    tables = get_available_tables(conn)
    return conn, tables

# 初期化
conn, available_tables = initialize_database()

# モデルの説明（JSONテーブルとフラット化テーブルの両方を含む）
model_descriptions = {
    # 生JSONデータ（ドキュメント形式で表示）
    'main.stg_fitbit_sleep_json': 'Fitbit睡眠データ - 生JSON（Staging層）',
    'main.stg_fitbit_activity_json': 'Fitbit活動データ - 生JSON（Staging層）',

    # フラット化されたデータ（表形式で表示）
    'main_staging.stg_fitbit_sleep_json': 'Fitbit睡眠データ - フラット化（Staging層）',
    'main_staging.stg_fitbit_activity_json': 'Fitbit活動データ - フラット化（Staging層）',
    'main_staging.stg_work_sessions': '作業セッション（Staging層）',
    'main_intermediate.int_daily_health_summary': '日次健康サマリー - 全データ統合（Intermediate層）',
    'main_intermediate.int_productivity_metrics': '生産性メトリクス（Intermediate層）',
    'main_gold.mart_wellness_correlation': '健康相関分析（Mart層）',
    'main_gold.mart_productivity_daily': '日次生産性（Mart層）'
}

# JSONデータをドキュメント形式で表示する関数
def display_json_document(data_dict, metadata_dict, row_index, date_info=""):
    """JSONデータを見やすいドキュメント形式で表示"""
    with st.container():
        st.markdown(f"### 📄 Document {row_index + 1} {date_info}")
        st.markdown("---")

        col1, col2 = st.columns(2)

        with col1:
            st.markdown("#### 📋 Metadata")
            if metadata_dict:
                for key, value in metadata_dict.items():
                    if isinstance(value, (datetime, pd.Timestamp)):
                        value = value.strftime("%Y-%m-%d %H:%M:%S")
                    elif isinstance(value, dict):
                        value = f"{len(value)} items"
                    st.markdown(f"• **{key}**: {value}")

        with col2:
            st.markdown("#### 📊 Data Summary")
            if data_dict:
                # データの要約を表示
                if 'sleep' in data_dict:
                    sleep_data = data_dict['sleep']
                    if isinstance(sleep_data, list) and len(sleep_data) > 0:
                        sleep = sleep_data[0]
                        st.markdown("**Sleep Metrics:**")
                        if 'duration' in sleep:
                            duration_hours = sleep['duration'] / 3600000 if sleep['duration'] else 0
                            st.markdown(f"• Duration: {duration_hours:.1f} hours")
                        if 'efficiency' in sleep:
                            st.markdown(f"• Efficiency: {sleep['efficiency']}%")
                        if 'minutesAsleep' in sleep:
                            st.markdown(f"• Minutes Asleep: {sleep['minutesAsleep']}")
                elif 'activities' in data_dict:
                    st.markdown("**Activity Summary:**")
                    if 'summary' in data_dict and isinstance(data_dict['summary'], dict):
                        summary = data_dict['summary']
                        if 'steps' in summary:
                            st.markdown(f"• Steps: {summary['steps']:,}")
                        if 'caloriesOut' in summary:
                            st.markdown(f"• Calories: {summary['caloriesOut']:,}")

        # JSON詳細を折りたたみで表示
        with st.expander("🔍 View Full JSON"):
            col1_json, col2_json = st.columns(2)
            with col1_json:
                st.markdown("**Metadata:**")
                st.json(metadata_dict)
            with col2_json:
                st.markdown("**Data:**")
                st.json(data_dict)

        st.markdown("---")

# 利用可能なテーブルをデバッグ表示
with st.sidebar:
    st.header("📊 データベース情報")

    # 実際のテーブル一覧を取得して表示
    st.markdown("### 📋 実際のテーブル")
    if available_tables:
        # スキーマ付きテーブル名のリストを作成
        schema_tables = []
        try:
            schema_df = conn.execute("""
                SELECT table_schema || '.' || table_name as full_name
                FROM information_schema.tables
                WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
                ORDER BY table_schema, table_name
            """).df()
            schema_tables = schema_df['full_name'].tolist()
        except:
            schema_tables = available_tables

        for table in schema_tables:
            status = "✅" if table in model_descriptions else "❓"
            st.markdown(f"{status} `{table}`")
        st.success(f"合計 {len(schema_tables)} テーブル")
    else:
        st.warning("テーブルが見つかりません")

    st.markdown("---")
    st.markdown("### データ層の説明")
    st.markdown("""
    **main.**: 生JSONデータ（S3から直接）
    **main_staging**: フラット化されたデータ
    **main_intermediate**: ビジネスロジック適用
    **main_gold**: 分析用集計データ
    """)

    st.markdown("---")
    st.info("💾 実データ使用中")

# タブ作成
tabs = st.tabs([f"{i+1}. {desc.split(' - ')[0][:30]}..." if len(desc) > 30 else f"{i+1}. {desc}"
                for i, desc in enumerate(model_descriptions.values())])

# 各タブにデータを表示
for idx, (table_name, tab) in enumerate(zip(model_descriptions.keys(), tabs)):
    with tab:
        st.subheader(f"📋 {model_descriptions[table_name]}")
        st.markdown(f"**テーブル名**: `{table_name}`")

        # JSONテーブルかどうかを判定
        is_json_table = table_name.startswith('main.') and 'json' in table_name

        if is_json_table:
            st.info("🔍 生のJSONデータ（ドキュメント形式で表示）")

        # データ取得
        query = f"SELECT * FROM {table_name} LIMIT 100"

        try:
            df = run_query(query, conn)

            if df is not None and not df.empty:
                # データ概要
                col1, col2, col3 = st.columns(3)
                with col1:
                    # 全レコード数を取得
                    count_query = f"SELECT COUNT(*) as total FROM {table_name}"
                    count_df = run_query(count_query, conn)
                    total_count = count_df['total'].iloc[0] if not count_df.empty else len(df)
                    st.metric("総レコード数", f"{total_count:,}")
                with col2:
                    st.metric("カラム数", len(df.columns))
                with col3:
                    st.metric("表示件数", min(5, len(df)) if is_json_table else min(30, len(df)))

                # JSONテーブルの場合はドキュメント形式で表示
                if is_json_table:
                    st.markdown("### 📄 データプレビュー（ドキュメント形式）")

                    # 最大5件まで表示
                    display_count = min(5, len(df))

                    # 辞書型カラムを検出
                    dict_columns = []
                    for col in df.columns:
                        if not df[col].isna().all():
                            sample = df[col].dropna().iloc[0] if not df[col].dropna().empty else None
                            if isinstance(sample, dict):
                                dict_columns.append(col)

                    if dict_columns:
                        # ドキュメント形式で表示
                        for i in range(display_count):
                            row = df.iloc[i]

                            # 日付情報を取得
                            date_info = ""
                            if 'year' in df.columns and 'month' in df.columns and 'day' in df.columns:
                                date_info = f"- {row['year']}/{row['month']}/{row['day']}"

                            # metadata と data を取得
                            metadata = row.get('metadata', {}) if 'metadata' in row else {}
                            data = row.get('data', {}) if 'data' in row else {}

                            # ドキュメント表示
                            display_json_document(data, metadata, i, date_info)
                    else:
                        # 辞書型カラムがない場合は通常の表形式
                        st.dataframe(df.head(display_count), use_container_width=True)

                else:
                    # フラット化されたテーブルは表形式で表示
                    st.markdown("### 📄 データプレビュー")

                    # データ量に応じてSliderを表示（レコードが5件以上の場合のみ）
                    if len(df) > 5:
                        n_rows = st.slider(
                            "表示する行数",
                            min_value=5,
                            max_value=100,
                            value=min(30, len(df)),
                            step=5,
                            key=f"slider_{table_name}"
                        )
                    else:
                        n_rows = len(df)
                        st.info(f"📊 全{n_rows}件を表示中")

                    # カラム情報
                    with st.expander("📊 カラム情報"):
                        # ユニーク値を安全に計算
                        unique_counts = []
                        for col in df.columns:
                            try:
                                sample_value = df[col].dropna().iloc[0] if not df[col].dropna().empty else None
                                if isinstance(sample_value, dict):
                                    unique_counts.append('STRUCT型')
                                else:
                                    unique_counts.append(df[col].nunique())
                            except:
                                unique_counts.append('N/A')

                        column_info = pd.DataFrame({
                            'カラム名': df.columns,
                            'データ型': df.dtypes.astype(str),
                            'NULL値': df.isnull().sum(),
                            'ユニーク値': unique_counts
                        })
                        st.dataframe(column_info, use_container_width=True)

                    # データフレーム表示
                    st.dataframe(
                        df.head(n_rows),
                        use_container_width=True,
                        height=400
                    )

                    # 統計情報（数値カラムのみ）
                    numeric_columns = df.select_dtypes(include=['float64', 'int64']).columns
                    if len(numeric_columns) > 0:
                        with st.expander("📈 統計サマリー"):
                            st.dataframe(
                                df[numeric_columns].describe().round(2),
                                use_container_width=True
                            )

            else:
                st.warning(f"⚠️ {table_name} にデータがありません")

                # デバッグ情報
                with st.expander("🔍 デバッグ情報"):
                    st.code(query)

        except Exception as e:
            st.error(f"❌ エラーが発生しました: {str(e)[:200]}")

            # エラー詳細
            with st.expander("🔍 エラー詳細"):
                st.code(str(e))
                st.markdown("**実行しようとしたクエリ:**")
                st.code(query)

                # ヒント表示
                if "does not exist" in str(e).lower():
                    st.info("💡 テーブルが存在しない可能性があります")

# フッター
st.markdown("---")
st.caption("ModerationCraft dbt Models Viewer | 実データ表示中（ドキュメント/表形式ハイブリッド）")