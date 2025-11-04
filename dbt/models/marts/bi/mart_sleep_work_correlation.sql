{{ config(
    materialized='table',
    on_schema_change='sync_all_columns'
) }}

/*
睡眠と作業生産性の相関分析用マート
- 前日の睡眠データと当日の作業データを結合
- LAG関数で時系列相関を計算
- Streamlitアプリの睡眠分析ページで使用
*/

WITH daily_work_aggregated AS (
    -- 日次の作業データを集計
    SELECT
        DATE(ws.start_time_jst) AS work_date,
        ws.project_id,

        -- 作業時間メトリクス
        SUM(ws.duration_minutes) / 60.0 AS work_hours,
        COUNT(*) AS total_sessions,
        AVG(ws.duration_minutes) AS avg_session_duration,

        -- 生産性メトリクス
        AVG(ws.focus_level) AS avg_focus_score,
        AVG(ws.mood_rating) AS avg_mood_level,
        AVG(ws.dopamine_level) AS avg_dopamine_level,
        AVG(ws.productivity_score) AS avg_productivity_score,

        -- 最小/最大（範囲確認用）
        MIN(ws.focus_level) AS min_focus_score,
        MAX(ws.focus_level) AS max_focus_score
    FROM {{ ref('fact_work_sessions') }} ws
    GROUP BY DATE(ws.start_time_jst), ws.project_id
),

daily_sleep AS (
    -- 日次の睡眠データ（fact_daily_healthから取得）
    SELECT
        date AS sleep_date,
        user_id,

        -- 睡眠時間メトリクス
        total_sleep_hours,
        total_sleep_minutes,
        sleep_efficiency,
        sleep_score,
        sleep_duration_category,

        -- 睡眠構成
        deep_sleep_minutes,
        rem_sleep_minutes,
        light_sleep_minutes,
        wake_minutes,
        deep_sleep_percent,
        rem_sleep_percent,

        -- 活動メトリクス（参考用）
        steps,
        total_active_hours,
        activity_score,
        overall_health_score
    FROM {{ ref('fact_daily_health') }}
    WHERE total_sleep_hours IS NOT NULL  -- 睡眠データが存在する日のみ
),

work_with_prev_sleep AS (
    -- 作業データに前日の睡眠データを結合
    SELECT
        dw.work_date AS date,
        dw.project_id,

        -- 日付属性
        dd.day_of_week,
        dd.is_weekend,
        dd.week_of_year,
        dd.month,
        dd.quarter,
        dd.year,

        -- 前日の睡眠データ（LAG関数で取得）
        LAG(ds.total_sleep_hours, 1) OVER (
            PARTITION BY dw.project_id
            ORDER BY dw.work_date
        ) AS prev_sleep_hours,

        LAG(ds.sleep_efficiency, 1) OVER (
            PARTITION BY dw.project_id
            ORDER BY dw.work_date
        ) AS prev_sleep_efficiency,

        LAG(ds.sleep_score, 1) OVER (
            PARTITION BY dw.project_id
            ORDER BY dw.work_date
        ) AS prev_sleep_score,

        LAG(ds.sleep_duration_category, 1) OVER (
            PARTITION BY dw.project_id
            ORDER BY dw.work_date
        ) AS prev_sleep_category,

        LAG(ds.deep_sleep_minutes, 1) OVER (
            PARTITION BY dw.project_id
            ORDER BY dw.work_date
        ) AS prev_deep_sleep_minutes,

        LAG(ds.rem_sleep_minutes, 1) OVER (
            PARTITION BY dw.project_id
            ORDER BY dw.work_date
        ) AS prev_rem_sleep_minutes,

        LAG(ds.deep_sleep_percent, 1) OVER (
            PARTITION BY dw.project_id
            ORDER BY dw.work_date
        ) AS prev_deep_sleep_percent,

        LAG(ds.rem_sleep_percent, 1) OVER (
            PARTITION BY dw.project_id
            ORDER BY dw.work_date
        ) AS prev_rem_sleep_percent,

        -- 当日の作業データ
        dw.work_hours,
        dw.total_sessions,
        dw.avg_session_duration,
        dw.avg_focus_score,
        dw.avg_mood_level,
        dw.avg_dopamine_level,
        dw.avg_productivity_score,
        dw.min_focus_score,
        dw.max_focus_score,

        -- 当日の睡眠データ（参考用・翌日分析に使用）
        ds.total_sleep_hours AS current_sleep_hours,
        ds.sleep_score AS current_sleep_score,
        ds.sleep_duration_category AS current_sleep_category,

        -- 当日の活動データ（参考用）
        ds.steps AS current_steps,
        ds.total_active_hours AS current_active_hours,
        ds.activity_score AS current_activity_score,
        ds.overall_health_score AS current_health_score

    FROM daily_work_aggregated dw
    LEFT JOIN daily_sleep ds
        ON dw.work_date = ds.sleep_date
    LEFT JOIN {{ ref('dim_date') }} dd
        ON dw.work_date = dd.date
),

