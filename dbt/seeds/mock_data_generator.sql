-- モックデータ生成スクリプト
-- 90日分の睡眠データとwork_sessionデータを生成

-- 1. モック睡眠データ（Fitbit形式のJSON）
CREATE OR REPLACE TABLE mock_fitbit_sleep_raw AS
WITH date_series AS (
    SELECT
        CURRENT_DATE - INTERVAL (i || ' days')::INTERVAL AS date
    FROM generate_series(0, 89) AS t(i)
),
sleep_data AS (
    SELECT
        'default_user' AS user_id,
        date,
        CAST(date AS VARCHAR) AS data_date,
        CURRENT_TIMESTAMP AS extraction_timestamp,
        -- 睡眠時間: 5-9時間（ランダム）
        CAST((300 + (random() * 240)) AS INTEGER) AS minutes_asleep,
        -- 覚醒時間: 10-60分
        CAST((10 + (random() * 50)) AS INTEGER) AS minutes_awake,
        -- 睡眠効率: 75-95%
        CAST((75 + (random() * 20)) AS INTEGER) AS efficiency,
        -- 深い睡眠: 60-120分
        CAST((60 + (random() * 60)) AS INTEGER) AS deep_sleep_minutes,
        -- 浅い睡眠: 120-240分
        CAST((120 + (random() * 120)) AS INTEGER) AS light_sleep_minutes,
        -- REM睡眠: 60-120分
        CAST((60 + (random() * 60)) AS INTEGER) AS rem_sleep_minutes,
        -- 覚醒: 10-30分
        CAST((10 + (random() * 20)) AS INTEGER) AS wake_minutes,
        -- 就寝時刻: 22:00-01:00
        (date + INTERVAL '22 hours') + INTERVAL (CAST((random() * 180) AS INTEGER) || ' minutes')::INTERVAL AS sleep_start_time,
        TRUE AS is_main_sleep,
        -- 入眠潜時: 5-30分（秒）
        CAST((300 + (random() * 1500)) AS INTEGER) AS sleep_latency_seconds,
        CURRENT_TIMESTAMP AS fetched_at
    FROM date_series
)
SELECT
    user_id,
    date AS sleep_date,
    data_date,
    extraction_timestamp,
    -- duration_ms = (minutes_asleep + minutes_awake) * 60 * 1000
    (minutes_asleep + minutes_awake) * 60 * 1000 AS duration_ms,
    efficiency AS sleep_efficiency,
    minutes_asleep,
    minutes_awake,
    minutes_asleep + minutes_awake AS time_in_bed,
    deep_sleep_minutes,
    light_sleep_minutes,
    rem_sleep_minutes,
    wake_minutes,
    sleep_start_time,
    sleep_start_time + INTERVAL (CAST((minutes_asleep + minutes_awake) AS VARCHAR) || ' minutes')::INTERVAL AS sleep_end_time,
    is_main_sleep,
    sleep_latency_seconds,
    fetched_at,
    date AS source_date,
    CURRENT_TIMESTAMP AS extracted_at,
    CURRENT_TIMESTAMP AS processed_at,
    MD5(CONCAT(user_id, '::', CAST(date AS VARCHAR))) AS id
FROM sleep_data;

-- 2. モック活動データ（Fitbit形式）
CREATE OR REPLACE TABLE mock_fitbit_activity_raw AS
WITH date_series AS (
    SELECT
        CURRENT_DATE - INTERVAL (i || ' days')::INTERVAL AS date
    FROM generate_series(0, 89) AS t(i)
)
SELECT
    'default_user' AS user_id,
    date AS activity_date,
    CAST(date AS VARCHAR) AS data_date,
    CURRENT_TIMESTAMP AS extraction_timestamp,
    -- 歩数: 3000-12000
    CAST((3000 + (random() * 9000)) AS INTEGER) AS steps,
    -- 距離: steps * 0.0008 km
    CAST(((3000 + (random() * 9000)) * 0.0008) AS DOUBLE) AS distance_km,
    -- 消費カロリー: 1800-2800
    CAST((1800 + (random() * 1000)) AS INTEGER) AS calories_burned,
    -- 基礎代謝: 1400-1600
    CAST((1400 + (random() * 200)) AS INTEGER) AS calories_bmr,
    -- 活動カロリー: 400-1200
    CAST((400 + (random() * 800)) AS INTEGER) AS activity_calories,
    -- 階数: 0-15
    CAST((random() * 15) AS INTEGER) AS floors_climbed,
    -- 標高: floors * 3
    CAST((random() * 45) AS DOUBLE) AS elevation_meters,
    -- 座りっぱなし時間: 600-900分
    CAST((600 + (random() * 300)) AS INTEGER) AS sedentary_minutes,
    -- 軽い活動: 60-180分
    CAST((60 + (random() * 120)) AS INTEGER) AS lightly_active_minutes,
    -- 適度な活動: 20-60分
    CAST((20 + (random() * 40)) AS INTEGER) AS fairly_active_minutes,
    -- 激しい活動: 0-30分
    CAST((random() * 30) AS INTEGER) AS very_active_minutes,
    CURRENT_TIMESTAMP AS fetched_at,
    date AS source_date,
    CURRENT_TIMESTAMP AS extracted_at,
    CURRENT_TIMESTAMP AS processed_at,
    MD5(CONCAT('default_user', '::', CAST(date AS VARCHAR))) AS id
