INSTALL httpfs;
LOAD httpfs;
SET s3_region='ap-northeast-1';
SET s3_access_key_id='${AWS_ACCESS_KEY_ID}';
SET s3_secret_access_key='${AWS_SECRET_ACCESS_KEY}';
SELECT COUNT(*) as count FROM read_parquet('s3://moderation-craft-data-800860245583/raw/internal/dynamodb-exports/year=2025/month=1/day=*/*.parquet') LIMIT 1;
