{{ config(
    materialized='incremental',
    unique_key='id',
    on_schema_change='fail'
) }}

-- モックデータから直接読み込み（S3 JSON読み込みの代わり）
WITH source_data AS (
    SELECT
        *
    FROM mock_fitbit_activity_raw
    {% if is_incremental() %}
      WHERE activity_date > (SELECT MAX(activity_date) FROM {{ this }})
    {% endif %}
)

SELECT
    id,
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
    fetched_at,
    source_date,
    extracted_at,
    processed_at
FROM source_data
