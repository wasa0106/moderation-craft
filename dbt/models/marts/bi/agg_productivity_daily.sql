{{ config(
    materialized='incremental',
    unique_key='id',
    on_schema_change='fail'
) }}

/*
日次生産性集計テーブル
- fact_work_sessionsからセッションを日次で集計
- ポモドーロ準拠率、時間パターン、生産性スコアを計算
- mart_productivity_dailyで使用される中間集計
*/

WITH session_data AS (
    SELECT
        'default_user' AS user_id,  -- ユーザー機能未実装のためデフォルト値
        dd.date,
        fws.session_id,
        fws.project_id,
        fws.small_task_id,
        fws.start_time_jst,
        fws.end_time_jst,
        fws.duration_minutes,
        fws.time_slot,
        fws.day_of_week,
        fws.mood_rating,
        fws.dopamine_level,
        fws.productivity_score AS session_productivity_score
    FROM {{ ref('fact_work_sessions') }} fws
    LEFT JOIN {{ ref('dim_date') }} dd ON fws.date_key = dd.date_key
),

daily_aggregates AS (
    SELECT
        user_id,
        date,
        COUNT(DISTINCT session_id) AS total_sessions,
        COUNT(DISTINCT project_id) AS projects_worked,
        COUNT(DISTINCT small_task_id) AS tasks_worked,
        SUM(duration_minutes) AS total_work_minutes,
        AVG(duration_minutes) AS avg_session_duration,
        MAX(duration_minutes) AS max_session_duration,
        MIN(duration_minutes) AS min_session_duration,
        AVG(mood_rating) AS avg_mood,
        AVG(dopamine_level) AS avg_dopamine,
        AVG(session_productivity_score) AS avg_session_productivity,
        -- 時間帯別セッション数
        COUNT(CASE WHEN time_slot = 'morning' THEN 1 END) AS morning_sessions,
        COUNT(CASE WHEN time_slot = 'afternoon' THEN 1 END) AS afternoon_sessions,
        COUNT(CASE WHEN time_slot = 'evening' THEN 1 END) AS evening_sessions,
        COUNT(CASE WHEN time_slot = 'night' THEN 1 END) AS night_sessions,
        -- ポモドーロ準拠セッション
        COUNT(CASE WHEN duration_minutes BETWEEN 20 AND 30 THEN 1 END) AS pomodoro_sessions,
        -- 最も生産的な時間帯
        MODE() WITHIN GROUP (ORDER BY time_slot) AS most_productive_time_slot
    FROM session_data
    GROUP BY user_id, date
),

time_patterns AS (
    SELECT
        user_id,
        date,
        -- 作業開始・終了時刻
        MIN(start_time_jst) AS first_session_start,
        MAX(end_time_jst) AS last_session_end,
        -- 作業時間帯の広がり
        EXTRACT(HOUR FROM (MAX(end_time_jst) - MIN(start_time_jst))) AS work_span_hours,
        -- 休憩時間の推定（全体時間 - 実作業時間）
        EXTRACT(EPOCH FROM (MAX(end_time_jst) - MIN(start_time_jst))) / 60 - SUM(duration_minutes) AS estimated_break_minutes
    FROM session_data
    GROUP BY user_id, date
)

SELECT
    MD5(CONCAT(da.user_id, '::', da.date)) AS id,
    da.user_id,
    da.date,
    DAYNAME(da.date) AS day_of_week,
    WEEKOFYEAR(da.date) AS week_number,
    MONTH(da.date) AS month,
    YEAR(da.date) AS year,
    -- セッション統計
    da.total_sessions,
    da.projects_worked,
    da.tasks_worked,
    da.total_work_minutes,
    ROUND(da.total_work_minutes / 60.0, 2) AS total_work_hours,
    da.avg_session_duration,
    da.max_session_duration,
    da.min_session_duration,
    -- 心理状態
    ROUND(da.avg_mood, 2) AS avg_mood,
    ROUND(da.avg_dopamine, 2) AS avg_dopamine,
    -- 時間帯分析
    da.morning_sessions,
    da.afternoon_sessions,
    da.evening_sessions,
    da.night_sessions,
    da.most_productive_time_slot,
    -- ポモドーロ分析
    da.pomodoro_sessions,
    ROUND(da.pomodoro_sessions * 100.0 / NULLIF(da.total_sessions, 0), 2) AS pomodoro_compliance_rate,
    -- 時間パターン
    tp.first_session_start,
    tp.last_session_end,
    tp.work_span_hours,
    tp.estimated_break_minutes,
    -- 生産性スコア
    da.avg_session_productivity,
    -- 集中度スコア（長時間作業と短い休憩の組み合わせ）
    ROUND(
        (da.total_work_minutes / NULLIF(tp.work_span_hours * 60, 0)) * 100,
        2
    ) AS focus_score,
    -- 総合生産性スコア
    ROUND(
        (da.avg_session_productivity * 0.4) +                                           -- セッション生産性（40%）
        (da.pomodoro_sessions * 100.0 / NULLIF(da.total_sessions, 0) * 0.3) +          -- ポモドーロ準拠（30%）
        (LEAST((da.total_work_minutes / 60.0) / 8.0, 1) * 100 * 0.3),                  -- 作業時間（30%、8時間で満点）
        2
    ) AS overall_productivity_score,
    -- データ品質
    CASE
        WHEN da.total_sessions >= 5 THEN 'high'
        WHEN da.total_sessions >= 3 THEN 'medium'
        ELSE 'low'
    END AS data_quality,
    CURRENT_TIMESTAMP AS calculated_at
FROM daily_aggregates da
LEFT JOIN time_patterns tp
    ON da.user_id = tp.user_id AND da.date = tp.date
{% if is_incremental() %}
WHERE da.date > (SELECT MAX(date) FROM {{ this }})
{% endif %}