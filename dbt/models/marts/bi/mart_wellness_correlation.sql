{{ config(
    materialized='table',
    unique_key='id'
) }}

WITH daily_data AS (
    SELECT * FROM {{ ref('mart_productivity_daily') }}
    WHERE data_completeness IN ('complete', 'partial')
),

lagged_data AS (
    SELECT
        *,
        -- 前日のデータ
        LAG(sleep_score, 1) OVER (PARTITION BY user_id ORDER BY date) AS prev_sleep_score,
        LAG(activity_score, 1) OVER (PARTITION BY user_id ORDER BY date) AS prev_activity_score,
        LAG(productivity_score, 1) OVER (PARTITION BY user_id ORDER BY date) AS prev_productivity_score,
        LAG(mood_level, 1) OVER (PARTITION BY user_id ORDER BY date) AS prev_mood_level,
        -- 7日移動平均
        AVG(sleep_score) OVER (
            PARTITION BY user_id 
            ORDER BY date 
            ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
        ) AS sleep_score_7d_avg,
        AVG(activity_score) OVER (
            PARTITION BY user_id 
            ORDER BY date 
            ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
        ) AS activity_score_7d_avg,
        AVG(productivity_score) OVER (
            PARTITION BY user_id 
            ORDER BY date 
            ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
        ) AS productivity_score_7d_avg,
        -- トレンド（現在値 - 7日平均）
        sleep_score - AVG(sleep_score) OVER (
            PARTITION BY user_id 
            ORDER BY date 
            ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
        ) AS sleep_trend,
        productivity_score - AVG(productivity_score) OVER (
            PARTITION BY user_id 
            ORDER BY date 
            ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
        ) AS productivity_trend
    FROM daily_data
),

correlation_metrics AS (
    SELECT
        user_id,
        date,
        -- 基本データ
        sleep_score,
        activity_score,
        health_score,
        productivity_score,
        mood_level,
        dopamine_level,
        -- 前日比較
        sleep_score - prev_sleep_score AS sleep_change,
        productivity_score - prev_productivity_score AS productivity_change,
        mood_level - prev_mood_level AS mood_change,
        -- 移動平均
        sleep_score_7d_avg,
        activity_score_7d_avg,
        productivity_score_7d_avg,
        -- トレンド
        sleep_trend,
        productivity_trend,
        -- 相関パターン
        CASE
            WHEN sleep_score > sleep_score_7d_avg 
             AND productivity_score > productivity_score_7d_avg THEN 'both_improving'
            WHEN sleep_score < sleep_score_7d_avg 
             AND productivity_score < productivity_score_7d_avg THEN 'both_declining'
            WHEN sleep_score > sleep_score_7d_avg 
             AND productivity_score < productivity_score_7d_avg THEN 'sleep_up_productivity_down'
            WHEN sleep_score < sleep_score_7d_avg 
             AND productivity_score > productivity_score_7d_avg THEN 'sleep_down_productivity_up'
            ELSE 'stable'
        END AS correlation_pattern,
        -- 睡眠の生産性への影響（前日睡眠→当日生産性）
        CASE
            WHEN prev_sleep_score >= 80 AND productivity_score >= 80 THEN 'positive_impact'
            WHEN prev_sleep_score < 60 AND productivity_score < 60 THEN 'negative_impact'
            WHEN prev_sleep_score >= 80 AND productivity_score < 60 THEN 'no_impact'
            ELSE 'mixed_impact'
        END AS sleep_impact_on_productivity
    FROM lagged_data
)

SELECT
    MD5(CONCAT(user_id, '::', date)) AS id,
    user_id,
    date,
    DAYNAME(date) AS day_of_week,
    WEEKOFYEAR(date) AS week_number,
    MONTH(date) AS month,
    YEAR(date) AS year,
    -- 当日スコア
    sleep_score,
    activity_score,
    health_score,
    productivity_score,
    mood_level,
    dopamine_level,
    -- 変化量
    COALESCE(sleep_change, 0) AS sleep_change,
    COALESCE(productivity_change, 0) AS productivity_change,
    COALESCE(mood_change, 0) AS mood_change,
    -- 7日移動平均
    ROUND(sleep_score_7d_avg, 2) AS sleep_7d_avg,
    ROUND(activity_score_7d_avg, 2) AS activity_7d_avg,
    ROUND(productivity_score_7d_avg, 2) AS productivity_7d_avg,
    -- トレンド
    ROUND(sleep_trend, 2) AS sleep_trend,
    ROUND(productivity_trend, 2) AS productivity_trend,
    -- 相関分析
    correlation_pattern,
    sleep_impact_on_productivity,
    -- 週間パフォーマンス
    CASE
        WHEN sleep_score_7d_avg >= 80 AND productivity_score_7d_avg >= 80 THEN 'excellent_week'
        WHEN sleep_score_7d_avg >= 60 AND productivity_score_7d_avg >= 60 THEN 'good_week'
        ELSE 'challenging_week'
    END AS weekly_performance,
    -- インサイト生成用フラグ
    CASE
        WHEN ABS(sleep_change) > 20 OR ABS(productivity_change) > 20 THEN TRUE
        ELSE FALSE
    END AS significant_change,
    CASE
        WHEN sleep_trend < -10 OR productivity_trend < -10 THEN TRUE
        ELSE FALSE
    END AS needs_intervention,
    -- メタデータ
    CURRENT_TIMESTAMP AS calculated_at
FROM correlation_metrics