"""
データ探索ページ
SQLエディタとデータ探索機能
"""
import streamlit as st
import pandas as pd
import plotly.express as px
from datetime import datetime
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils.database import get_connection, run_query, get_available_tables, get_table_schema
from utils.mock_data import setup_mock_database

# ページ設定
st.set_page_config(
    page_title="データ探索 - ModerationCraft",
    page_icon="🔍",
    layout="wide"
)

st.title("データ探索")
st.markdown("SQLエディタでデータを自由に探索")

# データベース接続
conn = get_connection()

# サイドバー
with st.sidebar:
    st.header("探索ツール")
    
    # テーブル一覧
    st.subheader("📋 利用可能なテーブル")
    tables = get_available_tables()
    
    if not tables:
        if st.button("モックデータを生成"):
            tables = setup_mock_database(conn)
            st.success(f"✅ {len(tables)}個のテーブルを作成しました")
            st.rerun()
    else:
        for table in tables:
            if st.button(f"📊 {table}", key=f"table_{table}"):
                st.session_state['selected_table'] = table
    
    # サンプルクエリ
    st.subheader("📝 サンプルクエリ")
    
    sample_queries = {
        "全データ取得": "SELECT * FROM {table} LIMIT 100",
        "日次集計": """
SELECT 
    DATE_TRUNC('day', date) as day,
    AVG(productivity_score) as avg_productivity,
    AVG(health_score) as avg_health
FROM mart_productivity_daily
GROUP BY day
ORDER BY day DESC
        """,
        "相関分析": """
SELECT 
    CORR(sleep_score, productivity_score) as sleep_correlation,
    CORR(health_score, productivity_score) as health_correlation,
    CORR(work_hours, productivity_score) as work_correlation
FROM mart_productivity_daily
        """,
        "週間パフォーマンス": """
SELECT 
    EXTRACT(DOW FROM date) as day_of_week,
    AVG(productivity_score) as avg_productivity,
    COUNT(*) as data_points
FROM mart_productivity_daily
GROUP BY day_of_week
ORDER BY day_of_week
        """,
        "トップ10生産的な日": """
SELECT 
    date,
    productivity_score,
    health_score,
    work_hours,
    sleep_hours
FROM mart_productivity_daily
ORDER BY productivity_score DESC
LIMIT 10
        """
    }
    
    selected_sample = st.selectbox(
        "サンプルを選択",
        list(sample_queries.keys())
    )
    
    if st.button("サンプルを使用"):
        st.session_state['sql_query'] = sample_queries[selected_sample]

# メインエリア
tab1, tab2, tab3 = st.tabs(["SQLエディタ", "テーブル探索", "スキーマ情報"])

with tab1:
    st.markdown("### SQLクエリエディタ")
    
    # SQLエディタ
    sql_query = st.text_area(
        "SQLクエリを入力",
        value=st.session_state.get('sql_query', 'SELECT * FROM mart_productivity_daily LIMIT 10'),
        height=200,
        key="sql_editor"
    )
    
    col1, col2, col3 = st.columns([1, 1, 4])
    
    with col1:
        execute_button = st.button("▶️ 実行", type="primary")
    
    with col2:
        clear_button = st.button("🗑️ クリア")
    
    if clear_button:
        st.session_state['sql_query'] = ""
        st.rerun()
    
    if execute_button and sql_query:
        with st.spinner("クエリ実行中..."):
            try:
                # クエリ実行
                result_df = run_query(sql_query)
                
                if not result_df.empty:
                    # 結果の統計
                    st.success(f"✅ 成功: {len(result_df)}行を取得しました")
                    
                    # 結果表示
                    st.markdown("### クエリ結果")
                    
                    # データフレーム表示
                    st.dataframe(
                        result_df,
                        use_container_width=True,
                        height=400
                    )
                    
                    # 統計情報
                    with st.expander("📈 統計情報"):
                        st.write(result_df.describe())
                    
                    # 可視化オプション
                    with st.expander("📊 データ可視化"):
                        viz_type = st.selectbox(
                            "グラフタイプ",
                            ["なし", "折れ線グラフ", "棒グラフ", "散布図", "ヒストグラム"]
                        )
                        
                        if viz_type != "なし":
                            numeric_cols = result_df.select_dtypes(include=['float64', 'int64']).columns.tolist()
                            
                            if viz_type == "折れ線グラフ":
                                x_col = st.selectbox("X軸", result_df.columns)
                                y_cols = st.multiselect("Y軸", numeric_cols, default=numeric_cols[:2])
                                if x_col and y_cols:
                                    fig = px.line(result_df, x=x_col, y=y_cols, template="plotly_white")
                                    st.plotly_chart(fig, use_container_width=True)
                            
                            elif viz_type == "棒グラフ":
                                x_col = st.selectbox("X軸", result_df.columns)
                                y_col = st.selectbox("Y軸", numeric_cols)
                                if x_col and y_col:
                                    fig = px.bar(result_df, x=x_col, y=y_col, template="plotly_white")
                                    st.plotly_chart(fig, use_container_width=True)
                            
                            elif viz_type == "散布図":
                                x_col = st.selectbox("X軸", numeric_cols)
                                y_col = st.selectbox("Y軸", numeric_cols)
                                if x_col and y_col:
                                    fig = px.scatter(result_df, x=x_col, y=y_col, template="plotly_white")
                                    st.plotly_chart(fig, use_container_width=True)
                            
                            elif viz_type == "ヒストグラム":
                                col = st.selectbox("カラム", numeric_cols)
                                if col:
                                    fig = px.histogram(result_df, x=col, template="plotly_white")
                                    st.plotly_chart(fig, use_container_width=True)
                    
                    # CSVダウンロード
                    csv = result_df.to_csv(index=False)
                    st.download_button(
                        label="📥 CSVダウンロード",
                        data=csv,
                        file_name=f"query_result_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                        mime="text/csv"
                    )
                else:
                    st.warning("結果が0件です")
                    
            except Exception as e:
                st.error(f"❌ エラー: {str(e)}")

