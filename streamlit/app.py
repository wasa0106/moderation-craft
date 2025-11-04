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
st.title("ModerationCraft dbt Models Viewer")
st.markdown("dbtで定義されたモデルのデータを表示します（JSON/表形式）")

# データベース接続
def initialize_database():
    """データベース接続を初期化"""
    conn = get_connection()
    tables = get_available_tables(conn)
    return conn, tables

# 初期化
conn, available_tables = initialize_database()

# モデルの説明（階層別に整理）
model_descriptions = {
    # === Dimension Layer ===
    'main_dimensions.dim_date': '日付ディメンション - 日付マスター（2024-2027, 1461日分）（Dimension層）',
    'main_dimensions.dim_time': '時間ディメンション - 時刻マスター（00:00-23:59, 1440分）（Dimension層）',
    'main_dimensions.dim_user': 'ユーザーディメンション - ユーザー属性（SCD Type 2対応）（Dimension層）',

    # === Fact Layer ===
    'main_facts.fact_work_sessions': '作業セッションファクト - プロジェクト・タスク・BigTask名付き（Fact層）',
    'main_facts.fact_small_tasks': 'SmallTaskファクト - タスク計画情報（1タスク=1レコード）（Fact層）',

    # === Staging Layer - Raw JSON ===
    'main.stg_fitbit_sleep_json': 'Fitbit睡眠データ - 生JSON（Staging層）',
    'main.stg_fitbit_activity_json': 'Fitbit活動データ - 生JSON（Staging層）',

    # === Staging Layer - Flattened ===
    'main_staging.stg_fitbit_sleep_json': 'Fitbit睡眠データ - フラット化（Staging層）',
    'main_staging.stg_fitbit_activity_json': 'Fitbit活動データ - フラット化（Staging層）',
    'main_staging.stg_work_sessions': '作業セッション（Staging層）',
    'main_staging.stg_projects': 'プロジェクトマスター（Staging層）',
    'main_staging.stg_small_tasks': '小タスクマスター（Staging層）',
    'main_staging.stg_big_tasks': '大タスク（BigTask）マスター（Staging層）',

    # === Intermediate Layer ===
    'main_intermediate.int_work_sessions_enriched': '作業セッション（プロジェクト・タスク名付き）（Intermediate層）',
    'main_intermediate.int_daily_health_summary': '日次健康サマリー - 全データ統合（Intermediate層）',
    'main_intermediate.int_productivity_metrics': '生産性メトリクス（Intermediate層）',

    # === Mart Layer ===
    'main_gold.mart_wellness_correlation': '健康相関分析（Mart層）',
    'main_gold.mart_productivity_daily': '日次生産性（Mart層）',

    # === BI Layer - Task Analysis ===
    'main_gold.mart_task_performance': 'タスクパフォーマンス分析 - 予定vs実績比較・見積もり精度（BI層）',
    'main_gold.mart_task_completion_analysis': 'タスク完了状況分析 - 完了率・期限管理・未完了追跡（BI層）',
    'main_gold.mart_task_productivity': 'タスク生産性分析 - セッションメトリクス・タイプ別生産性（BI層）'
}

# モデルのグループ化（データ層別）
model_groups = {
    'Dimension Models': [
        'main_dimensions.dim_date',
        'main_dimensions.dim_time',
        'main_dimensions.dim_user',
    ],
    'Fact Models': [
        'main_facts.fact_work_sessions',
        'main_facts.fact_small_tasks',
    ],
    'Staging - Raw JSON': [
        'main.stg_fitbit_sleep_json',
        'main.stg_fitbit_activity_json',
    ],
    'Staging - Flattened': [
        'main_staging.stg_fitbit_sleep_json',
        'main_staging.stg_fitbit_activity_json',
        'main_staging.stg_work_sessions',
        'main_staging.stg_projects',
        'main_staging.stg_small_tasks',
        'main_staging.stg_big_tasks',
    ],
    'Intermediate Models': [
        'main_intermediate.int_work_sessions_enriched',
        'main_intermediate.int_daily_health_summary',
        'main_intermediate.int_productivity_metrics',
    ],
    'Mart Models': [
        'main_gold.mart_productivity_daily',
        'main_gold.mart_wellness_correlation',
    ],
    'BI - Task Analysis': [
        'main_gold.mart_task_performance',
        'main_gold.mart_task_completion_analysis',
        'main_gold.mart_task_productivity',
    ],
}

