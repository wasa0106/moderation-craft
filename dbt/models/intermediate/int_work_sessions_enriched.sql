{{ config(
    materialized='incremental',
    unique_key='session_id',
    on_schema_change='sync_all_columns'
) }}

/*
作業セッション中間層（エンリッチメント済み）
- タスク情報をJOINして関連IDを付与
- ファクトテーブルで使いやすい形に整形
- プロジェクト・BigTask属性はディメンションテーブルから参照
*/

WITH base_sessions AS (
    SELECT * FROM {{ ref('stg_work_sessions') }}
    {% if is_incremental() %}
    WHERE created_at > (SELECT MAX(created_at) FROM {{ this }})
    {% endif %}
),

-- SmallTaskからbig_task_idを取得
sessions_enriched AS (
    SELECT
        s.*,
        t.big_task_id
    FROM base_sessions s
    LEFT JOIN {{ ref('stg_small_tasks') }} t
        ON s.small_task_id = t.small_task_id
)

SELECT
    -- セッションID
    session_id,
    user_id,

    -- 関連エンティティID（ディメンションテーブルへの参照用）
    project_id,
    small_task_id,
    big_task_id,

    -- セッション時刻
    start_time,
    end_time,
    duration_seconds,

    -- メトリクス
    focus_level,
    mood_rating,
    dopamine_level,

    -- メタデータ
    notes,
    created_at,
    updated_at,
    processed_at,

    -- 集計用の補助カラム
    DATE(start_time) AS session_date,
    EXTRACT(HOUR FROM start_time) AS session_hour,
    CASE
        WHEN EXTRACT(DOW FROM start_time) IN (0, 6) THEN TRUE
        ELSE FALSE
    END AS is_weekend_session

FROM sessions_enriched
