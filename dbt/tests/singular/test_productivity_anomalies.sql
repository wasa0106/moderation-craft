-- 生産性データの異常値検出
WITH productivity_stats AS (
    SELECT
        user_id,
        AVG(productivity_score) AS avg_score,
        STDDEV(productivity_score) AS stddev_score
    FROM {{ ref('mart_productivity_daily') }}
    WHERE date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY user_id
),

anomalies AS (
    SELECT 
        p.user_id,
        p.date,
        p.productivity_score,
        s.avg_score,
        s.stddev_score,
        ABS(p.productivity_score - s.avg_score) AS deviation,
        CASE
            WHEN ABS(p.productivity_score - s.avg_score) > (3 * s.stddev_score) THEN 'extreme'
            WHEN ABS(p.productivity_score - s.avg_score) > (2 * s.stddev_score) THEN 'high'
            ELSE 'normal'
        END AS anomaly_level
    FROM {{ ref('mart_productivity_daily') }} p
    JOIN productivity_stats s
        ON p.user_id = s.user_id
    WHERE p.date >= CURRENT_DATE - INTERVAL '7 days'
)

SELECT
    user_id,
    date,
    productivity_score,
    ROUND(avg_score, 2) AS expected_score,
    ROUND(deviation, 2) AS deviation,
    anomaly_level
FROM anomalies
WHERE anomaly_level IN ('extreme', 'high')
ORDER BY deviation DESC