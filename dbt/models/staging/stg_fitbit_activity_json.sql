{{ config(
    materialized='incremental',
    unique_key='id',
    on_schema_change='fail'
) }}

WITH raw_data AS (
    SELECT
        *
    FROM read_json_auto('{{ var("s3_bucket") }}/raw/fitbit/year=*/month=*/day=*/activity_*.json')
),

activity_summary AS (
    SELECT
        'default_user' AS user_id,
        json_extract_string(metadata, '$.data_date') AS data_date,
        json_extract_string(metadata, '$.extraction_timestamp') AS extraction_timestamp,
        data
    FROM raw_data
),

source_data AS (
    SELECT
        user_id,
        data_date,
        extraction_timestamp,
        data_date AS activity_date,
        json_extract_string(data, '$.summary.steps') AS steps_raw,
        json_extract_string(data, '$.summary.distances[0].distance') AS distance_raw,
        json_extract_string(data, '$.summary.caloriesOut') AS calories_out_raw,
        json_extract_string(data, '$.summary.caloriesBMR') AS calories_bmr_raw,
        json_extract_string(data, '$.summary.activityCalories') AS activity_calories_raw,
        json_extract_string(data, '$.summary.floors') AS floors_raw,
        json_extract_string(data, '$.summary.elevation') AS elevation_raw,
        json_extract_string(data, '$.summary.sedentaryMinutes') AS sedentary_minutes_raw,
        json_extract_string(data, '$.summary.lightlyActiveMinutes') AS lightly_active_minutes_raw,
        json_extract_string(data, '$.summary.fairlyActiveMinutes') AS fairly_active_minutes_raw,
        json_extract_string(data, '$.summary.veryActiveMinutes') AS very_active_minutes_raw,
        CURRENT_TIMESTAMP AS fetched_at
    FROM activity_summary
    {% if is_incremental() %}
      WHERE DATE(data_date) > (SELECT MAX(activity_date) FROM {{ this }})
    {% endif %}
),

cleaned AS (
    SELECT
        MD5(CONCAT(user_id, '::', activity_date)) AS id,
        user_id,
        DATE(activity_date) AS activity_date,
        TRY_CAST(steps_raw AS INTEGER) AS steps,
        TRY_CAST(distance_raw AS DECIMAL(10, 3)) AS distance_km,
        TRY_CAST(calories_out_raw AS INTEGER) AS calories_burned,
        TRY_CAST(calories_bmr_raw AS INTEGER) AS calories_bmr,
        TRY_CAST(activity_calories_raw AS INTEGER) AS activity_calories,
        TRY_CAST(floors_raw AS INTEGER) AS floors_climbed,
        TRY_CAST(elevation_raw AS DECIMAL(10, 3)) AS elevation_meters,
        TRY_CAST(sedentary_minutes_raw AS INTEGER) AS sedentary_minutes,
        TRY_CAST(lightly_active_minutes_raw AS INTEGER) AS lightly_active_minutes,
        TRY_CAST(fairly_active_minutes_raw AS INTEGER) AS fairly_active_minutes,
        TRY_CAST(very_active_minutes_raw AS INTEGER) AS very_active_minutes,
        fetched_at,
        data_date AS source_date,
        TRY_CAST(extraction_timestamp AS TIMESTAMP) AS extracted_at,
        {{ get_jst_timestamp() }} AS processed_at
    FROM source_data
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
FROM cleaned
