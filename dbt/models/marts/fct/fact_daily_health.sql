{{ config(
    materialized='incremental',
    unique_key='health_id',
    on_schema_change='sync_all_columns'
) }}

/*
日次健康データファクトテーブル
- int_daily_healthとディメンションテーブルをJOINしてサロゲートキーに変換
- 睡眠・活動データの派生メトリクス計算
- 日次単位の粒度を維持
*/

WITH health_summary AS (
    SELECT * FROM {{ ref('int_daily_health') }}
    {% if is_incremental() %}
    WHERE date > (SELECT MAX(date) FROM {{ this }})
    {% endif %}
),

-- ディメンションとのJOIN
health_with_dimensions AS (
    SELECT
        hs.id AS health_id,

        -- ディメンションキー（サロゲートキー）
        dd.date_key,

        -- ビジネスキー
        hs.user_id,
        hs.date,

        -- 日付属性
        hs.day_of_week,
        hs.week_number,
        hs.month,
        hs.year,

        -- 睡眠メトリクス（生値）
        hs.duration_ms,
        hs.sleep_efficiency,
        hs.minutes_asleep,
        hs.minutes_awake,
        hs.time_in_bed,
        hs.deep_sleep_minutes,
        hs.light_sleep_minutes,
        hs.rem_sleep_minutes,
        hs.wake_minutes,
        hs.sleep_latency_seconds,
        hs.sleep_start_time,
        hs.sleep_end_time,

        -- 活動メトリクス（生値）
        hs.steps,
        hs.distance_km,
        hs.calories_burned,
        hs.calories_bmr,
        hs.activity_calories,
        hs.floors_climbed,
        hs.elevation_meters,
        hs.sedentary_minutes,
        hs.lightly_active_minutes,
        hs.fairly_active_minutes,
        hs.very_active_minutes,

        -- ディメンション属性（分析用に非正規化）
        dd.is_weekend,
        dd.quarter,

        -- メタデータ
        hs.sleep_fetched_at,
        hs.sleep_source_date,
        hs.sleep_extracted_at,
        hs.sleep_processed_at,
        hs.activity_fetched_at,
        hs.activity_source_date,
        hs.activity_extracted_at,
        hs.activity_processed_at,
        hs.has_complete_data

    FROM health_summary hs
    LEFT JOIN {{ ref('dim_date') }} dd
        ON hs.date = dd.date
),

