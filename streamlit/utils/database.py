"""
DuckDB接続ユーティリティ（実データ用）
"""
import duckdb
import pandas as pd
from pathlib import Path

def get_connection():
    """実際のDuckDBファイルへの接続を取得"""
    # DuckDBファイルのパスを設定
    current_dir = Path(__file__).parent.parent  # streamlitディレクトリ
    duckdb_path = current_dir.parent / "dbt" / "moderation_craft_dev.duckdb"

    # ファイルが存在する場合は読み取り専用で接続
    if duckdb_path.exists():
        try:
            conn = duckdb.connect(str(duckdb_path), read_only=True)
            print(f"✅ DuckDB接続成功: {duckdb_path}")
            return conn
        except Exception as e:
            print(f"❌ DuckDB接続エラー: {e}")
            # エラーの場合はメモリDBにフォールバック
            print("⚠️ メモリDBにフォールバック")
            return duckdb.connect(":memory:")
    else:
        print(f"❌ DuckDBファイルが見つかりません: {duckdb_path}")
        # ファイルが存在しない場合はメモリDBを使用
        return duckdb.connect(":memory:")

def run_query(query: str, conn=None) -> pd.DataFrame:
    """SQLクエリを実行してDataFrameを返す"""
    if conn is None:
        conn = get_connection()

    try:
        result = conn.execute(query).df()
        return result
    except Exception as e:
        print(f"クエリエラー: {e}")
        return pd.DataFrame()

def get_available_tables(conn) -> list:
    """利用可能なテーブル一覧を取得"""
    try:
        tables = conn.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
        """).df()
        return tables['table_name'].tolist()
    except:
        return []