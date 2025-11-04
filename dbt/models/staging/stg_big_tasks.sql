{{ config(
    materialized='incremental',
    unique_key='big_task_id',
    on_schema_change='sync_all_columns'
) }}

-- モックデータから直接読み込み
WITH source_data AS (
    SELECT
        *
    FROM mock_big_tasks_raw
    {% if is_incremental() %}
      WHERE updated_at > (SELECT MAX(updated_at) FROM {{ this }})
    {% endif %}
)

SELECT
    big_task_id,
    user_id,
    project_id,
    big_task_name,
    category,
    status,
    task_type,
    estimated_hours,
    actual_hours,
    start_date,
    end_date,
    version,
    created_at,
    updated_at
FROM source_data
