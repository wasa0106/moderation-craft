{{ config(
    materialized='incremental',
    unique_key='small_task_id',
    on_schema_change='sync_all_columns'
) }}

-- モックデータから直接読み込み
WITH source_data AS (
    SELECT
        *
    FROM mock_small_tasks_raw
    {% if is_incremental() %}
      WHERE updated_at > (SELECT MAX(updated_at) FROM {{ this }})
    {% endif %}
)

SELECT
    small_task_id,
    user_id,
    project_id,
    big_task_id,
    task_name,
    status,
    priority,
    estimated_time_minutes,
    actual_time_minutes,
    completed_at,
    version,
    created_at,
    updated_at
FROM source_data
