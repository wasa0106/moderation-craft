"""
DuckDB接続ユーティリティ
"""
import duckdb
import pandas as pd
import streamlit as st
from pathlib import Path
from typing import Optional

@st.cache_resource
def get_connection() -> duckdb.DuckDBPyConnection:
    """DuckDB接続を取得（キャッシュ済み）"""
    # dbtのDuckDBファイルパスを探す
    dbt_db_path = Path("../dbt-moderation-craft/moderation_craft/moderation_craft_dev.duckdb")
    
    if dbt_db_path.exists():
        try:
            # まず読み取り専用で接続を試みる
            conn = duckdb.connect(str(dbt_db_path), read_only=True)
            st.sidebar.success(f"✅ DBファイル接続（読み取り専用）: {dbt_db_path.name}")
            return conn
        except Exception as e:
            # ロックエラーの場合はメモリDBにフォールバック
            st.sidebar.warning(f"⚠️ DBファイルがロックされています: {str(e)[:50]}...")
            st.sidebar.info("💡 モックデータを使用します")
            return duckdb.connect(":memory:")
    else:
        # ファイルが存在しない場合はメモリDBを使用
        st.sidebar.warning("⚠️ DBファイルが見つかりません。モックデータを使用します。")
        return duckdb.connect(":memory:")

@st.cache_data(ttl=60)  # 1分間キャッシュ
def run_query(query: str) -> pd.DataFrame:
    """SQLクエリを実行してDataFrameを返す"""
    conn = get_connection()
    try:
        return conn.execute(query).df()
    except Exception as e:
        st.error(f"クエリエラー: {e}")
        return pd.DataFrame()

def get_available_tables() -> list:
    """利用可能なテーブル一覧を取得"""
    conn = get_connection()
    try:
        tables = conn.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
        """).df()
        return tables['table_name'].tolist()
    except:
        return []

def get_table_schema(table_name: str) -> pd.DataFrame:
    """テーブルのスキーマ情報を取得"""
    conn = get_connection()
    try:
        return conn.execute(f"""
            SELECT 
                column_name,
                data_type,
                is_nullable
            FROM information_schema.columns
            WHERE table_name = '{table_name}'
            ORDER BY ordinal_position
        """).df()
    except:
        return pd.DataFrame()