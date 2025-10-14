{{ config(
    materialized='incremental',
    unique_key='id',
    on_schema_change='fail'
) }}

WITH sleep_base AS (
    SELECT
        MD5(CONCAT(user_id, '::', sleep_date)) AS id,
        user_id,
        sleep_date,
        duration_ms,
        sleep_efficiency,
        minutes_asleep,
        minutes_awake,
        time_in_bed,
        deep_sleep_minutes,
        light_sleep_minutes,
        rem_sleep_minutes,
        wake_minutes,
        sleep_start_time,
        sleep_end_time,
        is_main_sleep,
        sleep_latency_seconds,
        fetched_at AS sleep_fetched_at,
        source_date AS sleep_source_date,
        extracted_at AS sleep_extracted_at,
        processed_at AS sleep_processed_at
    FROM {{ ref('stg_fitbit_sleep_json') }}
    WHERE COALESCE(is_main_sleep, TRUE)
),

activity_base AS (
    SELECT
        MD5(CONCAT(user_id, '::', activity_date)) AS id,
        user_id,
        activity_date,
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
        fetched_at AS activity_fetched_at,
        source_date AS activity_source_date,
        extracted_at AS activity_extracted_at,
        processed_at AS activity_processed_at
    FROM {{ ref('stg_fitbit_activity_json') }}
),

combined AS (
    SELECT
        COALESCE(s.id, a.id) AS id,
        COALESCE(s.user_id, a.user_id) AS user_id,
        COALESCE(s.sleep_date, a.activity_date) AS date,
        -- Sleep metrics (raw from staging)
        s.duration_ms,
        s.sleep_efficiency,
        s.minutes_asleep,
        s.minutes_awake,
        s.time_in_bed,
        s.deep_sleep_minutes,
        s.light_sleep_minutes,
        s.rem_sleep_minutes,
        s.wake_minutes,
        s.sleep_latency_seconds,
        s.sleep_start_time,
        s.sleep_end_time,
        s.sleep_fetched_at,
        s.sleep_source_date,
        s.sleep_extracted_at,
        s.sleep_processed_at,
        -- Activity metrics (raw from staging)
        a.steps,
        a.distance_km,
        a.calories_burned,
        a.calories_bmr,
        a.activity_calories,
        a.floors_climbed,
        a.elevation_meters,
        a.sedentary_minutes,
        a.lightly_active_minutes,
        a.fairly_active_minutes,
        a.very_active_minutes,
        a.activity_fetched_at,
        a.activity_source_date,
        a.activity_extracted_at,
        a.activity_processed_at
    FROM sleep_base s
    FULL OUTER JOIN activity_base a
        ON s.user_id = a.user_id AND s.sleep_date = a.activity_date
),

metrics AS (
    SELECT
        *,
        -- Sleep derived metrics
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
        CASE
            WHEN COALESCE(
                minutes_asleep,
                CASE WHEN duration_ms IS NOT NULL THEN duration_ms / 60000.0 ELSE NULL END
            ) IS NULL THEN NULL
            WHEN total_sleep_minutes < 300 THEN '5<'
            WHEN total_sleep_minutes < 360 THEN '5-6'
            WHEN total_sleep_minutes < 420 THEN '6-7'
            WHEN total_sleep_minutes < 480 THEN '7-8'
            WHEN total_sleep_minutes < 540 THEN '8-9'
            ELSE '9+'
        END AS sleep_duration_category,
        -- Activity derived metrics
        COALESCE(lightly_active_minutes, 0)
            + COALESCE(fairly_active_minutes, 0)
            + COALESCE(very_active_minutes, 0) AS total_active_minutes,
        ROUND((COALESCE(lightly_active_minutes, 0)
            + COALESCE(fairly_active_minutes, 0)
            + COALESCE(very_active_minutes, 0)) / 60.0, 2) AS total_active_hours,
        ROUND(COALESCE(sedentary_minutes, 0) / 60.0, 2) AS sedentary_hours,
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
        END AS steps_over_8000
    FROM combined
),

SELECT
    id,
    user_id,
    date,
    DAYNAME(date) AS day_of_week,
    WEEKOFYEAR(date) AS week_number,
    MONTH(date) AS month,
    YEAR(date) AS year,
    total_sleep_minutes,
    total_sleep_hours,
    sleep_efficiency,
    minutes_asleep,
    minutes_awake,
    time_in_bed,
    deep_sleep_minutes,
    light_sleep_minutes,
    rem_sleep_minutes,
    wake_minutes,
    deep_sleep_percent,
    rem_sleep_percent,
    light_sleep_percent,
    wake_percent,
    sleep_quality_category,
    sleep_duration_category,
    sleep_latency_seconds,
    sleep_start_time,
    sleep_end_time,
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
    total_active_minutes,
    total_active_hours,
    sedentary_hours,
    activity_level,
    step_goal_percentage,
    primary_activity_type,
    sleep_score,
    activity_score,
    overall_health_score,
    sleep_fetched_at,
    sleep_source_date,
    sleep_extracted_at,
    sleep_processed_at,
    activity_fetched_at,
    activity_source_date,
    activity_extracted_at,
    activity_processed_at,
    CASE
        WHEN total_sleep_hours IS NOT NULL AND steps IS NOT NULL THEN TRUE
        ELSE FALSE
    END AS has_complete_data,
    CURRENT_TIMESTAMP AS calculated_at
FROM final
{% if is_incremental() %}
WHERE date > (SELECT MAX(date) FROM {{ this }})
{% endif %}