FROM date_series;

-- 3. モックプロジェクトデータ
CREATE OR REPLACE TABLE mock_projects_raw AS
SELECT
    MD5('project-' || CAST(i AS VARCHAR)) AS id,
    'project-' || CAST(i AS VARCHAR) AS project_id,
    'default_user' AS user_id,
    CASE
        WHEN i = 1 THEN 'ModerationCraft開発'
        WHEN i = 2 THEN 'データ分析基盤構築'
        WHEN i = 3 THEN 'UI/UX改善'
        ELSE 'その他プロジェクト' || CAST(i AS VARCHAR)
    END AS project_name,
    'プロジェクト' || CAST(i AS VARCHAR) || 'の説明' AS description,
    CASE
        WHEN i % 3 = 0 THEN '#3b82f6'
        WHEN i % 3 = 1 THEN '#22c55e'
        ELSE '#f59e0b'
    END AS color,
    'active' AS status,
    CURRENT_DATE + INTERVAL (CAST((30 + i * 10) AS VARCHAR) || ' days')::INTERVAL AS deadline,
    CAST((50 + i * 20) AS DOUBLE) AS estimated_total_hours,
    1 AS version,
    CURRENT_TIMESTAMP - INTERVAL (CAST((90 - i) AS VARCHAR) || ' days')::INTERVAL AS created_at,
    CURRENT_TIMESTAMP AS updated_at,
    'Project' AS entity_type
FROM generate_series(1, 3) AS t(i);

-- 4. モックBigTaskデータ
CREATE OR REPLACE TABLE mock_big_tasks_raw AS
SELECT
    MD5('big-task-' || CAST(i AS VARCHAR)) AS id,
    'big-task-' || CAST(i AS VARCHAR) AS big_task_id,
    'default_user' AS user_id,
    'project-' || CAST(((i - 1) % 3 + 1) AS VARCHAR) AS project_id,
    CASE
        WHEN i % 4 = 0 THEN 'フロントエンド実装'
        WHEN i % 4 = 1 THEN 'バックエンド開発'
        WHEN i % 4 = 2 THEN 'テスト作成'
        ELSE 'ドキュメント作成'
    END AS big_task_name,
    CASE
        WHEN i % 4 = 0 THEN 'development'
        WHEN i % 4 = 1 THEN 'development'
        WHEN i % 4 = 2 THEN 'testing'
        ELSE 'documentation'
    END AS category,
    CASE
        WHEN i % 3 = 0 THEN 'completed'
        WHEN i % 3 = 1 THEN 'in_progress'
        ELSE 'not_started'
    END AS status,
    'feature' AS task_type,
    CAST((5 + random() * 15) AS DOUBLE) AS estimated_hours,
    CAST((CASE WHEN i % 3 = 0 THEN 3 + random() * 10 ELSE 0 END) AS DOUBLE) AS actual_hours,
    CURRENT_DATE - INTERVAL (CAST((90 - i * 3) AS VARCHAR) || ' days')::INTERVAL AS start_date,
    CASE
        WHEN i % 3 = 0 THEN CURRENT_DATE - INTERVAL (CAST((90 - i * 3 - 7) AS VARCHAR) || ' days')::INTERVAL
        ELSE NULL
    END AS end_date,
    1 AS version,
    CURRENT_TIMESTAMP - INTERVAL (CAST((90 - i * 3) AS VARCHAR) || ' days')::INTERVAL AS created_at,
    CURRENT_TIMESTAMP AS updated_at,
    'BigTask' AS entity_type
FROM generate_series(1, 12) AS t(i);

