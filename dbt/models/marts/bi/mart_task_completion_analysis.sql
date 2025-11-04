{{ config(
    materialized='table'
) }}

/*
タスク完了状況分析マート
- タスク完了率の追跡
- 完了までの日数分析
- 未完了タスクの年齢（経過日数）管理
- ステータス遷移の可視化
*/

WITH task_metrics AS (
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
        t.is_cancelled,
        t.is_pending,
        t.is_in_progress,
        t.created_at,
        t.updated_at,
        DATE(t.scheduled_start_jst) AS scheduled_date,
        DATE(t.scheduled_end_jst) AS scheduled_end_date,
        t.estimated_minutes,
        t.scheduled_day_of_week,
        t.scheduled_is_weekend,

        -- 完了日（statusがcompletedになった日）
        CASE
            WHEN t.is_completed THEN DATE(t.updated_at)
            ELSE NULL
        END AS completion_date,

        -- 完了までの日数（作成日から完了日まで）
        CASE
            WHEN t.is_completed
            THEN DATE(t.updated_at) - DATE(t.created_at)
            ELSE NULL
        END AS days_to_complete,

        -- 予定通りに完了したか
        CASE
            WHEN t.is_completed AND DATE(t.updated_at) <= DATE(t.scheduled_end_jst)
            THEN TRUE
            WHEN t.is_completed AND DATE(t.updated_at) > DATE(t.scheduled_end_jst)
            THEN FALSE
            ELSE NULL
        END AS completed_on_schedule,

        -- 予定日からの遅延日数
        CASE
            WHEN t.is_completed AND DATE(t.updated_at) > DATE(t.scheduled_end_jst)
            THEN DATE(t.updated_at) - DATE(t.scheduled_end_jst)
            ELSE 0
        END AS completion_delay_days

    FROM {{ ref('fact_small_tasks') }} t
)

SELECT
    task_id,
    user_id,
    project_id,
    big_task_id,
    task_name,
    task_type,
    is_emergency,
    is_reportable,
    status,
    is_completed,
    is_cancelled,
    is_pending,
    is_in_progress,

    -- 日付情報
    scheduled_date,
    scheduled_end_date,
    completion_date,
    scheduled_day_of_week,
    scheduled_is_weekend,

    -- 完了分析
    days_to_complete,
    completed_on_schedule,
    completion_delay_days,

    -- タスク年齢（未完了タスクの経過日数）
    CASE
        WHEN NOT is_completed AND NOT is_cancelled
        THEN CURRENT_DATE - DATE(created_at)
        ELSE NULL
    END AS task_age_days,

    -- 予定日からの経過日数（未完了タスク用）
    CASE
        WHEN NOT is_completed AND NOT is_cancelled
        THEN CURRENT_DATE - scheduled_date
        ELSE NULL
    END AS days_since_scheduled,

    -- 期限超過フラグ
    CASE
        WHEN NOT is_completed AND NOT is_cancelled AND CURRENT_DATE > scheduled_end_date
        THEN TRUE
        ELSE FALSE
    END AS is_overdue,

    -- 期限超過日数
    CASE
        WHEN NOT is_completed AND NOT is_cancelled AND CURRENT_DATE > scheduled_end_date
        THEN CURRENT_DATE - scheduled_end_date
        ELSE 0
    END AS overdue_days,

    -- 完了確率予測（簡易版）
    CASE
        WHEN is_completed THEN 100
        WHEN is_cancelled THEN 0
        WHEN is_in_progress AND task_age_days <= 3 THEN 80
        WHEN is_in_progress AND task_age_days > 3 THEN 60
        WHEN is_pending AND task_age_days <= 7 THEN 50
        WHEN is_pending AND task_age_days > 7 THEN 30
        ELSE 40
    END AS completion_probability,

    -- 見積もり時間
    estimated_minutes,

    -- メタデータ
    created_at,
    updated_at,
    CURRENT_TIMESTAMP AS calculated_at

FROM task_metrics
