{{ config(
    materialized='incremental',
    unique_key='user_key',
    on_schema_change='sync_all_columns'
) }}

/*
ユーザーディメンションテーブル
- SCD Type 2（Slowly Changing Dimension Type 2）対応
- ユーザー属性の履歴管理が可能
- 現時点では属性が少ないが、将来的にプロフィール情報などを追加可能
*/

WITH source_users AS (
    SELECT DISTINCT
        user_id,
        MIN(created_at) AS first_seen_at
    FROM {{ ref('stg_work_sessions') }}
    {% if is_incremental() %}
    WHERE created_at > (SELECT MAX(effective_from) FROM {{ this }})
    {% endif %}
    GROUP BY user_id
),

new_or_changed_users AS (
    SELECT
        user_id,
        first_seen_at,
        -- 将来的にユーザー属性を追加する場合はここに追加
        '{{ var("timezone") }}' AS timezone,
        first_seen_at AS effective_from,
        CAST(NULL AS TIMESTAMP) AS effective_to,
        TRUE AS is_current
    FROM source_users
    {% if is_incremental() %}
    WHERE user_id NOT IN (
        SELECT user_id
        FROM {{ this }}
        WHERE is_current = TRUE
    )
    {% endif %}
)

SELECT
    -- サロゲートキー（UUID生成）
    MD5(CONCAT(user_id, '::', effective_from)) AS user_key,

    -- ビジネスキー
    user_id,

    -- 属性
    timezone,

    -- SCD Type 2 管理用カラム
    effective_from,
    effective_to,
    is_current,

    -- メタデータ
    CURRENT_TIMESTAMP AS created_at,
    CURRENT_TIMESTAMP AS updated_at
FROM new_or_changed_users

{% if is_incremental() %}
UNION ALL

-- 既存レコードをそのまま保持
SELECT
    user_key,
    user_id,
    timezone,
    effective_from,
    effective_to,
    is_current,
    created_at,
    updated_at
FROM {{ this }}
{% endif %}
