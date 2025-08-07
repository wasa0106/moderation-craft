{{ config(
    materialized='table',
    unique_key='id'
) }}

WITH health_data AS (
    SELECT * FROM {{ ref('int_daily_health_summary') }}
),

productivity_data AS (
    SELECT * FROM {{ ref('int_productivity_metrics') }}
),

combined AS (
    SELECT
        COALESCE(h.user_id, p.user_id) AS user_id,
        COALESCE(h.date, p.date) AS date,
        -- 健康データ
        h.sleep_score,
        h.activity_score,
        h.overall_health_score,
        h.total_sleep_hours,
        h.sleep_quality_category,
        h.steps,
        h.activity_level,
        -- 生産性データ
        p.total_sessions,
        p.total_work_hours,
        p.avg_session_duration,
        p.pomodoro_compliance_rate,
        p.overall_productivity_score,
        p.avg_mood,
        p.avg_dopamine,
        p.most_productive_time_slot,
        p.focus_score,
        -- データ品質
        h.has_complete_data AS has_health_data,
        p.data_quality AS productivity_data_quality
    FROM health_data h
    FULL OUTER JOIN productivity_data p
        ON h.user_id = p.user_id AND h.date = p.date
)

SELECT
    MD5(CONCAT(user_id, '::', date)) AS id,
    user_id,
    date,
    DAYNAME(date) AS day_of_week,
    WEEKOFYEAR(date) AS week_number,
    MONTH(date) AS month,
    YEAR(date) AS year,
    QUARTER(date) AS quarter,
    -- 健康メトリクス
    COALESCE(sleep_score, 0) AS sleep_score,
    COALESCE(activity_score, 0) AS activity_score,
    COALESCE(overall_health_score, 0) AS health_score,
    total_sleep_hours,
    sleep_quality_category,
    steps,
    activity_level,
    -- 生産性メトリクス
    COALESCE(total_sessions, 0) AS work_sessions,
    COALESCE(total_work_hours, 0) AS work_hours,
    avg_session_duration,
    COALESCE(pomodoro_compliance_rate, 0) AS pomodoro_rate,
    COALESCE(overall_productivity_score, 0) AS productivity_score,
    COALESCE(focus_score, 0) AS focus_score,
    -- 心理状態
    avg_mood AS mood_level,
    avg_dopamine AS dopamine_level,
    -- 時間パターン
    most_productive_time_slot,
    -- 複合スコア（健康×生産性）
    ROUND(
        COALESCE(overall_health_score, 50) * 0.3 +
        COALESCE(overall_productivity_score, 50) * 0.5 +
        COALESCE(avg_mood, 3) * 20 * 0.2,
        2
    ) AS wellness_productivity_index,
    -- カテゴリ分類
    CASE
        WHEN COALESCE(overall_productivity_score, 0) >= 80 
         AND COALESCE(overall_health_score, 0) >= 80 THEN 'optimal'
        WHEN COALESCE(overall_productivity_score, 0) >= 60 
         AND COALESCE(overall_health_score, 0) >= 60 THEN 'balanced'
        WHEN COALESCE(overall_productivity_score, 0) >= 80 
         AND COALESCE(overall_health_score, 0) < 60 THEN 'overworked'
        WHEN COALESCE(overall_productivity_score, 0) < 60 
         AND COALESCE(overall_health_score, 0) >= 80 THEN 'underutilized'
        ELSE 'needs_attention'
    END AS performance_category,
    -- データ完全性
    CASE
        WHEN has_health_data AND productivity_data_quality IN ('high', 'medium') THEN 'complete'
        WHEN has_health_data OR productivity_data_quality IN ('high', 'medium') THEN 'partial'
        ELSE 'incomplete'
    END AS data_completeness,
    -- メタデータ
    CURRENT_TIMESTAMP AS calculated_at
FROM combined
WHERE date >= {{ days_ago(90) }}  -- 過去90日間のデータ