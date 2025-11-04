#!/bin/bash

set -e

FUNCTION_NAME="moderation-craft-export-dynamodb"
REGION="ap-northeast-1"
BUCKET_NAME="moderation-craft-data-800860245583"
TABLE_NAME="moderation-craft-data"

echo "🚀 Deploying Lambda function: $FUNCTION_NAME"

# 1. パッケージのビルド
echo "📦 Building deployment package..."
zip -r function.zip index.mjs package.json

# 2. Lambda関数のコード更新
echo "⬆️  Updating function code..."
aws lambda update-function-code \
  --function-name $FUNCTION_NAME \
  --zip-file fileb://function.zip \
  --region $REGION

# 3. 環境変数の設定
echo "⚙️  Updating environment variables..."
aws lambda update-function-configuration \
  --function-name $FUNCTION_NAME \
  --environment "Variables={TABLE_NAME=$TABLE_NAME,BUCKET_NAME=$BUCKET_NAME}" \
  --region $REGION

# 4. クリーンアップ
echo "🧹 Cleaning up..."
rm function.zip

echo "✅ Deployment completed successfully!"
echo ""
echo "Test the function with:"
echo "aws lambda invoke --function-name $FUNCTION_NAME --payload '{\"mode\": \"incremental\"}' response.json"
