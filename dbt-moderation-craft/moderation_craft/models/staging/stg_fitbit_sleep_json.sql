{{ config(
    materialized='incremental',
    unique_key='id',
    on_schema_change='fail'
) }}

WITH source_data AS (
    SELECT 
        'default_user' AS user_id,  -- 将来的にユーザー識別を追加
        json_extract_string(data, '$.dateOfSleep') AS date,
        json_extract_string(data, '$.duration') AS duration,
        json_extract_string(data, '$.efficiency') AS efficiency,
        json_extract_string(data, '$.minutesAsleep') AS minutes_asleep,
        json_extract_string(data, '$.minutesAwake') AS minutes_awake,
        json_extract_string(data, '$.timeInBed') AS time_in_bed,
        json_extract_string(data, '$.levels.summary.deep.minutes') AS deep_minutes,
        json_extract_string(data, '$.levels.summary.light.minutes') AS light_minutes,
        json_extract_string(data, '$.levels.summary.rem.minutes') AS rem_minutes,
        json_extract_string(data, '$.levels.summary.wake.minutes') AS wake_minutes,
        json_extract_string(data, '$.startTime') AS start_time,
        json_extract_string(data, '$.endTime') AS end_time,
        CURRENT_TIMESTAMP AS fetched_at,
        _duckdb_source_file AS source_file
    FROM 
        read_json_auto('{{ var("s3_bucket") }}/raw/fitbit/year=*/month=*/day=*/sleep_*.json', 
                       columns = {data: 'JSON'})
    {% if is_incremental() %}
    WHERE DATE(json_extract_string(data, '$.dateOfSleep')) > (SELECT MAX(sleep_date) FROM {{ this }})
    {% endif %}
),

cleaned AS (
    SELECT
        MD5(CONCAT(user_id, '::', date)) AS id,
        user_id,
        DATE(date) AS sleep_date,
        TRY_CAST(duration AS BIGINT) / 60000 AS total_sleep_minutes,  -- ミリ秒から分に変換
        TRY_CAST(efficiency AS DECIMAL(5,2)) AS sleep_efficiency,
        TRY_CAST(minutes_asleep AS INTEGER) AS minutes_asleep,
        TRY_CAST(minutes_awake AS INTEGER) AS minutes_awake,
        TRY_CAST(time_in_bed AS INTEGER) AS time_in_bed,
        TRY_CAST(deep_minutes AS INTEGER) AS deep_sleep_minutes,
        TRY_CAST(light_minutes AS INTEGER) AS light_sleep_minutes,
        TRY_CAST(rem_minutes AS INTEGER) AS rem_sleep_minutes,
        TRY_CAST(wake_minutes AS INTEGER) AS wake_minutes,
        TRY_CAST(start_time AS TIMESTAMP) AS sleep_start_time,
        TRY_CAST(end_time AS TIMESTAMP) AS sleep_end_time,
        fetched_at,
        source_file,
        {{ get_jst_timestamp() }} AS processed_at
    FROM source_data
    WHERE date IS NOT NULL
)

SELECT 
    *,
    -- 派生メトリクス
    ROUND(total_sleep_minutes / 60.0, 2) AS total_sleep_hours,
    ROUND(deep_sleep_minutes * 100.0 / NULLIF(total_sleep_minutes, 0), 2) AS deep_sleep_percent,
    ROUND(rem_sleep_minutes * 100.0 / NULLIF(total_sleep_minutes, 0), 2) AS rem_sleep_percent,
    ROUND(light_sleep_minutes * 100.0 / NULLIF(total_sleep_minutes, 0), 2) AS light_sleep_percent,
    CASE 
        WHEN sleep_efficiency >= 85 THEN 'good'
        WHEN sleep_efficiency >= 75 THEN 'fair'
        ELSE 'poor'
    END AS sleep_quality_category,
    CASE
        WHEN total_sleep_minutes >= 420 AND total_sleep_minutes <= 540 THEN 'optimal'  -- 7-9時間
        WHEN total_sleep_minutes >= 360 AND total_sleep_minutes < 420 THEN 'short'     -- 6-7時間
        WHEN total_sleep_minutes > 540 THEN 'long'                                     -- 9時間以上
        ELSE 'very_short'                                                               -- 6時間未満
    END AS sleep_duration_category
FROM cleaned
