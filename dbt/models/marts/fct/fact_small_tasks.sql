{{ config(
    materialized='incremental',
    unique_key='small_task_id',
    on_schema_change='sync_all_columns'
) }}

/*
SmallTaskファクトテーブル（モックデータ用簡略版）
- タスク計画情報を管理
- スケジュール機能は未実装のためNULL
*/

WITH base_tasks AS (
    SELECT * FROM {{ ref('stg_small_tasks') }}
    {% if is_incremental() %}
    WHERE updated_at > (SELECT MAX(updated_at) FROM {{ this }})
       OR created_at > (SELECT MAX(created_at) FROM {{ this }})
    {% endif %}
)

SELECT
    small_task_id AS task_id,
    user_id,
    project_id,
    big_task_id,

    -- スケジュールキー（未実装のためNULL）
    NULL AS scheduled_date_key,
    NULL AS scheduled_time_key,
    NULL AS completed_date_key,
    NULL AS completed_time_key,

    -- ビジネスキー
    project_id AS project_business_id,
    big_task_id AS big_task_business_id,

    -- タスク属性
    task_name,
    status,
    priority,

    -- 時間メトリクス
    estimated_time_minutes,
    actual_time_minutes,
    CASE
        WHEN actual_time_minutes IS NOT NULL AND estimated_time_minutes > 0
        THEN actual_time_minutes - estimated_time_minutes
        ELSE NULL
    END AS time_variance_minutes,

    -- タイムスタンプ（スケジュールは未実装のためNULL）
    NULL AS scheduled_start,
    NULL AS scheduled_end,
    completed_at,
    created_at,
    updated_at,

    -- メタデータ
    version,
    {{ get_jst_timestamp() }} AS dbt_updated_at
FROM base_tasks
