-- 相関データの一貫性チェック
WITH correlation_checks AS (
    SELECT
        user_id,
        date,
        sleep_score,
        productivity_score,
        correlation_pattern,
        sleep_7d_avg,
        productivity_7d_avg,
        -- パターンの検証
        CASE
            WHEN sleep_score > sleep_7d_avg 
             AND productivity_score > productivity_7d_avg 
             AND correlation_pattern != 'both_improving' THEN 'pattern_mismatch'
            WHEN sleep_score < sleep_7d_avg 
             AND productivity_score < productivity_7d_avg 
             AND correlation_pattern != 'both_declining' THEN 'pattern_mismatch'
            ELSE 'ok'
        END AS pattern_check,
        -- 7日平均の妥当性チェック
        CASE
            WHEN sleep_7d_avg > 100 OR sleep_7d_avg < 0 THEN 'invalid_avg'
            WHEN productivity_7d_avg > 100 OR productivity_7d_avg < 0 THEN 'invalid_avg'
            ELSE 'ok'
        END AS avg_check
    FROM {{ ref('mart_wellness_correlation') }}
    WHERE date >= CURRENT_DATE - INTERVAL '7 days'
)

SELECT
    user_id,
    date,
    pattern_check,
    avg_check,
    correlation_pattern,
    ROUND(sleep_score, 2) AS sleep_score,
    ROUND(sleep_7d_avg, 2) AS sleep_7d_avg,
    ROUND(productivity_score, 2) AS productivity_score,
    ROUND(productivity_7d_avg, 2) AS productivity_7d_avg
FROM correlation_checks
WHERE pattern_check != 'ok' OR avg_check != 'ok'