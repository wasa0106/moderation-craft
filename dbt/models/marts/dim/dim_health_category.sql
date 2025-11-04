{{ config(
    materialized='table',
    unique_key='health_category_key'
) }}

/*
健康カテゴリJunk Dimension
- 睡眠・活動のカテゴリ組み合わせを管理
- work_sessionsとの相関分析用
- SCD Type 1（最新値のみ、履歴管理なし）
- int_daily_healthから直接計算（循環依存回避）
*/

WITH health_metrics AS (
    SELECT
        -- 睡眠時間を計算
        COALESCE(
            minutes_asleep,
            CASE WHEN duration_ms IS NOT NULL THEN duration_ms / 60000.0 ELSE NULL END
        ) / 60.0 AS total_sleep_hours,

        -- 睡眠カテゴリ
        CASE
            WHEN COALESCE(
                minutes_asleep,
                CASE WHEN duration_ms IS NOT NULL THEN duration_ms / 60000.0 ELSE NULL END
            ) IS NULL THEN 'unknown'
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

        -- 活動レベル
        CASE
            WHEN steps IS NULL THEN 'unknown'
            WHEN steps < 3000 THEN '3000<'
            WHEN steps < 5000 THEN '3000-5000'
            WHEN steps < 8000 THEN '5001-8000'
            WHEN steps < 10000 THEN '8001-10000'
            ELSE '10001+'
        END AS activity_level,

        -- 主要活動タイプ
        CASE
            WHEN very_active_minutes > 30 THEN 'high_intensity'
            WHEN fairly_active_minutes > 30 THEN 'moderate_intensity'
            WHEN lightly_active_minutes > 60 THEN 'light_activity'
            WHEN sedentary_minutes > 600 THEN 'sedentary'
            ELSE 'mixed'
        END AS primary_activity_type,

        -- 睡眠スコアを計算（fact_daily_healthと同じロジック）
        CASE
            WHEN COALESCE(
                minutes_asleep,
                CASE WHEN duration_ms IS NOT NULL THEN duration_ms / 60000.0 ELSE NULL END
            ) IS NULL THEN NULL
            ELSE ROUND(
                -- 睡眠時間スコア（50点満点）
                LEAST(50, GREATEST(0,
                    50 - ABS(COALESCE(
                        minutes_asleep,
                        duration_ms / 60000.0
                    ) / 60.0 - 7.5) * 10
                )) +
                -- 睡眠効率スコア（30点満点）
                LEAST(30, COALESCE(sleep_efficiency, 85) * 30 / 100.0) +
                -- 深い睡眠スコア（20点満点）
                LEAST(20, COALESCE(deep_sleep_minutes, 0) * 100.0 / NULLIF(
                    COALESCE(
                        minutes_asleep,
                        duration_ms / 60000.0
                    ),
                    0
                ) * 100 / 20.0)
            , 0)
        END AS sleep_score,

        -- 活動スコアを計算（fact_daily_healthと同じロジック）
        CASE
            WHEN steps IS NULL THEN NULL
            ELSE ROUND(
                -- 歩数スコア（40点満点）
                LEAST(40, COALESCE(steps, 0) * 40.0 / 10000.0) +
                -- 活動時間スコア（30点満点）
                LEAST(30, (COALESCE(lightly_active_minutes, 0)
                    + COALESCE(fairly_active_minutes, 0)
                    + COALESCE(very_active_minutes, 0)) * 30.0 / 60.0) +
                -- 高強度活動スコア（30点満点）
                LEAST(30, (COALESCE(fairly_active_minutes, 0)
                    + COALESCE(very_active_minutes, 0)) * 30.0 / 30.0)
            , 0)
        END AS activity_score,

        -- 生データ
        steps,
        minutes_asleep,
        duration_ms,
        sleep_efficiency,
        deep_sleep_minutes,
        lightly_active_minutes,
        fairly_active_minutes,
        very_active_minutes,
        sedentary_minutes

    FROM {{ ref('int_daily_health') }}
),

wellness_metrics AS (
    SELECT
        sleep_duration_category,
        activity_level,
        primary_activity_type,

        -- フラグ
        CASE WHEN total_sleep_hours >= 7 THEN TRUE ELSE FALSE END AS is_good_sleep,
        CASE WHEN steps >= 8000 THEN TRUE ELSE FALSE END AS is_active_day,

        -- ウェルネスステータス
        CASE
            WHEN sleep_score >= 70 AND activity_score >= 60 THEN 'optimal'
            WHEN sleep_score >= 50 AND activity_score >= 40 THEN 'balanced'
            ELSE 'needs_attention'
        END AS wellness_status

    FROM health_metrics
),

unique_combinations AS (
    SELECT DISTINCT
        sleep_duration_category,
        activity_level,
        primary_activity_type,
        is_good_sleep,
        is_active_day,
        wellness_status,
        -- 健康な日の判定
        CASE
            WHEN is_good_sleep AND is_active_day THEN TRUE
            ELSE FALSE
        END AS is_healthy_day
    FROM wellness_metrics
)

SELECT
    -- サロゲートキー（カテゴリの組み合わせから生成）
    {{ dbt_utils.generate_surrogate_key([
        'sleep_duration_category',
        'activity_level',
        'primary_activity_type',
        'wellness_status'
    ]) }} AS health_category_key,

    -- カテゴリ属性
    sleep_duration_category,
    activity_level,
    primary_activity_type,
    wellness_status,

    -- フラグ
    is_good_sleep,
    is_active_day,
    is_healthy_day,

    -- メタデータ
    CURRENT_TIMESTAMP AS dbt_updated_at

FROM unique_combinations
ORDER BY
    sleep_duration_category,
    activity_level,
    wellness_status
