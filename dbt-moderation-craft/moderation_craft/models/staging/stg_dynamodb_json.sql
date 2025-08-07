{{ config(
    materialized='view'
) }}

-- DynamoDBエクスポートのJSONデータを読み込み
SELECT
    *
FROM read_json_auto('s3://moderation-craft-data-800860245583/raw/internal/dynamodb-exports/dt=2025-08-06/moderation-craft-data.json')
LIMIT 100
