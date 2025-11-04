{{ config(
    materialized='incremental',
    unique_key='id',
    on_schema_change='fail'
) }}

-- モックデータから直接読み込み（S3 JSON読み込みの代わり）
WITH source_data AS (
    SELECT
        *
    FROM mock_fitbit_sleep_raw
    {% if is_incremental() %}
      WHERE sleep_date > (SELECT MAX(sleep_date) FROM {{ this }})
    {% endif %}
)

SELECT
    id,
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
    fetched_at,
    source_date,
    extracted_at,
    processed_at
FROM source_data
