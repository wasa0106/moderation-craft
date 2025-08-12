{{ config(
    materialized='table',
    unique_key='id'
) }}

WITH sleep_data AS (
    SELECT
        user_id,
        sleep_date AS date,
        total_sleep_hours,
        sleep_efficiency,
        deep_sleep_percent,
        rem_sleep_percent,
        light_sleep_percent,
        sleep_quality_category,
        sleep_duration_category
    FROM {{ ref('stg_fitbit_sleep_json') }}
),

activity_data AS (
    SELECT
        user_id,
        activity_date AS date,
        steps,
        distance_km,
        calories_burned,
        total_active_minutes,
        sedentary_minutes,
        activity_level,
        primary_activity_type
    FROM {{ ref('stg_fitbit_activity_json') }}
),

combined AS (
    SELECT
        COALESCE(s.user_id, a.user_id) AS user_id,
        COALESCE(s.date, a.date) AS date,
        -- 睡眠メトリクス
        s.total_sleep_hours,
        s.sleep_efficiency,
        s.deep_sleep_percent,
        s.rem_sleep_percent,
        s.light_sleep_percent,
        s.sleep_quality_category,
        s.sleep_duration_category,
        -- 活動メトリクス
        a.steps,
        a.distance_km,
        a.calories_burned,
        a.total_active_minutes,
        a.sedentary_minutes,
        a.activity_level,
        a.primary_activity_type
    FROM sleep_data s
    FULL OUTER JOIN activity_data a
        ON s.user_id = a.user_id AND s.date = a.date
)

SELECT
    MD5(CONCAT(user_id, '::', date)) AS id,
    user_id,
    date,
    DAYNAME(date) AS day_of_week,
    WEEKOFYEAR(date) AS week_number,
    MONTH(date) AS month,
    YEAR(date) AS year,
    -- 睡眠データ
    total_sleep_hours,
    sleep_efficiency,
    deep_sleep_percent,
    rem_sleep_percent,
    light_sleep_percent,
    sleep_quality_category,
    sleep_duration_category,
    -- 活動データ
    steps,
    distance_km,
    calories_burned,
    total_active_minutes,
    sedentary_minutes,
    activity_level,
    primary_activity_type,
    -- 睡眠スコア計算（100点満点）
    ROUND(
        COALESCE(total_sleep_hours / 8.0 * 30, 0) +                    -- 睡眠時間（30点）
        COALESCE(sleep_efficiency / 100.0 * 30, 0) +                   -- 睡眠効率（30点）
        COALESCE(deep_sleep_percent / 20.0 * 20, 0) +                  -- 深い睡眠（20点）
        COALESCE(rem_sleep_percent / 25.0 * 20, 0),                    -- REM睡眠（20点）
        2
    ) AS sleep_score,
    -- 活動スコア計算（100点満点）
    ROUND(
        LEAST(COALESCE(steps / 10000.0 * 40, 0), 40) +                -- 歩数（40点）
        LEAST(COALESCE(total_active_minutes / 30.0 * 30, 0), 30) +    -- アクティブ時間（30点）
        LEAST(COALESCE(calories_burned / 2000.0 * 30, 0), 30),        -- カロリー消費（30点）
        2
    ) AS activity_score,
    -- 総合健康スコア（睡眠と活動の平均）
    ROUND(
        (
            COALESCE(
                COALESCE(total_sleep_hours / 8.0 * 30, 0) +
                COALESCE(sleep_efficiency / 100.0 * 30, 0) +
                COALESCE(deep_sleep_percent / 20.0 * 20, 0) +
                COALESCE(rem_sleep_percent / 25.0 * 20, 0),
                0
            ) +
            COALESCE(
                LEAST(COALESCE(steps / 10000.0 * 40, 0), 40) +
                LEAST(COALESCE(total_active_minutes / 30.0 * 30, 0), 30) +
                LEAST(COALESCE(calories_burned / 2000.0 * 30, 0), 30),
                0
            )
        ) / 2,
        2
    ) AS overall_health_score,
    -- データ完全性フラグ
    CASE
        WHEN total_sleep_hours IS NOT NULL AND steps IS NOT NULL THEN TRUE
        ELSE FALSE
    END AS has_complete_data,
    CURRENT_TIMESTAMP AS calculated_at
FROM combined
