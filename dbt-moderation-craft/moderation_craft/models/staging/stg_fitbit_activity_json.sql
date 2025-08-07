{{ config(
    materialized='incremental',
    unique_key='id',
    on_schema_change='fail'
) }}

WITH source_data AS (
    SELECT 
        'default_user' AS user_id,
        json_extract_string(data, '$.summary.steps') AS steps,
        json_extract_string(data, '$.summary.distances[0].distance') AS distance,
        json_extract_string(data, '$.summary.caloriesOut') AS calories_out,
        json_extract_string(data, '$.summary.activityCalories') AS activity_calories,
        json_extract_string(data, '$.summary.veryActiveMinutes') AS very_active_minutes,
        json_extract_string(data, '$.summary.fairlyActiveMinutes') AS fairly_active_minutes,
        json_extract_string(data, '$.summary.lightlyActiveMinutes') AS lightly_active_minutes,
        json_extract_string(data, '$.summary.sedentaryMinutes') AS sedentary_minutes,
        json_extract_string(data, '$.activities-date') AS activity_date,
        CURRENT_TIMESTAMP AS fetched_at,
        _duckdb_source_file AS source_file
    FROM 
        read_json_auto('{{ var("s3_bucket") }}/raw/fitbit/year=*/month=*/day=*/activity_*.json',
                       columns = {data: 'JSON'})
    {% if is_incremental() %}
    WHERE DATE(json_extract_string(data, '$.activities-date')) > (SELECT MAX(activity_date) FROM {{ this }})
    {% endif %}
),

cleaned AS (
    SELECT
        MD5(CONCAT(user_id, '::', activity_date)) AS id,
        user_id,
        DATE(activity_date) AS activity_date,
        TRY_CAST(steps AS INTEGER) AS steps,
        TRY_CAST(distance AS DECIMAL(10,3)) AS distance_km,
        TRY_CAST(calories_out AS INTEGER) AS calories_burned,
        TRY_CAST(activity_calories AS INTEGER) AS activity_calories,
        TRY_CAST(very_active_minutes AS INTEGER) AS very_active_minutes,
        TRY_CAST(fairly_active_minutes AS INTEGER) AS fairly_active_minutes,
        TRY_CAST(lightly_active_minutes AS INTEGER) AS lightly_active_minutes,
        TRY_CAST(sedentary_minutes AS INTEGER) AS sedentary_minutes,
        fetched_at,
        source_file,
        {{ get_jst_timestamp() }} AS processed_at
    FROM source_data
    WHERE activity_date IS NOT NULL
)

SELECT 
    *,
    -- 派生メトリクス
    very_active_minutes + fairly_active_minutes + lightly_active_minutes AS total_active_minutes,
    ROUND((very_active_minutes + fairly_active_minutes + lightly_active_minutes) / 60.0, 2) AS total_active_hours,
    ROUND(sedentary_minutes / 60.0, 2) AS sedentary_hours,
    CASE 
        WHEN steps >= 10000 THEN 'excellent'
        WHEN steps >= 7500 THEN 'good'
        WHEN steps >= 5000 THEN 'fair'
        ELSE 'low'
    END AS activity_level,
    CASE
        WHEN very_active_minutes >= 30 THEN 'high_intensity'
        WHEN fairly_active_minutes >= 30 THEN 'moderate_intensity'
        WHEN lightly_active_minutes >= 60 THEN 'light_intensity'
        ELSE 'sedentary'
    END AS primary_activity_type
FROM cleaned
