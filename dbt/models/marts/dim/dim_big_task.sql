{{ config(
    materialized='table',
    unique_key='big_task_key'
) }}

/*
BigTaskディメンションテーブル
- stg_big_tasksから最新状態を取得
- dim_projectと結合してproject_keyを取得
- SCD Type 1（最新値のみ保持）
- サロゲートキー: big_task_key（MD5ハッシュ）
*/

WITH latest_big_tasks AS (
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
        updated_at,
        -- 同一big_task_idの最新レコードを取得
        ROW_NUMBER() OVER (PARTITION BY big_task_id ORDER BY updated_at DESC, version DESC) AS rn
    FROM {{ ref('stg_big_tasks') }}
)

SELECT
    -- サロゲートキー
    {{ dbt_utils.generate_surrogate_key(['bt.big_task_id']) }} AS big_task_key,

    -- ビジネスキー
    bt.big_task_id,
    bt.user_id,
    bt.project_id,

    -- プロジェクトディメンションへの外部キー
    dp.project_key,

    -- BigTask属性
    bt.big_task_name,
    bt.category,
    bt.status,
    bt.task_type,
    bt.estimated_hours,
    bt.actual_hours,
    bt.start_date,
    bt.end_date,

    -- バージョン管理
    bt.version,

    -- メタデータ
    bt.created_at,
    bt.updated_at,
    CURRENT_TIMESTAMP AS dbt_updated_at

FROM latest_big_tasks bt
LEFT JOIN {{ ref('dim_project') }} dp
    ON bt.project_id = dp.project_id
WHERE bt.rn = 1
ORDER BY bt.big_task_id
