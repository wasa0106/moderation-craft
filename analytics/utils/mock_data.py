"""
モックデータ生成ユーティリティ
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import duckdb
import streamlit as st

@st.cache_data
def generate_mock_data(days: int = 90) -> dict:
    """テスト用のモックデータを生成"""
    
    # 日付範囲を生成
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    date_range = pd.date_range(start=start_date, end=end_date, freq='D')
    
    # 生産性データの生成
    np.random.seed(42)  # 再現性のため
    n_days = len(date_range)
    
    # トレンドを持つデータ生成（徐々に改善）
    base_productivity = 70 + np.linspace(0, 15, n_days)  # 70から85へ
    productivity_noise = np.random.normal(0, 5, n_days)
    productivity_scores = np.clip(base_productivity + productivity_noise, 0, 100)
    
    # 健康スコア（生産性と相関を持たせる）
    health_scores = productivity_scores * 0.8 + np.random.normal(10, 3, n_days)
    health_scores = np.clip(health_scores, 0, 100)
    
    # 睡眠時間（健康と相関）
    sleep_hours = 5 + health_scores/100 * 3 + np.random.normal(0, 0.5, n_days)
    sleep_hours = np.clip(sleep_hours, 3, 10)
    
    # 作業時間（生産性と相関）
    work_hours = 4 + productivity_scores/100 * 4 + np.random.normal(0, 1, n_days)
    work_hours = np.clip(work_hours, 0, 12)
    
    # 曜日効果（週末は生産性低め）
    weekday_effect = [0.9 if d.weekday() >= 5 else 1.0 for d in date_range]
    productivity_scores = productivity_scores * weekday_effect
    work_hours = work_hours * weekday_effect
    
    # DataFrameの作成
    productivity_daily = pd.DataFrame({
        'date': date_range,
        'user_id': 'default_user',
        'productivity_score': productivity_scores.round(1),
        'health_score': health_scores.round(1),
        'sleep_score': (sleep_hours * 10).round(1),  # 時間をスコアに変換
        'work_hours': work_hours.round(1),
        'sleep_hours': sleep_hours.round(1),
        'work_sessions': np.random.poisson(4, n_days),
        'pomodoro_rate': np.random.uniform(60, 90, n_days).round(1),
        'mood_level': np.random.uniform(3, 5, n_days).round(1),
        'steps': np.random.normal(8000, 2000, n_days).round(0),
        'day_of_week': [d.strftime('%A') for d in date_range],
        'week_number': [d.isocalendar()[1] for d in date_range],
        'performance_category': pd.cut(
            productivity_scores,
            bins=[0, 60, 75, 85, 100],
            labels=['needs_attention', 'underutilized', 'balanced', 'optimal']
        )
    })
    
    # 相関データの生成
    wellness_correlation = productivity_daily.copy()
    wellness_correlation['sleep_7d_avg'] = wellness_correlation['sleep_score'].rolling(7, min_periods=1).mean()
    wellness_correlation['productivity_7d_avg'] = wellness_correlation['productivity_score'].rolling(7, min_periods=1).mean()
    wellness_correlation['sleep_change'] = wellness_correlation['sleep_score'].diff()
    wellness_correlation['productivity_change'] = wellness_correlation['productivity_score'].diff()
    
    # 相関パターンの判定
    def determine_pattern(row):
        if pd.isna(row['sleep_change']) or pd.isna(row['productivity_change']):
            return 'stable'
        if row['sleep_change'] > 5 and row['productivity_change'] > 5:
            return 'both_improving'
        elif row['sleep_change'] < -5 and row['productivity_change'] < -5:
            return 'both_declining'
        elif abs(row['sleep_change']) < 5 and abs(row['productivity_change']) < 5:
            return 'stable'
        else:
            return 'mixed'
    
    wellness_correlation['correlation_pattern'] = wellness_correlation.apply(determine_pattern, axis=1)
    
    return {
        'mart_productivity_daily': productivity_daily,
        'mart_wellness_correlation': wellness_correlation
    }

def setup_mock_database(conn: duckdb.DuckDBPyConnection):
    """モックデータをDuckDBに登録"""
    mock_data = generate_mock_data()
    
    for table_name, df in mock_data.items():
        # テーブルが存在する場合は削除
        conn.execute(f"DROP TABLE IF EXISTS {table_name}")
        # DataFrameからテーブルを作成
        conn.execute(f"CREATE TABLE {table_name} AS SELECT * FROM df")
    
    return list(mock_data.keys())