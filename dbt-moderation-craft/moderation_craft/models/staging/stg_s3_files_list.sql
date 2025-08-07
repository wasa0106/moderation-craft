{{ config(
    materialized='view'
) }}

-- S3バケット内のファイル一覧を確認
-- 実際のパスを確認するため
SELECT
    filename,
    size,
    last_modified
FROM read_parquet('s3://moderation-craft-data-800860245583/**/*.parquet',
                   filename=true,
                   hive_partitioning=true)
LIMIT 20
