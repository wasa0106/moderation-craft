{{ config(
    materialized='table',
    unique_key='date_key'
) }}

/*
日付ディメンションテーブル
- 2024-01-01 から 2027-12-31 まで（4年分）の日付マスター
- 曜日、週、月、四半期、年などの属性を事前計算
- 静的データなのでtableとしてマテリアライズ
*/

WITH date_spine AS (
    SELECT
        CAST(generate_series AS DATE) AS date
    FROM generate_series(
        DATE '{{ var("start_date") }}',
        DATE '{{ var("start_date") }}' + INTERVAL '4 years' - INTERVAL '1 day',
        INTERVAL '1 day'
    )
),

date_attributes AS (
    SELECT
        date,
        -- サロゲートキー（YYYYMMDD形式の整数）
        CAST(strftime(date, '%Y%m%d') AS INTEGER) AS date_key,

        -- 日レベル
        EXTRACT(DAY FROM date) AS day_of_month,
        EXTRACT(DOW FROM date) AS day_of_week_num,  -- 0=日曜, 6=土曜
        DAYNAME(date) AS day_of_week,

        -- 週レベル
        EXTRACT(WEEK FROM date) AS week_of_year,
        DATE_TRUNC('week', date) AS week_start_date,

        -- 月レベル
        EXTRACT(MONTH FROM date) AS month,
        MONTHNAME(date) AS month_name,
        DATE_TRUNC('month', date) AS month_start_date,

        -- 四半期レベル
        EXTRACT(QUARTER FROM date) AS quarter,
        DATE_TRUNC('quarter', date) AS quarter_start_date,

        -- 年レベル
        EXTRACT(YEAR FROM date) AS year,
        DATE_TRUNC('year', date) AS year_start_date,

        -- 曜日フラグ
        CASE
            WHEN EXTRACT(DOW FROM date) IN (0, 6) THEN TRUE
            ELSE FALSE
        END AS is_weekend,

        CASE
            WHEN EXTRACT(DOW FROM date) BETWEEN 1 AND 5 THEN TRUE
            ELSE FALSE
        END AS is_workday,

        -- 日本の祝日判定（簡易版、将来的に拡張可能）
        CASE
            WHEN EXTRACT(MONTH FROM date) = 1 AND EXTRACT(DAY FROM date) = 1 THEN TRUE  -- 元日
            WHEN EXTRACT(MONTH FROM date) = 12 AND EXTRACT(DAY FROM date) = 31 THEN TRUE  -- 大晦日
            ELSE FALSE
        END AS is_holiday,

        -- 日付タイプ（分析用カテゴリ）
        CASE
            WHEN EXTRACT(MONTH FROM date) = 1 AND EXTRACT(DAY FROM date) = 1 THEN 'holiday'
            WHEN EXTRACT(MONTH FROM date) = 12 AND EXTRACT(DAY FROM date) = 31 THEN 'holiday'
            WHEN EXTRACT(DOW FROM date) IN (0, 6) THEN 'weekend'
            ELSE 'weekday'
        END AS day_type
    FROM date_spine
)

SELECT
    date_key,
    date,
    day_of_month,
    day_of_week_num,
    day_of_week,
    week_of_year,
    week_start_date,
    month,
    month_name,
    month_start_date,
    quarter,
    quarter_start_date,
    year,
    year_start_date,

    -- 日付タイプフラグ（分析用）
    is_weekend,      -- 土日判定
    is_workday,      -- 平日判定（月〜金）
    is_holiday,      -- 祝日判定
    day_type,        -- カテゴリ: 'weekday', 'weekend', 'holiday'

    -- メタデータ
    CURRENT_TIMESTAMP AS created_at
FROM date_attributes
ORDER BY date
