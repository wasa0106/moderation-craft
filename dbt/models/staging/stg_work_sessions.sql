{{ config(
    materialized='incremental',
    unique_key='session_id',
    on_schema_change='sync_all_columns'
) }}

-- モックデータから直接読み込み（S3 JSON読み込みの代わり）
WITH source_data AS (
    SELECT
        *
    FROM mock_work_sessions_raw
    {% if is_incremental() %}
      WHERE created_at > (SELECT MAX(created_at) FROM {{ this }})
    {% endif %}
)

SELECT
    session_id,
    user_id,
    project_id,
    small_task_id,
    start_time,
    end_time,
    duration_seconds,
    focus_level,
    mood_rating,
    dopamine_level,
    notes,
    created_at,
    updated_at,
    {{ get_jst_timestamp() }} AS processed_at
FROM source_data
