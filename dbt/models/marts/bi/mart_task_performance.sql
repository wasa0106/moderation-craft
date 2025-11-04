{{ config(
    materialized='table'
) }}

/*
タスクパフォーマンス分析マート
- 予定vs実績の比較分析
- 見積もり精度の評価
- スケジュール遵守状況の可視化
*/

WITH task_plan AS (
    SELECT
        task_id,
        user_id,
        project_id,
        big_task_id,
        task_name,
        task_type,
        is_emergency,
        is_reportable,
        scheduled_start_jst,
        scheduled_end_jst,
        estimated_minutes,
        status,
        is_completed,
        is_cancelled,
        scheduled_day_of_week,
        scheduled_is_weekend,
        created_at,
        updated_at
    FROM {{ ref('fact_small_tasks') }}
),

task_actuals AS (
    SELECT
        small_task_id AS task_id,
        MIN(start_time_jst) AS actual_start_time,
        MAX(end_time_jst) AS actual_end_time,
        SUM(duration_minutes) AS actual_total_minutes,
        COUNT(*) AS session_count,
        AVG(focus_level) AS avg_focus_level,
        AVG(mood_rating) AS avg_mood_rating,
        AVG(dopamine_level) AS avg_dopamine_level,
        AVG(productivity_score) AS avg_productivity_score
    FROM {{ ref('fact_work_sessions') }}
    WHERE small_task_id IS NOT NULL
    GROUP BY small_task_id
)

SELECT
    p.task_id,
    p.user_id,
    p.project_id,
    p.big_task_id,
    p.task_name,
    p.task_type,
    p.is_emergency,
    p.is_reportable,
    p.status,
    p.is_completed,
    p.is_cancelled,

    -- 予定（計画値）
    p.scheduled_start_jst,
    p.scheduled_end_jst,
    p.estimated_minutes,
    p.scheduled_day_of_week,
    p.scheduled_is_weekend,

    -- 実績値
    a.actual_start_time,
    a.actual_end_time,
    a.actual_total_minutes,
    a.session_count,

    -- 差異分析（見積もり精度）
    COALESCE(a.actual_total_minutes, 0) - p.estimated_minutes AS variance_minutes,
    CASE
        WHEN p.estimated_minutes > 0
        THEN ROUND((COALESCE(a.actual_total_minutes, 0) - p.estimated_minutes)::DECIMAL / p.estimated_minutes * 100, 2)
        ELSE NULL
    END AS variance_percentage,

    -- 見積もり精度カテゴリ
    CASE
        WHEN a.actual_total_minutes IS NULL THEN 'not_started'
        WHEN ABS(COALESCE(a.actual_total_minutes, 0) - p.estimated_minutes) <= p.estimated_minutes * 0.1 THEN 'accurate'  -- ±10%以内
        WHEN COALESCE(a.actual_total_minutes, 0) > p.estimated_minutes THEN 'overestimated'
        ELSE 'underestimated'
    END AS estimation_accuracy,

    -- スケジュール遵守分析
    CASE
        WHEN a.actual_start_time IS NOT NULL AND a.actual_start_time <= p.scheduled_start_jst + INTERVAL '15 minutes'
        THEN TRUE
        ELSE FALSE
    END AS started_on_time,

    CASE
        WHEN p.is_completed AND a.actual_end_time <= p.scheduled_end_jst
        THEN TRUE
        WHEN p.is_completed AND a.actual_end_time > p.scheduled_end_jst
        THEN FALSE
        ELSE NULL
    END AS completed_on_time,

    -- 遅延時間（分）
    CASE
        WHEN a.actual_start_time > p.scheduled_start_jst
        THEN EXTRACT(EPOCH FROM (a.actual_start_time - p.scheduled_start_jst)) / 60
        ELSE 0
    END AS start_delay_minutes,

    -- 生産性メトリクス
    a.avg_focus_level,
    a.avg_mood_rating,
    a.avg_dopamine_level,
    a.avg_productivity_score,

    -- 実行ステータス
    CASE
        WHEN a.task_id IS NULL THEN 'not_started'
        WHEN p.is_completed THEN 'completed'
        WHEN p.is_cancelled THEN 'cancelled'
        ELSE 'in_progress'
    END AS execution_status,

    -- メタデータ
    p.created_at,
    p.updated_at,
    CURRENT_TIMESTAMP AS calculated_at

FROM task_plan p
LEFT JOIN task_actuals a ON p.task_id = a.task_id