with tab2:
    st.markdown("### テーブル探索")
    
    if 'selected_table' in st.session_state:
        table_name = st.session_state['selected_table']
        st.markdown(f"#### テーブル: `{table_name}`")
        
        # プレビュー行数
        preview_rows = st.slider("プレビュー行数", 10, 1000, 100, step=10)
        
        # データ取得
        preview_query = f"SELECT * FROM {table_name} LIMIT {preview_rows}"
        preview_df = run_query(preview_query)
        
        if not preview_df.empty:
            # 基本統計
            col1, col2, col3, col4 = st.columns(4)
            
            with col1:
                total_rows = run_query(f"SELECT COUNT(*) as count FROM {table_name}")
                st.metric("総行数", f"{total_rows['count'].iloc[0]:,}" if not total_rows.empty else "不明")
            
            with col2:
                st.metric("カラム数", len(preview_df.columns))
            
            with col3:
                null_count = preview_df.isnull().sum().sum()
                st.metric("NULL値", f"{null_count:,}")
            
            with col4:
                memory_usage = preview_df.memory_usage(deep=True).sum() / 1024 / 1024
                st.metric("メモリ使用量", f"{memory_usage:.2f} MB")
            
            # データプレビュー
            st.markdown("#### データプレビュー")
            st.dataframe(preview_df, use_container_width=True)
            
            # カラム統計
            st.markdown("#### カラム統計")
            
            # 数値カラムの統計
            numeric_cols = preview_df.select_dtypes(include=['float64', 'int64']).columns
            if len(numeric_cols) > 0:
                st.markdown("**数値カラム**")
                st.dataframe(preview_df[numeric_cols].describe(), use_container_width=True)
            
            # カテゴリカルカラムの統計
            categorical_cols = preview_df.select_dtypes(include=['object']).columns
            if len(categorical_cols) > 0:
                st.markdown("**カテゴリカルカラム**")
                cat_stats = pd.DataFrame({
                    'カラム': categorical_cols,
                    'ユニーク数': [preview_df[col].nunique() for col in categorical_cols],
                    '最頻値': [preview_df[col].mode()[0] if not preview_df[col].mode().empty else None for col in categorical_cols]
                })
                st.dataframe(cat_stats, use_container_width=True)
    else:
        st.info("左のサイドバーからテーブルを選択してください")

with tab3:
    st.markdown("### スキーマ情報")
    
    # テーブル選択
    schema_table = st.selectbox(
        "テーブルを選択",
        tables if tables else ["テーブルがありません"]
    )
    
    if schema_table and schema_table != "テーブルがありません":
        # スキーマ情報取得
        schema_df = get_table_schema(schema_table)
        
        if not schema_df.empty:
            st.markdown(f"#### `{schema_table}` のスキーマ")
            
            # スキーマ表示
            st.dataframe(
                schema_df.style.format({
                    'column_name': lambda x: f"📋 {x}",
                    'data_type': lambda x: f"🔤 {x}",
                    'is_nullable': lambda x: "✅ NULL可" if x == "YES" else "❌ NOT NULL"
                }),
                use_container_width=True
            )
            
            # CREATE TABLE文の生成
            with st.expander("CREATE TABLE文"):
                create_statement = f"CREATE TABLE {schema_table} (\n"
                for _, row in schema_df.iterrows():
                    nullable = "" if row['is_nullable'] == "YES" else " NOT NULL"
                    create_statement += f"    {row['column_name']} {row['data_type']}{nullable},\n"
                create_statement = create_statement.rstrip(",\n") + "\n);"
                
                st.code(create_statement, language="sql")
        else:
            st.warning("スキーマ情報を取得できませんでした")
    
    # データベース統計
    st.markdown("### 📊 データベース統計")
    
    if tables:
        db_stats = []
        for table in tables:
            try:
                count_result = run_query(f"SELECT COUNT(*) as count FROM {table}")
                count = count_result['count'].iloc[0] if not count_result.empty else 0
                db_stats.append({
                    'テーブル': table,
                    '行数': count
                })
            except:
                pass
        
        if db_stats:
            stats_df = pd.DataFrame(db_stats)
            
            # 棒グラフ
            fig = px.bar(
                stats_df,
                x='テーブル',
                y='行数',
                title="テーブル別レコード数",
                template="plotly_white",
                text='行数'
            )
            fig.update_traces(texttemplate='%{text:,.0f}', textposition='outside')
            st.plotly_chart(fig, use_container_width=True)

# フッター
st.markdown("---")
st.markdown(
    """
    <div style='text-align: center; color: #666;'>
    💡 ヒント: サイドバーからサンプルクエリを選択するか、テーブルを探索してデータ構造を理解しましょう
    </div>
    """,
    unsafe_allow_html=True
)