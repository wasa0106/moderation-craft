{{ config(
    materialized='incremental',
    unique_key='project_id',
    on_schema_change='sync_all_columns'
) }}

-- モックデータから直接読み込み
WITH source_data AS (
    SELECT
        *
    FROM mock_projects_raw
    {% if is_incremental() %}
      WHERE updated_at > (SELECT MAX(updated_at) FROM {{ this }})
    {% endif %}
)

SELECT
    project_id,
    user_id,
    project_name,
    description,
    color,
    status,
    deadline,
    estimated_total_hours,
    version,
    created_at,
    updated_at
FROM source_data
