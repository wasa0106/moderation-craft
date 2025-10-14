{{ config(
    materialized='incremental',
    unique_key='session_id',
    on_schema_change='sync_all_columns'
) }}

WITH raw_json AS (
    SELECT
        unnest(data) as record
    FROM
        read_json_auto('{{ var("s3_bucket") }}/raw/internal/dynamodb-exports/dt=*/*.json')
),

raw_sessions AS (
    SELECT
        json_extract_string(record, '$.id') AS session_id,
        json_extract_string(record, '$.user_id') AS user_id,
        json_extract_string(record, '$.project_id') AS project_id,
        json_extract_string(record, '$.small_task_id') AS small_task_id,
        json_extract_string(record, '$.start_time') AS start_time,
        json_extract_string(record, '$.end_time') AS end_time,
        json_extract_string(record, '$.focus_level') AS focus_level,
        json_extract_string(record, '$.mood_rating') AS mood_rating,
        json_extract_string(record, '$.dopamine_level') AS dopamine_level,
        json_extract_string(record, '$.notes') AS notes,
        json_extract_string(record, '$.created_at') AS created_at,
        json_extract_string(record, '$.updated_at') AS updated_at,
        json_extract_string(record, '$.entity_type') AS entity_type,
        json_extract_string(record, '$.duration_seconds') AS duration_seconds
    FROM raw_json
    WHERE json_extract_string(record, '$.entity_type') = 'work_session'
    {% if is_incremental() %}
      AND DATE(TRY_CAST(json_extract_string(record, '$.created_at') AS TIMESTAMP)) > {{ days_ago(3) }}
    {% endif %}
),

processed AS (
    SELECT
        session_id,
        user_id,
        project_id,
        small_task_id,
        TRY_CAST(start_time AS TIMESTAMP) AS start_time,
        TRY_CAST(end_time AS TIMESTAMP) AS end_time,
        DATE(TRY_CAST(start_time AS TIMESTAMP)) AS session_date,
        TRY_CAST(focus_level AS INTEGER) AS focus_level,
        TRY_CAST(mood_rating AS INTEGER) AS mood_rating,
        TRY_CAST(dopamine_level AS INTEGER) AS dopamine_level,
        notes,
        TRY_CAST(created_at AS TIMESTAMP) AS created_at,
        TRY_CAST(updated_at AS TIMESTAMP) AS updated_at,
        TRY_CAST(duration_seconds AS INTEGER) AS duration_seconds
    FROM raw_sessions
    WHERE end_time IS NOT NULL
      AND start_time IS NOT NULL
      AND start_time < end_time
)

SELECT
    session_id,
    user_id,
    project_id,
    small_task_id,
    session_date,
    start_time,
    end_time,
    COALESCE(duration_seconds, EXTRACT(EPOCH FROM (end_time - start_time))) / 60 AS duration_minutes,
    COALESCE(mood_rating, focus_level, 3) AS mood_rating,  -- フォールバック
    COALESCE(dopamine_level, focus_level, 3) AS dopamine_level,  -- フォールバック
    notes,
    created_at,
    updated_at,
    -- タイムゾーン調整
    start_time AT TIME ZONE 'Asia/Tokyo' AS start_time_jst,
    end_time AT TIME ZONE 'Asia/Tokyo' AS end_time_jst,
    -- 時間帯分類
    CASE
        WHEN EXTRACT(HOUR FROM start_time AT TIME ZONE 'Asia/Tokyo') < 6 THEN 'early_morning'
        WHEN EXTRACT(HOUR FROM start_time AT TIME ZONE 'Asia/Tokyo') < 9 THEN 'morning'
        WHEN EXTRACT(HOUR FROM start_time AT TIME ZONE 'Asia/Tokyo') < 12 THEN 'late_morning'
        WHEN EXTRACT(HOUR FROM start_time AT TIME ZONE 'Asia/Tokyo') < 15 THEN 'afternoon'
        WHEN EXTRACT(HOUR FROM start_time AT TIME ZONE 'Asia/Tokyo') < 18 THEN 'late_afternoon'
        WHEN EXTRACT(HOUR FROM start_time AT TIME ZONE 'Asia/Tokyo') < 21 THEN 'evening'
        ELSE 'night'
    END AS time_slot,
    -- 曜日
    DAYNAME(session_date) AS day_of_week,
    -- 生産性スコア（ポモドーロベース）
    CASE
        WHEN COALESCE(duration_seconds, EXTRACT(EPOCH FROM (end_time - start_time))) / 60 BETWEEN 20 AND 30 THEN 100
        WHEN COALESCE(duration_seconds, EXTRACT(EPOCH FROM (end_time - start_time))) / 60 BETWEEN 15 AND 35 THEN 80
        WHEN COALESCE(duration_seconds, EXTRACT(EPOCH FROM (end_time - start_time))) / 60 BETWEEN 10 AND 40 THEN 60
        ELSE 40
    END AS session_productivity_score,
    -- メタデータ
    {{ get_jst_timestamp() }} AS processed_at
FROM processed