# JSONデータをドキュメント形式で表示する関数
def display_json_document(data_dict, metadata_dict, row_index, date_info=""):
    """JSONデータを見やすいドキュメント形式で表示"""
    with st.container():
        st.markdown(f"### Document {row_index + 1} {date_info}")
        st.markdown("---")

        col1, col2 = st.columns(2)

        with col1:
            st.markdown("#### Metadata")
            if metadata_dict:
                for key, value in metadata_dict.items():
                    if isinstance(value, (datetime, pd.Timestamp)):
                        value = value.strftime("%Y-%m-%d %H:%M:%S")
                    elif isinstance(value, dict):
                        value = f"{len(value)} items"
                    st.markdown(f"• **{key}**: {value}")

        with col2:
            st.markdown("#### Data Summary")
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
        with st.expander("View Full JSON"):
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
    st.header("データベース情報")

    # 実際のテーブル一覧を取得して表示
    st.markdown("### 実際のテーブル")
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
            status = "[OK]" if table in model_descriptions else "[?]"
            st.markdown(f"{status} `{table}`")
        st.success(f"合計 {len(schema_tables)} テーブル")
    else:
        st.warning("テーブルが見つかりません")

    st.markdown("---")
    st.markdown("### データ層の説明")
    st.markdown("""
    **main.**: 生JSONデータ（S3から直接）
    **main_staging**: フラット化されたデータ
    **main_dimensions**: ディメンションテーブル（マスターデータ）
    **main_facts**: ファクトテーブル（トランザクションデータ）
    **main_intermediate**: ビジネスロジック適用
    **main_gold**: 分析用集計データ
    """)

    st.markdown("---")
    st.info("実データ使用中")

# タブ作成（グループ別）
tabs = st.tabs(list(model_groups.keys()))

