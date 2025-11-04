{{ config(
    materialized='table',
    unique_key='project_key'
) }}

/*
プロジェクトディメンションテーブル
- stg_projectsから最新状態を取得
- SCD Type 1（最新値のみ保持）
- サロゲートキー: project_key（MD5ハッシュ）
*/

WITH latest_projects AS (
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
        updated_at,
        -- 同一project_idの最新レコードを取得
        ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY updated_at DESC, version DESC) AS rn
    FROM {{ ref('stg_projects') }}
)

SELECT
    -- サロゲートキー
    {{ dbt_utils.generate_surrogate_key(['project_id']) }} AS project_key,

    -- ビジネスキー
    project_id,
    user_id,

    -- プロジェクト属性
    project_name,
    description,
    color,
    status,
    deadline,
    estimated_total_hours,

    -- バージョン管理
    version,

    -- メタデータ
    created_at,
    updated_at,
    CURRENT_TIMESTAMP AS dbt_updated_at

FROM latest_projects
WHERE rn = 1
ORDER BY project_id
