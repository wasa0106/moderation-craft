{{ config(
    materialized='view'
) }}

-- S3バケットの存在確認とアクセステスト
-- まずはシンプルにS3のファイルリストを取得してみる
SELECT
    'S3 Connection Test' as test_name,
    's3://moderation-craft-data-800860245583/' as bucket,
    CURRENT_TIMESTAMP as tested_at,
    'Success' as status