# 各タブにデータを表示
for group_name, tab in zip(model_groups.keys(), tabs):
    with tab:
        st.header(group_name)
        st.markdown("---")

        # グループ内の各モデルを表示
        for table_name in model_groups[group_name]:
            st.subheader(f"{model_descriptions[table_name]}")
            st.markdown(f"**テーブル名**: `{table_name}`")

            # テーブルタイプを判定
            is_json_table = table_name.startswith('main.') and 'json' in table_name
            is_dimension_table = table_name.startswith('main_dimensions.')
            is_fact_table = table_name.startswith('main_facts.')

            if is_dimension_table:
                st.info("ディメンションテーブル（マスターデータ）")
            elif is_fact_table:
                st.info("ファクトテーブル（トランザクションデータ）")
            elif is_json_table:
                st.info("生のJSONデータ（ドキュメント形式で表示）")

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
                        if is_dimension_table:
                            st.metric("表示件数", f"{len(df):,} (全件)")
                        elif is_json_table:
                            st.metric("表示件数", min(5, len(df)))
                        else:
                            st.metric("表示件数", min(30, len(df)))

                    # ディメンションテーブルの場合は全件表示
                    if is_dimension_table:
                        st.markdown("### データプレビュー（全件表示）")

                        # 主キーカラムを検出
                        key_columns = [col for col in df.columns if '_key' in col.lower() or col.lower() == 'id']

                        # カラム情報
                        with st.expander("カラム情報"):
                            unique_counts = []
                            for col in df.columns:
                                try:
                                    unique_counts.append(df[col].nunique())
                                except:
                                    unique_counts.append('N/A')

                            column_info = pd.DataFrame({
                                'カラム名': df.columns,
                                'データ型': df.dtypes.astype(str),
                                'NULL値': df.isnull().sum(),
                                'ユニーク値': unique_counts,
                                '主キー': ['🔑' if col in key_columns else '' for col in df.columns]
                            })
                            st.dataframe(column_info, use_container_width=True)

                        # 全件表示（ディメンションは通常小さい）
                        st.dataframe(
                            df,
                            use_container_width=True,
                            height=min(600, len(df) * 35 + 38)
                        )

                        # 統計情報
                        numeric_columns = df.select_dtypes(include=['float64', 'int64']).columns
                        if len(numeric_columns) > 0:
                            with st.expander("統計サマリー"):
                                st.dataframe(
                                    df[numeric_columns].describe().round(2),
                                    use_container_width=True
                                )

                    # ファクトテーブルの場合は集計オプション付きで表示
                    elif is_fact_table:
                        st.markdown("### データプレビュー")

                        # メトリクスカラムとディメンションカラムを分離
                        metric_columns = [col for col in df.columns if any(keyword in col.lower()
                                         for keyword in ['duration', 'score', 'level', 'rating', 'minutes', 'seconds'])]
                        dimension_columns = [col for col in df.columns if '_key' in col.lower() or
                                           col.lower() in ['project_id', 'small_task_id', 'user_id']]

                        # カラム情報
                        with st.expander("カラム情報"):
                            unique_counts = []
                            for col in df.columns:
                                try:
                                    unique_counts.append(df[col].nunique())
                                except:
                                    unique_counts.append('N/A')

                            column_type = []
                            for col in df.columns:
                                if col in metric_columns:
                                    column_type.append('[Metric]')
                                elif col in dimension_columns:
                                    column_type.append('[Dimension]')
                                else:
                                    column_type.append('[Attribute]')

                            column_info = pd.DataFrame({
                                'カラム名': df.columns,
                                'タイプ': column_type,
                                'データ型': df.dtypes.astype(str),
                                'NULL値': df.isnull().sum(),
                                'ユニーク値': unique_counts
                            })
                            st.dataframe(column_info, use_container_width=True)

                        # データ量に応じてSliderを表示
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

                        # データフレーム表示
                        st.dataframe(
                            df.head(n_rows),
                            use_container_width=True,
                            height=400
                        )

                        # メトリクスの統計情報
                        if metric_columns:
                            with st.expander("メトリクス統計"):
                                st.dataframe(
                                    df[metric_columns].describe().round(2),
                                    use_container_width=True
                                )

                    # JSONテーブルの場合はドキュメント形式で表示
                    elif is_json_table:
                        st.markdown("### データプレビュー（ドキュメント形式）")

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

                    # その他のテーブル（stagingフラット化、intermediate）は表形式で表示
                    else:
                        st.markdown("### データプレビュー")

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
                            st.info(f"全{n_rows}件を表示中")

                        # カラム情報
                        with st.expander("カラム情報"):
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
                            with st.expander("統計サマリー"):
                                st.dataframe(
                                    df[numeric_columns].describe().round(2),
                                    use_container_width=True
                                )

                else:
                    st.warning(f"{table_name} にデータがありません")

                    # デバッグ情報
                    with st.expander("デバッグ情報"):
                        st.code(query)

            except Exception as e:
                st.error(f"エラーが発生しました: {str(e)[:200]}")

                # エラー詳細
                with st.expander("エラー詳細"):
                    st.code(str(e))
                    st.markdown("**実行しようとしたクエリ:**")
                    st.code(query)

                    # ヒント表示
                    if "does not exist" in str(e).lower():
                        st.info("テーブルが存在しない可能性があります")

            # モデル間の区切り線
            st.markdown("---")

# フッター
st.markdown("---")
st.caption("ModerationCraft dbt Models Viewer | 実データ表示中（ドキュメント/表形式ハイブリッド）")