with_moving_averages AS (
    -- 7日移動平均を追加
    SELECT
        *,

        -- 睡眠の移動平均
        AVG(prev_sleep_hours) OVER (
            PARTITION BY project_id
            ORDER BY date
            ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
        ) AS sleep_7d_avg,

        -- 作業時間の移動平均
        AVG(work_hours) OVER (
            PARTITION BY project_id
            ORDER BY date
            ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
        ) AS work_7d_avg,

        -- 集中度の移動平均
        AVG(avg_focus_score) OVER (
            PARTITION BY project_id
            ORDER BY date
            ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
        ) AS focus_7d_avg,

        -- 睡眠スコアの移動平均
        AVG(prev_sleep_score) OVER (
            PARTITION BY project_id
            ORDER BY date
            ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
        ) AS sleep_score_7d_avg

    FROM work_with_prev_sleep
),

final AS (
    SELECT
        -- 主キー
        {{ dbt_utils.generate_surrogate_key(['date', 'project_id']) }} AS correlation_id,

        -- ビジネスキー
        date,
        project_id,

        -- 日付属性
        day_of_week,
        is_weekend,
        week_of_year,
        month,
        quarter,
        year,

        -- 前日の睡眠メトリクス
        prev_sleep_hours,
        prev_sleep_efficiency,
        prev_sleep_score,
        prev_sleep_category,
        prev_deep_sleep_minutes,
        prev_rem_sleep_minutes,
        prev_deep_sleep_percent,
        prev_rem_sleep_percent,

        -- 当日の作業メトリクス
        work_hours,
        total_sessions,
        avg_session_duration,
        avg_focus_score,
        avg_mood_level,
        avg_dopamine_level,
        avg_productivity_score,
        min_focus_score,
        max_focus_score,

        -- 当日の睡眠・健康データ（参考用）
        current_sleep_hours,
        current_sleep_score,
        current_sleep_category,
        current_steps,
        current_active_hours,
        current_activity_score,
        current_health_score,

        -- 移動平均（トレンド分析用）
        sleep_7d_avg,
        work_7d_avg,
        focus_7d_avg,
        sleep_score_7d_avg,

        -- 睡眠カテゴリの順序付け用インデックス
        CASE prev_sleep_category
            WHEN '5<' THEN 1
            WHEN '5-6' THEN 2
            WHEN '6-7' THEN 3
            WHEN '7-8' THEN 4
            WHEN '8-9' THEN 5
            WHEN '9+' THEN 6
            ELSE NULL
        END AS sleep_category_order,

        -- 睡眠品質フラグ
        CASE
            WHEN prev_sleep_hours >= 7 AND prev_sleep_hours <= 8
                AND prev_sleep_efficiency >= 85 THEN TRUE
            ELSE FALSE
        END AS is_optimal_sleep,

        CASE
            WHEN prev_sleep_hours < 6 THEN TRUE
            ELSE FALSE
        END AS is_sleep_deprived,

        -- 生産性フラグ
        CASE
            WHEN work_hours >= work_7d_avg * 1.2 THEN TRUE
            ELSE FALSE
        END AS is_high_productivity_day,

        CASE
            WHEN work_hours <= work_7d_avg * 0.8 THEN TRUE
            ELSE FALSE
        END AS is_low_productivity_day,

        -- メタデータ
        CURRENT_TIMESTAMP AS calculated_at

    FROM with_moving_averages
    -- 前日の睡眠データが存在する行のみ（最初の日は除外）
    WHERE prev_sleep_hours IS NOT NULL
)

SELECT * FROM final