-- 派生メトリクス計算
final AS (
    SELECT
        health_id,
        date_key,
        user_id,
        date,
        day_of_week,
        week_number,
        month,
        year,
        is_weekend,
        quarter,

        -- 睡眠メトリクス（生値）
        duration_ms,
        sleep_efficiency,
        minutes_asleep,
        minutes_awake,
        time_in_bed,
        deep_sleep_minutes,
        light_sleep_minutes,
        rem_sleep_minutes,
        wake_minutes,
        sleep_latency_seconds,
        sleep_start_time,
        sleep_end_time,

        -- 睡眠派生メトリクス
        COALESCE(
            minutes_asleep,
            CASE WHEN duration_ms IS NOT NULL THEN ROUND(duration_ms / 60000.0, 2) ELSE NULL END
        ) AS total_sleep_minutes,

        CASE
            WHEN COALESCE(
                minutes_asleep,
                CASE WHEN duration_ms IS NOT NULL THEN duration_ms / 60000.0 ELSE NULL END
            ) IS NOT NULL
            THEN ROUND(
                COALESCE(
                    minutes_asleep,
                    duration_ms / 60000.0
                ) / 60.0,
                2
            )
            ELSE NULL
        END AS total_sleep_hours,

        ROUND(deep_sleep_minutes * 100.0 / NULLIF(
            COALESCE(
                minutes_asleep,
                CASE WHEN duration_ms IS NOT NULL THEN duration_ms / 60000.0 ELSE NULL END
            ),
            0
        ), 2) AS deep_sleep_percent,

        ROUND(rem_sleep_minutes * 100.0 / NULLIF(
            COALESCE(
                minutes_asleep,
                CASE WHEN duration_ms IS NOT NULL THEN duration_ms / 60000.0 ELSE NULL END
            ),
            0
        ), 2) AS rem_sleep_percent,

        ROUND(light_sleep_minutes * 100.0 / NULLIF(
            COALESCE(
                minutes_asleep,
                CASE WHEN duration_ms IS NOT NULL THEN duration_ms / 60000.0 ELSE NULL END
            ),
            0
        ), 2) AS light_sleep_percent,

        ROUND(wake_minutes * 100.0 / NULLIF(
            COALESCE(
                minutes_asleep,
                CASE WHEN duration_ms IS NOT NULL THEN duration_ms / 60000.0 ELSE NULL END
            ),
            0
        ), 2) AS wake_percent,

        -- 睡眠カテゴリ
        CASE
            WHEN COALESCE(
                minutes_asleep,
                CASE WHEN duration_ms IS NOT NULL THEN duration_ms / 60000.0 ELSE NULL END
            ) IS NULL THEN NULL
            WHEN COALESCE(
                minutes_asleep,
                CASE WHEN duration_ms IS NOT NULL THEN duration_ms / 60000.0 ELSE NULL END
            ) < 300 THEN '5<'
            WHEN COALESCE(
                minutes_asleep,
                CASE WHEN duration_ms IS NOT NULL THEN duration_ms / 60000.0 ELSE NULL END
            ) < 360 THEN '5-6'
            WHEN COALESCE(
                minutes_asleep,
                CASE WHEN duration_ms IS NOT NULL THEN duration_ms / 60000.0 ELSE NULL END
            ) < 420 THEN '6-7'
            WHEN COALESCE(
                minutes_asleep,
                CASE WHEN duration_ms IS NOT NULL THEN duration_ms / 60000.0 ELSE NULL END
            ) < 480 THEN '7-8'
            WHEN COALESCE(
                minutes_asleep,
                CASE WHEN duration_ms IS NOT NULL THEN duration_ms / 60000.0 ELSE NULL END
            ) < 540 THEN '8-9'
            ELSE '9+'
        END AS sleep_duration_category,

        -- 睡眠スコア（0-100）
        CASE
            WHEN COALESCE(
                minutes_asleep,
                CASE WHEN duration_ms IS NOT NULL THEN duration_ms / 60000.0 ELSE NULL END
            ) IS NULL THEN NULL
            ELSE ROUND(
                -- 睡眠時間スコア（50点満点）: 7-8時間で最高点
                LEAST(50, GREATEST(0,
                    50 - ABS(COALESCE(
                        minutes_asleep,
                        duration_ms / 60000.0
                    ) / 60.0 - 7.5) * 10
                )) +
                -- 睡眠効率スコア（30点満点）: 85%以上で満点
                LEAST(30, COALESCE(sleep_efficiency, 85) * 30 / 100.0) +
                -- 深い睡眠スコア（20点満点）: 20%以上で満点
                LEAST(20, COALESCE(deep_sleep_minutes, 0) * 100.0 / NULLIF(
                    COALESCE(
                        minutes_asleep,
                        duration_ms / 60000.0
                    ),
                    0
                ) * 100 / 20.0)
            , 0)
        END AS sleep_score,

        -- 活動メトリクス（生値）
        steps,
        distance_km,
        calories_burned,
        calories_bmr,
        activity_calories,
        floors_climbed,
        elevation_meters,
        sedentary_minutes,
        lightly_active_minutes,
        fairly_active_minutes,
        very_active_minutes,

        -- 活動派生メトリクス
        COALESCE(lightly_active_minutes, 0)
            + COALESCE(fairly_active_minutes, 0)
            + COALESCE(very_active_minutes, 0) AS total_active_minutes,

        ROUND((COALESCE(lightly_active_minutes, 0)
            + COALESCE(fairly_active_minutes, 0)
            + COALESCE(very_active_minutes, 0)) / 60.0, 2) AS total_active_hours,

        ROUND(COALESCE(sedentary_minutes, 0) / 60.0, 2) AS sedentary_hours,

        -- 活動カテゴリ
        CASE
            WHEN steps IS NULL THEN NULL
            WHEN steps < 3000 THEN '3000<'
            WHEN steps < 5000 THEN '3000-5000'
            WHEN steps < 8000 THEN '5001-8000'
            WHEN steps < 10000 THEN '8001-10000'
            ELSE '10001+'
        END AS activity_level,

        CASE
            WHEN steps IS NULL THEN NULL
            WHEN steps > 8000 THEN TRUE
            ELSE FALSE
        END AS steps_over_8000,

        -- 歩数目標達成率（10000歩を目標）
        ROUND(COALESCE(steps, 0) * 100.0 / 10000.0, 1) AS step_goal_percentage,

        -- 主要活動タイプ
        CASE
            WHEN very_active_minutes > 30 THEN 'high_intensity'
            WHEN fairly_active_minutes > 30 THEN 'moderate_intensity'
            WHEN lightly_active_minutes > 60 THEN 'light_activity'
            WHEN sedentary_minutes > 600 THEN 'sedentary'
            ELSE 'mixed'
        END AS primary_activity_type,

        -- 活動スコア（0-100）
        CASE
            WHEN steps IS NULL THEN NULL
            ELSE ROUND(
                -- 歩数スコア（40点満点）: 10000歩で満点
                LEAST(40, COALESCE(steps, 0) * 40.0 / 10000.0) +
                -- 活動時間スコア（30点満点）: 60分以上で満点
                LEAST(30, (COALESCE(lightly_active_minutes, 0)
                    + COALESCE(fairly_active_minutes, 0)
                    + COALESCE(very_active_minutes, 0)) * 30.0 / 60.0) +
                -- 高強度活動スコア（30点満点）: 30分以上で満点
                LEAST(30, (COALESCE(fairly_active_minutes, 0)
                    + COALESCE(very_active_minutes, 0)) * 30.0 / 30.0)
            , 0)
        END AS activity_score,

        -- 総合健康スコア（睡眠60% + 活動40%）
        CASE
            WHEN COALESCE(
                minutes_asleep,
                CASE WHEN duration_ms IS NOT NULL THEN duration_ms / 60000.0 ELSE NULL END
            ) IS NOT NULL AND steps IS NOT NULL
            THEN ROUND(
                -- 睡眠スコア計算（再利用）
                (LEAST(50, GREATEST(0,
                    50 - ABS(COALESCE(
                        minutes_asleep,
                        duration_ms / 60000.0
                    ) / 60.0 - 7.5) * 10
                )) +
                LEAST(30, COALESCE(sleep_efficiency, 85) * 30 / 100.0) +
                LEAST(20, COALESCE(deep_sleep_minutes, 0) * 100.0 / NULLIF(
                    COALESCE(
                        minutes_asleep,
                        duration_ms / 60000.0
                    ),
                    0
                ) * 100 / 20.0)) * 0.6 +
                -- 活動スコア計算（再利用）
                (LEAST(40, COALESCE(steps, 0) * 40.0 / 10000.0) +
                LEAST(30, (COALESCE(lightly_active_minutes, 0)
                    + COALESCE(fairly_active_minutes, 0)
                    + COALESCE(very_active_minutes, 0)) * 30.0 / 60.0) +
                LEAST(30, (COALESCE(fairly_active_minutes, 0)
                    + COALESCE(very_active_minutes, 0)) * 30.0 / 30.0)) * 0.4
            , 0)
            ELSE NULL
        END AS overall_health_score,

        -- メタデータ
        sleep_fetched_at,
        sleep_source_date,
        sleep_extracted_at,
        sleep_processed_at,
        activity_fetched_at,
        activity_source_date,
        activity_extracted_at,
        activity_processed_at,
        has_complete_data,
        CURRENT_TIMESTAMP AS calculated_at

    FROM health_with_dimensions
),

-- 健康カテゴリディメンションとのJOIN
final_with_category AS (
    SELECT
        f.*,
        hc.health_category_key
    FROM final f
    LEFT JOIN {{ ref('dim_health_category') }} hc
        ON f.sleep_duration_category = hc.sleep_duration_category
        AND f.activity_level = hc.activity_level
        AND f.primary_activity_type = hc.primary_activity_type
        AND CASE
            WHEN f.sleep_score >= 70 AND f.activity_score >= 60 THEN 'optimal'
            WHEN f.sleep_score >= 50 AND f.activity_score >= 40 THEN 'balanced'
            ELSE 'needs_attention'
        END = hc.wellness_status
)

SELECT * FROM final_with_category
