{{ config(
    materialized='incremental',
    unique_key='session_id',
    on_schema_change='sync_all_columns'
) }}

/*
作業セッションファクトテーブル
- int_work_sessions_enrichedからエンリッチメント済みデータを取得
- ディメンションテーブルとJOINしてサロゲートキーに変換
- 生産性スコア計算などのビジネスロジックを適用
- セッション単位の粒度を維持
*/

WITH work_sessions AS (
    SELECT * FROM {{ ref('int_work_sessions_enriched') }}
    {% if is_incremental() %}
    WHERE created_at > (SELECT MAX(created_at) FROM {{ this }})
    {% endif %}
),

-- タイムゾーン変換（JST）
sessions_with_jst AS (
    SELECT
        *,
        start_time AT TIME ZONE '{{ var("timezone") }}' AS start_time_jst,
        end_time AT TIME ZONE '{{ var("timezone") }}' AS end_time_jst
    FROM work_sessions
),

-- ディメンションとのJOIN
sessions_with_dimensions AS (
    SELECT
        ws.session_id,

        -- ディメンションキー（サロゲートキー）
        dd.date_key,
        dt.time_key,
        dp.project_key,
        dbt.big_task_key,

        -- ビジネスキー
        ws.project_id,
        ws.small_task_id,
        ws.big_task_id,

        -- タイムスタンプ
        ws.start_time,
        ws.end_time,
        ws.start_time_jst,
        ws.end_time_jst,

        -- メトリクス（ファクト）
        ws.duration_seconds,
        ws.duration_seconds / 60.0 AS duration_minutes,
        ws.focus_level,
        ws.mood_rating,
        ws.dopamine_level,

        -- ディメンション属性（分析用に非正規化）
        dd.day_of_week,
        dd.is_weekend,
        dt.time_slot,
        dt.is_business_hours,

        -- メタデータ
        ws.notes,
        ws.created_at,
        ws.updated_at,
        ws.processed_at
    FROM sessions_with_jst ws
    LEFT JOIN {{ ref('dim_date') }} dd
        ON DATE(ws.start_time_jst) = dd.date
    LEFT JOIN {{ ref('dim_time') }} dt
        ON EXTRACT(HOUR FROM ws.start_time_jst) * 100 + EXTRACT(MINUTE FROM ws.start_time_jst) = dt.time_key
    LEFT JOIN {{ ref('dim_project') }} dp
        ON ws.project_id = dp.project_id
    LEFT JOIN {{ ref('dim_big_task') }} dbt
        ON ws.big_task_id = dbt.big_task_id
)

SELECT
    session_id,

    -- ディメンションキー（サロゲートキー）
    date_key,
    time_key,
    project_key,
    big_task_key,

    -- ビジネスキー
    project_id,
    small_task_id,
    big_task_id,

    -- タイムスタンプ
    start_time,
    end_time,
    start_time_jst,
    end_time_jst,

    -- メトリクス
    duration_seconds,
    duration_minutes,
    focus_level,

    -- mood/dopamineのフォールバック処理
    COALESCE(mood_rating, focus_level, 3) AS mood_rating,
    COALESCE(dopamine_level, focus_level, 3) AS dopamine_level,

    -- 生産性スコア計算
    CASE
        WHEN duration_minutes BETWEEN 20 AND 30 THEN 100
        WHEN duration_minutes BETWEEN 15 AND 35 THEN 80
        WHEN duration_minutes BETWEEN 10 AND 40 THEN 60
        ELSE 40
    END AS productivity_score,

    -- ディメンション属性（非正規化）
    day_of_week,
    is_weekend,
    time_slot,
    is_business_hours,

    -- メタデータ
    notes,
    created_at,
    updated_at,
    processed_at,
    CURRENT_TIMESTAMP AS calculated_at
FROM sessions_with_dimensions