-- 5. モックSmallTaskデータ
CREATE OR REPLACE TABLE mock_small_tasks_raw AS
SELECT
    MD5('small-task-' || CAST(i AS VARCHAR)) AS id,
    'small-task-' || CAST(i AS VARCHAR) AS small_task_id,
    'default_user' AS user_id,
    'project-' || CAST(((i - 1) % 3 + 1) AS VARCHAR) AS project_id,
    'big-task-' || CAST(((i - 1) % 12 + 1) AS VARCHAR) AS big_task_id,
    'タスク' || CAST(i AS VARCHAR) AS task_name,
    CASE
        WHEN i % 3 = 0 THEN 'completed'
        WHEN i % 3 = 1 THEN 'in_progress'
        ELSE 'pending'
    END AS status,
    CASE
        WHEN i % 4 = 0 THEN 'high'
        WHEN i % 4 = 1 THEN 'medium'
        WHEN i % 4 = 2 THEN 'medium'
        ELSE 'low'
    END AS priority,
    CAST((0.5 + random() * 3.5) AS DOUBLE) AS estimated_time_minutes,
    CASE
        WHEN i % 3 = 0 THEN CAST((0.3 + random() * 3) AS DOUBLE)
        ELSE NULL
    END AS actual_time_minutes,
    CASE
        WHEN i % 3 = 0 THEN CURRENT_TIMESTAMP - INTERVAL (CAST((random() * 60) AS VARCHAR) || ' days')::INTERVAL
        ELSE NULL
    END AS completed_at,
    1 AS version,
    CURRENT_TIMESTAMP - INTERVAL (CAST((90 - i) AS VARCHAR) || ' days')::INTERVAL AS created_at,
    CURRENT_TIMESTAMP AS updated_at,
    'SmallTask' AS entity_type
FROM generate_series(1, 100) AS t(i);

-- 6. モックwork_sessionデータ（過去90日分、1日1-5セッション）
CREATE OR REPLACE TABLE mock_work_sessions_raw AS
WITH date_series AS (
    SELECT
        CURRENT_DATE - INTERVAL (i || ' days')::INTERVAL AS date
    FROM generate_series(0, 89) AS t(i)
),
sessions_per_day AS (
    SELECT
        date,
        -- 1日のセッション数: 0-5回（ランダム）
        CAST((random() * 5) AS INTEGER) + 1 AS session_count
    FROM date_series
),
session_generator AS (
    SELECT
        date,
        session_idx,
        -- セッション開始時刻: 9:00-20:00の間
        (date + INTERVAL '9 hours') + INTERVAL (CAST((session_idx * 180 + random() * 120) AS VARCHAR) || ' minutes')::INTERVAL AS start_time
    FROM sessions_per_day
    CROSS JOIN generate_series(0, 4) AS t(session_idx)
    WHERE session_idx < session_count
),
work_sessions AS (
    SELECT
        MD5(CONCAT('session-', CAST(date AS VARCHAR), '-', CAST(session_idx AS VARCHAR))) AS id,
        MD5(CONCAT('session-', CAST(date AS VARCHAR), '-', CAST(session_idx AS VARCHAR))) AS session_id,
        'default_user' AS user_id,
        'project-' || CAST((CAST(random() * 3 AS INTEGER) + 1) AS VARCHAR) AS project_id,
        'small-task-' || CAST((CAST(random() * 100 AS INTEGER) + 1) AS VARCHAR) AS small_task_id,
        start_time,
        -- セッション時間: 15-90分
        start_time + INTERVAL (CAST((15 + random() * 75) AS VARCHAR) || ' minutes')::INTERVAL AS end_time,
        CAST((15 + random() * 75) * 60 AS INTEGER) AS duration_seconds,
        -- 集中度: 1-10
        CAST((5 + random() * 5) AS INTEGER) AS focus_level,
        -- 気分: 1-10
        CAST((4 + random() * 6) AS INTEGER) AS mood_rating,
        -- ドーパミンレベル: 1-10
        CAST((4 + random() * 6) AS INTEGER) AS dopamine_level,
        CASE
            WHEN random() > 0.7 THEN '作業メモ' || CAST(session_idx AS VARCHAR)
            ELSE NULL
        END AS notes,
        start_time AS created_at,
        CURRENT_TIMESTAMP AS updated_at,
        'WorkSession' AS entity_type
    FROM session_generator
)
SELECT * FROM work_sessions;

-- 確認用クエリ
SELECT
    'mock_fitbit_sleep_raw' AS table_name, COUNT(*) AS row_count FROM mock_fitbit_sleep_raw
UNION ALL
SELECT 'mock_fitbit_activity_raw', COUNT(*) FROM mock_fitbit_activity_raw
UNION ALL
SELECT 'mock_projects_raw', COUNT(*) FROM mock_projects_raw
UNION ALL
SELECT 'mock_big_tasks_raw', COUNT(*) FROM mock_big_tasks_raw
UNION ALL
SELECT 'mock_small_tasks_raw', COUNT(*) FROM mock_small_tasks_raw
UNION ALL
SELECT 'mock_work_sessions_raw', COUNT(*) FROM mock_work_sessions_raw
ORDER BY table_name;
