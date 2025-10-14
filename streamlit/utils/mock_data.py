"""
dbtモデルに対応したモックデータ生成ユーティリティ
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import uuid


def generate_mock_data(days: int = 30) -> dict:
    """7つのdbtモデルに対応したモックデータを生成"""

    # 基準日付の生成
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    date_range = pd.date_range(start=start_date, end=end_date, freq='D')

    # 固定シード
    np.random.seed(42)
    n_days = len(date_range)

    # 共通的に使用する現在時刻
    now_ts = datetime.now()

    # 1. stg_fitbit_sleep_json - Fitbit睡眠データ（整形のみ）
    sleep_minutes = np.random.uniform(360, 540, n_days).round(0)
    time_in_bed = sleep_minutes + np.random.uniform(20, 60, n_days).round(0)
    minutes_awake = (time_in_bed - sleep_minutes).clip(min=0)
    deep_ratio = np.random.uniform(0.18, 0.25, n_days)
    rem_ratio = np.random.uniform(0.15, 0.22, n_days)
    light_ratio = np.clip(1 - deep_ratio - rem_ratio, 0.45, 0.6)
    deep_sleep = (sleep_minutes * deep_ratio).round(0)
    rem_sleep = (sleep_minutes * rem_ratio).round(0)
    light_sleep = (sleep_minutes - deep_sleep - rem_sleep).clip(min=0)
    sleep_start_time = pd.to_datetime(date_range) + pd.to_timedelta(np.random.uniform(22, 24, n_days), unit='h')
    sleep_end_time = sleep_start_time + pd.to_timedelta(time_in_bed, unit='m')

    stg_fitbit_sleep = pd.DataFrame({
        'id': [str(uuid.uuid4())[:8] for _ in range(n_days)],
        'user_id': 'default_user',
        'sleep_date': date_range,
        'duration_ms': (sleep_minutes * 60 * 1000).astype(int),
        'sleep_efficiency': np.random.uniform(75, 95, n_days).round(2),
        'minutes_asleep': sleep_minutes.astype(int),
        'minutes_awake': minutes_awake.astype(int),
        'time_in_bed': time_in_bed.astype(int),
        'deep_sleep_minutes': deep_sleep.astype(int),
        'light_sleep_minutes': light_sleep.astype(int),
        'rem_sleep_minutes': rem_sleep.astype(int),
        'wake_minutes': minutes_awake.astype(int),
        'sleep_start_time': sleep_start_time,
        'sleep_end_time': sleep_end_time,
        'is_main_sleep': True,
        'fetched_at': now_ts,
        'source_date': [d.strftime('%Y-%m-%d') for d in date_range],
        'extracted_at': now_ts,
        'processed_at': now_ts
    })

    # 2. stg_fitbit_activity_json - Fitbit活動データ（整形のみ）
    steps = np.random.uniform(5000, 15000, n_days).round(0)
    sedentary_minutes = np.random.uniform(600, 900, n_days).round(0)
    lightly_active_minutes = np.random.uniform(100, 220, n_days).round(0)
    fairly_active_minutes = np.random.uniform(20, 70, n_days).round(0)
    very_active_minutes = np.random.uniform(0, 40, n_days).round(0)

    stg_fitbit_activity = pd.DataFrame({
        'id': [str(uuid.uuid4())[:8] for _ in range(n_days)],
        'user_id': 'default_user',
        'activity_date': date_range,
        'steps': steps.astype(int),
        'distance_km': (steps * np.random.uniform(0.0006, 0.0011, n_days)).round(2),
        'calories_burned': np.random.uniform(1800, 2600, n_days).round(0).astype(int),
        'calories_bmr': np.random.uniform(1400, 1700, n_days).round(0).astype(int),
        'activity_calories': np.random.uniform(200, 800, n_days).round(0).astype(int),
        'floors_climbed': np.random.uniform(5, 20, n_days).round(0).astype(int),
        'elevation_meters': np.random.uniform(15, 120, n_days).round(1),
        'sedentary_minutes': sedentary_minutes.astype(int),
        'lightly_active_minutes': lightly_active_minutes.astype(int),
        'fairly_active_minutes': fairly_active_minutes.astype(int),
        'very_active_minutes': very_active_minutes.astype(int),
        'fetched_at': now_ts,
        'source_date': [d.strftime('%Y-%m-%d') for d in date_range],
        'extracted_at': now_ts,
        'processed_at': now_ts
    })

    # 3. stg_work_sessions - 作業セッション
    sessions_per_day = 3
    total_sessions = n_days * sessions_per_day
    work_dates = []
    for date in date_range:
        work_dates.extend([date] * sessions_per_day)

    stg_work_sessions = pd.DataFrame({
        'session_id': [str(uuid.uuid4())[:8] for _ in range(total_sessions)],
        'user_id': 'default_user',
        'session_date': work_dates,
        'start_time': pd.to_datetime('2024-01-01 09:00:00'),
        'end_time': pd.to_datetime('2024-01-01 10:30:00'),
        'duration_minutes': np.random.uniform(25, 90, total_sessions).round(0),
        'task_id': [f'TASK-{i:03d}' for i in np.random.randint(1, 20, total_sessions)],
        'task_name': [f'タスク {i}' for i in np.random.randint(1, 20, total_sessions)],
        'project_id': [f'PRJ-{i:02d}' for i in np.random.randint(1, 5, total_sessions)],
        'session_type': np.random.choice(['pomodoro', 'flow', 'break'], total_sessions),
        'productivity_score': np.random.uniform(60, 95, total_sessions).round(1),
        'focus_level': np.random.choice(['low', 'medium', 'high'], total_sessions),
        'completed': np.random.choice([True, False], total_sessions, p=[0.8, 0.2]),
        'notes': ['メモ'] * total_sessions,
        'created_at': datetime.now()
    })

    # 4. int_daily_health_summary - 日次健康サマリー
    int_daily_health = stg_fitbit_sleep.merge(
        stg_fitbit_activity,
        left_on=['user_id', 'sleep_date'],
        right_on=['user_id', 'activity_date'],
        how='outer',
        suffixes=('_sleep', '_activity')
    )

    int_daily_health['date'] = int_daily_health['sleep_date'].combine_first(int_daily_health['activity_date'])
    int_daily_health['day_of_week'] = int_daily_health['date'].dt.day_name()
    int_daily_health['week_number'] = int_daily_health['date'].dt.isocalendar().week.astype(int)
    int_daily_health['month'] = int_daily_health['date'].dt.month
    int_daily_health['year'] = int_daily_health['date'].dt.year

    int_daily_health['total_sleep_minutes'] = int_daily_health['minutes_asleep']
    int_daily_health['total_sleep_hours'] = (int_daily_health['total_sleep_minutes'] / 60).round(2)

    int_daily_health['deep_sleep_percent'] = (
        int_daily_health['deep_sleep_minutes'] * 100.0 /
        int_daily_health['total_sleep_minutes'].replace({0: np.nan})
    ).round(2)
    int_daily_health['rem_sleep_percent'] = (
        int_daily_health['rem_sleep_minutes'] * 100.0 /
        int_daily_health['total_sleep_minutes'].replace({0: np.nan})
    ).round(2)
    int_daily_health['light_sleep_percent'] = (
        int_daily_health['light_sleep_minutes'] * 100.0 /
        int_daily_health['total_sleep_minutes'].replace({0: np.nan})
    ).round(2)

    sleep_efficiency = int_daily_health['sleep_efficiency'].fillna(0)
    int_daily_health['sleep_quality_category'] = pd.cut(
        sleep_efficiency,
        bins=[-np.inf, 75, 85, np.inf],
        labels=['poor', 'fair', 'good']
    )

    total_sleep_minutes = int_daily_health['total_sleep_minutes'].fillna(0)
    int_daily_health['sleep_duration_category'] = pd.cut(
        total_sleep_minutes,
        bins=[-np.inf, 360, 420, 540, np.inf],
        labels=['very_short', 'short', 'optimal', 'long']
    )

    int_daily_health['total_active_minutes'] = (
        int_daily_health[['lightly_active_minutes', 'fairly_active_minutes', 'very_active_minutes']]
        .fillna(0)
        .sum(axis=1)
    )
    int_daily_health['total_active_hours'] = (int_daily_health['total_active_minutes'] / 60).round(2)
    int_daily_health['sedentary_hours'] = (int_daily_health['sedentary_minutes'].fillna(0) / 60).round(2)

    steps_series = int_daily_health['steps'].fillna(0)
    int_daily_health['activity_level'] = pd.cut(
        steps_series,
        bins=[-np.inf, 5000, 7500, 10000, np.inf],
        labels=['low', 'fair', 'good', 'excellent']
    )
    int_daily_health['step_goal_percentage'] = np.where(
        steps_series > 0,
        (steps_series * 100.0 / 10000).round(2),
        np.nan
    )

    def compute_primary_activity(row):
        values = {
            'high_intensity': row.get('very_active_minutes', 0) or 0,
            'moderate_intensity': row.get('fairly_active_minutes', 0) or 0,
            'light_intensity': row.get('lightly_active_minutes', 0) or 0,
            'sedentary': row.get('sedentary_minutes', 0) or 0
        }
        max_value = max(values.values())
        if max_value == 0:
            return 'sedentary'
        return max(values, key=values.get)

    int_daily_health['primary_activity_type'] = int_daily_health.apply(compute_primary_activity, axis=1)

    int_daily_health['sleep_score'] = (
        int_daily_health['total_sleep_hours'].fillna(0) / 8.0 * 30
        + int_daily_health['sleep_efficiency'].fillna(0) / 100.0 * 30
        + int_daily_health['deep_sleep_percent'].fillna(0) / 20.0 * 20
        + int_daily_health['rem_sleep_percent'].fillna(0) / 25.0 * 20
    ).round(2)

    int_daily_health['activity_score'] = (
        np.minimum(steps_series / 10000.0 * 40, 40)
        + np.minimum(int_daily_health['total_active_minutes'].fillna(0) / 30.0 * 30, 30)
        + np.minimum(int_daily_health['calories_burned'].fillna(0) / 2000.0 * 30, 30)
    ).round(2)

    int_daily_health['overall_health_score'] = (
        (int_daily_health['sleep_score'].fillna(0) + int_daily_health['activity_score'].fillna(0)) / 2
    ).round(2)

    int_daily_health['has_complete_data'] = (
        int_daily_health['total_sleep_hours'].notna() & int_daily_health['steps'].notna()
    )

    int_daily_health['calculated_at'] = now_ts

    int_daily_health['id'] = [str(uuid.uuid4())[:8] for _ in range(len(int_daily_health))]

    # カラムの整理（実モデルに合わせた順序）
    int_daily_health = int_daily_health[[
        'id', 'user_id', 'date', 'day_of_week', 'week_number', 'month', 'year',
        'total_sleep_minutes', 'total_sleep_hours', 'sleep_efficiency', 'minutes_asleep',
        'minutes_awake', 'time_in_bed', 'deep_sleep_minutes', 'light_sleep_minutes',
        'rem_sleep_minutes', 'wake_minutes', 'deep_sleep_percent', 'rem_sleep_percent',
        'light_sleep_percent', 'sleep_quality_category', 'sleep_duration_category',
        'sleep_start_time', 'sleep_end_time', 'steps', 'distance_km', 'calories_burned',
        'calories_bmr', 'activity_calories', 'floors_climbed', 'elevation_meters',
        'sedentary_minutes', 'lightly_active_minutes', 'fairly_active_minutes',
        'very_active_minutes', 'total_active_minutes', 'total_active_hours',
        'sedentary_hours', 'activity_level', 'step_goal_percentage',
        'primary_activity_type', 'sleep_score', 'activity_score', 'overall_health_score',
        'fetched_at_sleep', 'source_date_sleep', 'extracted_at_sleep', 'processed_at_sleep',
        'fetched_at_activity', 'source_date_activity', 'extracted_at_activity', 'processed_at_activity',
        'has_complete_data', 'calculated_at'
    ]] if len(int_daily_health) > 0 else int_daily_health

    if len(int_daily_health) > 0:
        int_daily_health = int_daily_health.rename(columns={
            'fetched_at_sleep': 'sleep_fetched_at',
            'source_date_sleep': 'sleep_source_date',
            'extracted_at_sleep': 'sleep_extracted_at',
            'processed_at_sleep': 'sleep_processed_at',
            'fetched_at_activity': 'activity_fetched_at',
            'source_date_activity': 'activity_source_date',
            'extracted_at_activity': 'activity_extracted_at',
            'processed_at_activity': 'activity_processed_at'
        })
    else:
        int_daily_health = pd.DataFrame()

    # 5. int_productivity_metrics - 生産性メトリクス
    int_productivity = pd.DataFrame({
        'id': [str(uuid.uuid4())[:8] for _ in range(n_days)],
        'user_id': 'default_user',
        'metric_date': date_range,
        'total_work_minutes': np.random.uniform(240, 480, n_days).round(0),
        'total_work_hours': np.random.uniform(4, 8, n_days).round(2),
        'session_count': np.random.randint(3, 8, n_days),
        'completed_tasks': np.random.randint(2, 10, n_days),
        'average_session_duration': np.random.uniform(25, 60, n_days).round(1),
        'pomodoro_sessions': np.random.randint(0, 12, n_days),
        'flow_time_minutes': np.random.uniform(0, 180, n_days).round(0),
        'break_minutes': np.random.uniform(30, 120, n_days).round(0),
        'avg_mood': np.random.uniform(1, 5, n_days).round(1),
        'avg_dopamine': np.random.uniform(30, 70, n_days).round(1),
        'focus_score': np.random.uniform(50, 90, n_days).round(1),
        'context_switches': np.random.randint(0, 10, n_days),
        'deep_work_ratio': np.random.uniform(0.2, 0.8, n_days).round(2),
        'most_productive_time_slot': np.random.choice([
            'early_morning', 'morning', 'late_morning', 'afternoon', 'late_afternoon', 'evening'
        ], n_days),
        'data_quality': np.random.choice(['high', 'medium', 'low'], n_days, p=[0.5, 0.3, 0.2]),
        'overall_productivity_score': np.random.uniform(60, 90, n_days).round(1),
        'pomodoro_compliance_rate': np.random.uniform(60, 100, n_days).round(1),
        'created_at': datetime.now()
    })

    # 6. mart_productivity_daily - Mart層（ダミー）
    mart_productivity_daily = pd.DataFrame({
        'id': [str(uuid.uuid4())[:8] for _ in range(n_days)],
        'user_id': 'default_user',
        'date': date_range,
        'sleep_score': np.random.uniform(60, 90, n_days).round(1),
        'activity_score': np.random.uniform(60, 90, n_days).round(1),
        'health_score': np.random.uniform(60, 90, n_days).round(1),
        'work_sessions': np.random.randint(3, 10, n_days),
        'work_hours': np.random.uniform(4, 9, n_days).round(2),
        'avg_session_duration': np.random.uniform(30, 60, n_days).round(1),
        'pomodoro_rate': np.random.uniform(60, 100, n_days).round(1),
        'productivity_score': np.random.uniform(60, 90, n_days).round(1),
        'focus_score': np.random.uniform(60, 90, n_days).round(1),
        'mood_level': np.random.uniform(3, 5, n_days).round(1),
        'dopamine_level': np.random.uniform(30, 70, n_days).round(1),
        'most_productive_time_slot': np.random.choice([
            'early_morning', 'morning', 'late_morning', 'afternoon', 'late_afternoon', 'evening'
        ], n_days),
        'wellness_productivity_index': np.random.uniform(60, 90, n_days).round(1),
        'performance_category': np.random.choice([
            'optimal', 'balanced', 'overworked', 'underutilized', 'needs_attention'
        ], n_days),
        'data_completeness': np.random.choice(['complete', 'partial', 'incomplete'], n_days),
        'calculated_at': datetime.now()
    })

    # 7. mart_wellness_correlation - Mart層（ダミー）
    mart_wellness_correlation = pd.DataFrame({
        'id': [str(uuid.uuid4())[:8] for _ in range(n_days)],
        'user_id': 'default_user',
        'date': date_range,
        'sleep_score': np.random.uniform(60, 90, n_days).round(1),
        'productivity_score': np.random.uniform(60, 90, n_days).round(1),
        'sleep_productivity_corr': np.random.uniform(-1, 1, n_days).round(2),
        'sleep_change': np.random.uniform(-10, 10, n_days).round(1),
        'productivity_change': np.random.uniform(-10, 10, n_days).round(1),
        'sleep_7d_avg': np.random.uniform(60, 80, n_days).round(1),
        'productivity_7d_avg': np.random.uniform(60, 80, n_days).round(1),
        'impact_category': np.random.choice([
            'positive_impact', 'negative_impact', 'no_impact'
        ], n_days),
        'weekly_summary': np.random.choice([
            'excellent_week', 'good_week', 'needs_improvement'
        ], n_days),
        'calculated_at': datetime.now()
    })

    return {
        'stg_fitbit_sleep_json': stg_fitbit_sleep,
        'stg_fitbit_activity_json': stg_fitbit_activity,
        'stg_work_sessions': stg_work_sessions,
        'int_daily_health_summary': int_daily_health,
        'int_productivity_metrics': int_productivity,
        'mart_productivity_daily': mart_productivity_daily,
        'mart_wellness_correlation': mart_wellness_correlation,
    }
