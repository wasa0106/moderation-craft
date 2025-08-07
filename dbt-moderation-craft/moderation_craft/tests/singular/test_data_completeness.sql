-- 過去7日間のデータ完全性チェック
WITH expected_dates AS (
    SELECT DISTINCT date_day
    FROM (
        SELECT CURRENT_DATE - INTERVAL (n) DAY AS date_day
        FROM (
            SELECT 0 AS n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3
            UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6
        ) AS days
    ) AS date_range
),

actual_data AS (
    SELECT DISTINCT
        user_id,
        date
    FROM {{ ref('mart_productivity_daily') }}
    WHERE date >= CURRENT_DATE - INTERVAL '7 days'
),

users AS (
    SELECT DISTINCT user_id
    FROM actual_data
),

expected_combinations AS (
    SELECT 
        u.user_id,
        d.date_day AS expected_date
    FROM users u
    CROSS JOIN expected_dates d
),

missing_data AS (
    SELECT 
        e.user_id,
        e.expected_date AS missing_date
    FROM expected_combinations e
    LEFT JOIN actual_data a
        ON e.user_id = a.user_id AND e.expected_date = a.date
    WHERE a.date IS NULL
)

SELECT 
    COUNT(*) AS missing_records,
    STRING_AGG(CONCAT(user_id, ':', missing_date), ', ') AS missing_details
FROM missing_data
HAVING COUNT(*) > 0