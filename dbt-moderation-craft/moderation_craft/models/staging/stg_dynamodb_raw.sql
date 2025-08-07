{{ config(
    materialized='view'
) }}

-- DynamoDBエクスポートデータの読み込みテスト
-- Parquetファイルから最新のデータを読み込む
SELECT
    *
FROM read_parquet('s3://moderation-craft-data-800860245583/raw/internal/dynamodb-exports/year=2025/month=1/day=*/*.parquet')
LIMIT 10
