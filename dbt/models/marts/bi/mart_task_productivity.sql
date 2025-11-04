{{ config(
    materialized='table'
) }}

/*
タスク生産性分析マート
- タスク単位での生産性メトリクス集計
- セッション数・時間の分析
- タスクタイプ別・緊急度別の生産性比較
- 時間帯・曜日別のパフォーマンス分析
*/

WITH session_aggregates AS (
    SELECT
        ws.small_task_id AS task_id,

        -- セッション集計
        COUNT(ws.session_id) AS total_sessions,
        SUM(ws.duration_minutes) AS total_minutes,
        AVG(ws.duration_minutes) AS avg_session_duration,
        MIN(ws.duration_minutes) AS min_session_duration,
        MAX(ws.duration_minutes) AS max_session_duration,

        -- 生産性メトリクス
        AVG(ws.focus_level) AS avg_focus_level,
        AVG(ws.mood_rating) AS avg_mood_rating,
        AVG(ws.dopamine_level) AS avg_dopamine_level,
        AVG(ws.productivity_score) AS avg_productivity_score,

        -- 時間帯分析
        COUNT(CASE WHEN ws.is_weekend THEN 1 END) AS weekend_sessions,
        COUNT(CASE WHEN ws.is_business_hours THEN 1 END) AS business_hour_sessions,
        COUNT(CASE WHEN NOT ws.is_business_hours THEN 1 END) AS after_hours_sessions,

        -- 日付範囲
        MIN(DATE(ws.start_time_jst)) AS first_worked_date,
        MAX(DATE(ws.start_time_jst)) AS last_worked_date,

        -- 作業日数（ユニークな日付の数）
        COUNT(DISTINCT DATE(ws.start_time_jst)) AS worked_days_count

    FROM {{ ref('fact_work_sessions') }} ws
    WHERE ws.small_task_id IS NOT NULL
    GROUP BY ws.small_task_id
),

task_info AS (
    SELECT
        t.task_id,
        t.user_id,
        t.project_id,
        t.big_task_id,
        t.task_name,
        t.task_type,
        t.is_emergency,
        t.is_reportable,
        t.status,
        t.is_completed,
        t.estimated_minutes,
        t.created_at
    FROM {{ ref('fact_small_tasks') }} t
)

SELECT
    t.task_id,
    t.user_id,
    t.project_id,
    t.big_task_id,
    t.task_name,
    t.task_type,
    t.is_emergency,
    t.is_reportable,
    t.status,
    t.is_completed,

    -- 見積もり
    t.estimated_minutes,

    -- セッション集計
    COALESCE(s.total_sessions, 0) AS total_sessions,
    COALESCE(s.total_minutes, 0) AS total_minutes,
    s.avg_session_duration,
    s.min_session_duration,
    s.max_session_duration,

    -- 見積もり vs 実績
    CASE
        WHEN t.estimated_minutes > 0 AND s.total_minutes IS NOT NULL
        THEN ROUND((s.total_minutes - t.estimated_minutes)::DECIMAL / t.estimated_minutes * 100, 2)
        ELSE NULL
    END AS time_variance_percentage,

    -- 生産性メトリクス
    s.avg_focus_level,
    s.avg_mood_rating,
    s.avg_dopamine_level,
    s.avg_productivity_score,

    -- 生産性カテゴリ
    CASE
        WHEN s.avg_productivity_score >= 80 THEN 'high'
        WHEN s.avg_productivity_score >= 60 THEN 'medium'
        WHEN s.avg_productivity_score IS NOT NULL THEN 'low'
        ELSE NULL
    END AS productivity_category,

    -- 集中度カテゴリ
    CASE
        WHEN s.avg_focus_level >= 4 THEN 'high_focus'
        WHEN s.avg_focus_level >= 3 THEN 'medium_focus'
        WHEN s.avg_focus_level IS NOT NULL THEN 'low_focus'
        ELSE NULL
    END AS focus_category,

    -- 時間帯分析
    s.weekend_sessions,
    s.business_hour_sessions,
    s.after_hours_sessions,

    -- 週末作業比率
    CASE
        WHEN s.total_sessions > 0
        THEN ROUND(s.weekend_sessions::DECIMAL / s.total_sessions * 100, 2)
        ELSE 0
    END AS weekend_work_percentage,

    -- 作業期間
    s.first_worked_date,
    s.last_worked_date,
    s.worked_days_count,

    -- 作業期間の長さ（日数）
    CASE
        WHEN s.last_worked_date IS NOT NULL
        THEN s.last_worked_date - s.first_worked_date + 1
        ELSE NULL
    END AS work_span_days,

    -- 1日あたりの平均セッション数
    CASE
        WHEN s.worked_days_count > 0
        THEN ROUND(s.total_sessions::DECIMAL / s.worked_days_count, 2)
        ELSE NULL
    END AS avg_sessions_per_day,

    -- 1日あたりの平均作業時間（分）
    CASE
        WHEN s.worked_days_count > 0
        THEN ROUND(s.total_minutes::DECIMAL / s.worked_days_count, 2)
        ELSE NULL
    END AS avg_minutes_per_day,

    -- 実行ステータス
    CASE
        WHEN s.task_id IS NULL THEN 'not_started'
        WHEN t.is_completed THEN 'completed'
        ELSE 'in_progress'
    END AS execution_status,

    -- メタデータ
    t.created_at,
    CURRENT_TIMESTAMP AS calculated_at

FROM task_info t
LEFT JOIN session_aggregates s ON t.task_id = s.task_id
