{{ config(
    materialized='incremental',
    unique_key='id',
    on_schema_change='fail'
) }}

WITH raw_data AS (
    SELECT
        *
    FROM read_json_auto('{{ var("s3_bucket") }}/raw/fitbit/year=*/month=*/day=*/sleep_*.json')
),

sleep_records AS (
    SELECT
        'default_user' AS user_id,
        json_extract_string(metadata, '$.data_date') AS data_date,
        json_extract_string(metadata, '$.extraction_timestamp') AS extraction_timestamp,
        json_extract(data, '$.sleep[0]') AS sleep_record
    FROM raw_data
),

source_data AS (
    SELECT
        user_id,
        data_date,
        extraction_timestamp,
        json_extract_string(sleep_record, '$.dateOfSleep') AS date,
        json_extract_string(sleep_record, '$.duration') AS duration_ms_raw,
        json_extract_string(sleep_record, '$.efficiency') AS efficiency_raw,
        json_extract_string(sleep_record, '$.minutesAsleep') AS minutes_asleep_raw,
        json_extract_string(sleep_record, '$.minutesAwake') AS minutes_awake_raw,
        json_extract_string(sleep_record, '$.timeInBed') AS time_in_bed_raw,
        json_extract_string(sleep_record, '$.levels.summary.deep.minutes') AS deep_minutes_raw,
        json_extract_string(sleep_record, '$.levels.summary.light.minutes') AS light_minutes_raw,
        json_extract_string(sleep_record, '$.levels.summary.rem.minutes') AS rem_minutes_raw,
        json_extract_string(sleep_record, '$.levels.summary.wake.minutes') AS wake_minutes_raw,
        json_extract_string(sleep_record, '$.startTime') AS start_time_raw,
        json_extract_string(sleep_record, '$.endTime') AS end_time_raw,
        json_extract_string(sleep_record, '$.isMainSleep') AS is_main_sleep_raw,
        -- Sleep latency: levels配列の最初の要素がwakeの場合、そのsecondsを取得
        CASE
            WHEN json_extract_string(sleep_record, '$.levels.data[0].level') = 'wake'
            THEN json_extract_string(sleep_record, '$.levels.data[0].seconds')
            ELSE NULL
        END AS sleep_latency_seconds_raw,
        CURRENT_TIMESTAMP AS fetched_at
    FROM sleep_records
    {% if is_incremental() %}
      WHERE DATE(json_extract_string(sleep_record, '$.dateOfSleep')) > (SELECT MAX(sleep_date) FROM {{ this }})
    {% endif %}
),

cleaned AS (
    SELECT
        MD5(CONCAT(user_id, '::', date)) AS id,
        user_id,
        DATE(date) AS sleep_date,
        TRY_CAST(duration_ms_raw AS BIGINT) AS duration_ms,
        TRY_CAST(efficiency_raw AS DECIMAL(5, 2)) AS sleep_efficiency,
        TRY_CAST(minutes_asleep_raw AS INTEGER) AS minutes_asleep,
        TRY_CAST(minutes_awake_raw AS INTEGER) AS minutes_awake,
        TRY_CAST(time_in_bed_raw AS INTEGER) AS time_in_bed,
        TRY_CAST(deep_minutes_raw AS INTEGER) AS deep_sleep_minutes,
        TRY_CAST(light_minutes_raw AS INTEGER) AS light_sleep_minutes,
        TRY_CAST(rem_minutes_raw AS INTEGER) AS rem_sleep_minutes,
        TRY_CAST(wake_minutes_raw AS INTEGER) AS wake_minutes,
        TRY_CAST(start_time_raw AS TIMESTAMP) AS sleep_start_time,
        TRY_CAST(end_time_raw AS TIMESTAMP) AS sleep_end_time,
        CASE
            WHEN LOWER(is_main_sleep_raw) = 'true' THEN TRUE
            WHEN LOWER(is_main_sleep_raw) = 'false' THEN FALSE
            ELSE NULL
        END AS is_main_sleep,
        TRY_CAST(sleep_latency_seconds_raw AS INTEGER) AS sleep_latency_seconds,
        fetched_at,
        data_date AS source_date,
        TRY_CAST(extraction_timestamp AS TIMESTAMP) AS extracted_at,
        {{ get_jst_timestamp() }} AS processed_at
    FROM source_data
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
FROM cleaned
