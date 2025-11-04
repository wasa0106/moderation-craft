{{ config(
    materialized='incremental',
    unique_key='id',
    on_schema_change='fail'
) }}

/*
日次健康データ中間テーブル
- 睡眠と活動データを日次単位で統合
- ビジネスロジックは最小限（fact層に委譲）
- 生データのクレン���ングと統合のみ
*/

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
    {% if is_incremental() %}
    AND sleep_date > (SELECT MAX(date) FROM {{ this }})
    {% endif %}
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
    {% if is_incremental() %}
    WHERE activity_date > (SELECT MAX(date) FROM {{ this }})
    {% endif %}
)

SELECT
    COALESCE(s.id, a.id) AS id,
    COALESCE(s.user_id, a.user_id) AS user_id,
    COALESCE(s.sleep_date, a.activity_date) AS date,

    -- 日付属性（基本的な情報のみ）
    DAYNAME(COALESCE(s.sleep_date, a.activity_date)) AS day_of_week,
    WEEKOFYEAR(COALESCE(s.sleep_date, a.activity_date)) AS week_number,
    MONTH(COALESCE(s.sleep_date, a.activity_date)) AS month,
    YEAR(COALESCE(s.sleep_date, a.activity_date)) AS year,

    -- 睡眠メトリクス（生値のみ）
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

    -- 活動メトリクス（生値のみ）
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
    a.activity_processed_at,

    -- データ完全性フラグ
    CASE
        WHEN s.minutes_asleep IS NOT NULL AND a.steps IS NOT NULL THEN TRUE
        ELSE FALSE
    END AS has_complete_data

FROM sleep_base s
FULL OUTER JOIN activity_base a
    ON s.user_id = a.user_id AND s.sleep_date = a.activity_date
