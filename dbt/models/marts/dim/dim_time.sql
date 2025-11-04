{{ config(
    materialized='table',
    unique_key='time_key'
) }}

/*
時間ディメンションテーブル
- 00:00 から 23:59 まで（1分刻み、1440レコード）の時刻マスター
- 時間帯分類（time_slot）ロジックを集約
- 元々stg_work_sessions.sqlにあったtime_slot計算をこのディメンションに移行
*/

WITH time_spine AS (
    SELECT
        CAST(generate_series AS INTEGER) AS minute_of_day
    FROM generate_series(0, 1439)  -- 0分 ～ 1439分（23:59）
),

time_attributes AS (
    SELECT
        minute_of_day,

        -- 時刻計算（整数除算を使用）
        minute_of_day // 60 AS hour,
        minute_of_day % 60 AS minute,

        -- サロゲートキー（HHMM形式の整数）
        (minute_of_day // 60) * 100 + (minute_of_day % 60) AS time_key,

        -- 時刻文字列（HH:MM形式）
        printf('%02d:%02d', CAST(minute_of_day / 60 AS INTEGER), CAST(minute_of_day % 60 AS INTEGER)) AS time_label,

        -- 時間帯分類（元stg_work_sessions.sql L77-85のロジック）
        CASE
            WHEN minute_of_day // 60 < 6 THEN 'early_morning'   -- 0:00-5:59
            WHEN minute_of_day // 60 < 9 THEN 'morning'         -- 6:00-8:59
            WHEN minute_of_day // 60 < 12 THEN 'late_morning'   -- 9:00-11:59
            WHEN minute_of_day // 60 < 15 THEN 'afternoon'      -- 12:00-14:59
            WHEN minute_of_day // 60 < 18 THEN 'late_afternoon' -- 15:00-17:59
            WHEN minute_of_day // 60 < 21 THEN 'evening'        -- 18:00-20:59
            ELSE 'night'                                        -- 21:00-23:59
        END AS time_slot,

        -- ビジネスアワーフラグ（9:00-18:00）
        CASE
            WHEN minute_of_day >= 540 AND minute_of_day < 1080 THEN TRUE
            ELSE FALSE
        END AS is_business_hours,

        -- ピークアワーフラグ（最も生産的な時間帯: 9:00-12:00, 14:00-17:00）
        CASE
            WHEN (minute_of_day >= 540 AND minute_of_day < 720)
              OR (minute_of_day >= 840 AND minute_of_day < 1020) THEN TRUE
            ELSE FALSE
        END AS is_peak_hours,

        -- 深夜フラグ（22:00-6:00）
        CASE
            WHEN minute_of_day >= 1320 OR minute_of_day < 360 THEN TRUE
            ELSE FALSE
        END AS is_late_night
    FROM time_spine
)

SELECT
    time_key,
    hour,
    minute,
    minute_of_day,
    time_label,
    time_slot,
    is_business_hours,
    is_peak_hours,
    is_late_night,
    -- メタデータ
    CURRENT_TIMESTAMP AS created_at
FROM time_attributes
ORDER BY time_key
