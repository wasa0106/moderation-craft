# Lambda Export DynamoDB

DynamoDBのデータをS3にエクスポートするLambda関数

## 機能

- **フルエクスポート**: テーブル全体をエクスポート
- **増分エクスポート**: 指定日数以内に更新されたデータのみエクスポート
- **日付パーティション**: `dt=YYYY-MM-DD` 形式でS3に保存

## デプロイ

```bash
cd lambda-export-dynamodb
./deploy.sh
```

## 使い方

### フルエクスポート（手動実行）

```bash
aws lambda invoke \
  --function-name moderation-craft-export-dynamodb \
  --payload '{"mode": "full"}' \
  response.json
```

### 増分エクスポート（過去1日分）

```bash
aws lambda invoke \
  --function-name moderation-craft-export-dynamodb \
  --payload '{"mode": "incremental"}' \
  response.json
```

### 増分エクスポート（過去3日分）

```bash
aws lambda invoke \
  --function-name moderation-craft-export-dynamodb \
  --payload '{"mode": "incremental", "incrementalDays": 3}' \
  response.json
```

## 環境変数

- `TABLE_NAME`: DynamoDBテーブル名（デフォルト: `moderation-craft-data`）
- `BUCKET_NAME`: S3バケット名（デフォルト: `moderation-craft-data-800860245583`）
- `AWS_REGION`: AWSリージョン

## 出力形式

```json
{
  "export_metadata": {
    "table_name": "moderation-craft-data",
    "exported_at": "2025-11-03T06:30:00.000Z",
    "export_version": "1.0",
    "export_mode": "incremental",
    "record_count": 150
  },
  "data": [...]
}
```

## スケジュール実行

### デイリー増分エクスポート（毎日午前2時JST）

EventBridge Schedulerで自動実行

### ウィークリーフルエクスポート（毎週日曜午前1時JST）

EventBridge Schedulerで自動実行
