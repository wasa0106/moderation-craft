{{ config(
    materialized='incremental',
    unique_key='session_id',
    on_schema_change='sync_all_columns'
) }}

WITH raw_sessions AS (
    SELECT 
        Item.id.S AS session_id,
        Item.userId.S AS user_id,
        Item.projectId.S AS project_id,
        Item.smallTaskId.S AS small_task_id,
        Item.startTime.N AS start_time_epoch,
        Item.endTime.N AS end_time_epoch,
        Item.moodRating.N AS mood_rating,
        Item.dopamineLevel.N AS dopamine_level,
        Item.notes.S AS notes,
        Item.createdAt.N AS created_at_epoch,
        Item.updatedAt.N AS updated_at_epoch,
        Item.entityType.S AS entity_type,
        _duckdb_source_file AS source_file
    FROM 
        read_parquet('{{ var("s3_bucket") }}/raw/internal/dynamodb-exports/year=*/month=*/day=*/*.parquet')
    WHERE Item.entityType.S = 'WorkSession'
    {% if is_incremental() %}
      AND DATE(EPOCH_MS(TRY_CAST(Item.createdAt.N AS BIGINT))) > {{ days_ago(3) }}
    {% endif %}
),

processed AS (
    SELECT
        session_id,
        user_id,
        project_id,
        small_task_id,
        -- エポックミリ秒からタイムスタンプに変換
        EPOCH_MS(TRY_CAST(start_time_epoch AS BIGINT)) AS start_time,
        EPOCH_MS(TRY_CAST(end_time_epoch AS BIGINT)) AS end_time,
        DATE(EPOCH_MS(TRY_CAST(start_time_epoch AS BIGINT))) AS session_date,
        TRY_CAST(mood_rating AS INTEGER) AS mood_rating,
        TRY_CAST(dopamine_level AS INTEGER) AS dopamine_level,
        notes,
        EPOCH_MS(TRY_CAST(created_at_epoch AS BIGINT)) AS created_at,
        EPOCH_MS(TRY_CAST(updated_at_epoch AS BIGINT)) AS updated_at,
        source_file
    FROM raw_sessions
    WHERE end_time_epoch IS NOT NULL
      AND start_time_epoch < end_time_epoch
)

SELECT 
    session_id,
    user_id,
    project_id,
    small_task_id,
    session_date,
    start_time,
    end_time,
    EXTRACT(EPOCH FROM (end_time - start_time)) / 60 AS duration_minutes,
    mood_rating,
    dopamine_level,
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
        WHEN EXTRACT(EPOCH FROM (end_time - start_time)) / 60 >= 25 
         AND EXTRACT(EPOCH FROM (end_time - start_time)) / 60 <= 30 THEN 100  -- ポモドーロ完璧
        WHEN EXTRACT(EPOCH FROM (end_time - start_time)) / 60 >= 20 
         AND EXTRACT(EPOCH FROM (end_time - start_time)) / 60 <= 35 THEN 80
        WHEN EXTRACT(EPOCH FROM (end_time - start_time)) / 60 >= 15 
         AND EXTRACT(EPOCH FROM (end_time - start_time)) / 60 <= 45 THEN 60
        ELSE 40
    END AS session_productivity_score,
    source_file,
    {{ get_jst_timestamp() }} AS processed_at
FROM processed