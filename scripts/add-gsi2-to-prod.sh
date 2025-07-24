#!/bin/bash

# 本番環境のDynamoDBテーブルにユーザーデータ検索用GSI2を追加

echo "本番環境にGSI2（ユーザーデータ検索用）を追加します..."

TABLE_NAME="moderation-craft-data"
REGION="ap-northeast-1"

# 現在のGSI状態を確認
echo "現在のGSI一覧:"
aws dynamodb describe-table \
  --table-name $TABLE_NAME \
  --region $REGION \
  --query 'Table.GlobalSecondaryIndexes[].{IndexName:IndexName,Keys:KeySchema}' \
  --output table

# GSI2を追加（GSI1PK + GSI1SK）
# 注: 属性名はGSI2PKとGSI2SKにする（混乱を避けるため）
echo ""
echo "GSI2を追加中..."
aws dynamodb update-table \
  --table-name $TABLE_NAME \
  --region $REGION \
  --attribute-definitions \
    AttributeName=GSI2PK,AttributeType=S \
    AttributeName=GSI2SK,AttributeType=S \
  --global-secondary-index-updates \
    '[{
      "Create": {
        "IndexName": "GSI2",
        "Keys": [
          {"AttributeName": "GSI2PK", "KeyType": "HASH"},
          {"AttributeName": "GSI2SK", "KeyType": "RANGE"}
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
echo "aws dynamodb describe-table --table-name $TABLE_NAME --region $REGION --query 'Table.GlobalSecondaryIndexes[?IndexName==\`GSI2\`].IndexStatus' --output text"