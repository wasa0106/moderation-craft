#!/bin/bash

# 開発環境のDynamoDBテーブルにentity-type-indexを追加

echo "開発環境にentity-type-index（本番環境と同じGSI）を追加します..."

TABLE_NAME="moderation-craft-data-dev"
REGION="ap-northeast-1"

# 現在のGSI状態を確認
echo "現在のGSI一覧:"
aws dynamodb describe-table \
  --table-name $TABLE_NAME \
  --region $REGION \
  --query 'Table.GlobalSecondaryIndexes[].{IndexName:IndexName,Keys:KeySchema}' \
  --output table

# entity-type-indexを追加（entity_type + updated_at）
echo ""
echo "entity-type-indexを追加中..."
aws dynamodb update-table \
  --table-name $TABLE_NAME \
  --region $REGION \
  --attribute-definitions \
    AttributeName=entity_type,AttributeType=S \
    AttributeName=updated_at,AttributeType=S \
  --global-secondary-index-updates \
    '[{
      "Create": {
        "IndexName": "entity-type-index",
        "Keys": [
          {"AttributeName": "entity_type", "KeyType": "HASH"},
          {"AttributeName": "updated_at", "KeyType": "RANGE"}
        ],
        "Projection": {
          "ProjectionType": "ALL"
        }
      }
    }]'

echo ""
echo "GSI追加リクエストを送信しました。"
echo "作成完了まで数分かかります。"
echo ""
echo "ステータス確認コマンド:"
echo "aws dynamodb describe-table --table-name $TABLE_NAME --region $REGION --query 'Table.GlobalSecondaryIndexes[?IndexName==\`entity-type-index\`].IndexStatus' --output text"