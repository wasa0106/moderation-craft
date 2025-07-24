#!/bin/bash

# 本番環境のDynamoDBテーブルにuser-time-indexを追加

echo "本番環境にuser-time-index（ユーザー時系列検索用GSI）を追加します..."

TABLE_NAME="moderation-craft-data"
REGION="ap-northeast-1"

# 現在のGSI状態を確認
echo "現在のGSI一覧:"
aws dynamodb describe-table \
  --table-name $TABLE_NAME \
  --region $REGION \
  --query 'Table.GlobalSecondaryIndexes[].{IndexName:IndexName,Keys:KeySchema}' \
  --output table

# user-time-indexを追加（user_time_pk + user_time_sk）
echo ""
echo "user-time-indexを追加中..."
aws dynamodb update-table \
  --table-name $TABLE_NAME \
  --region $REGION \
  --attribute-definitions \
    AttributeName=user_time_pk,AttributeType=S \
    AttributeName=user_time_sk,AttributeType=S \
  --global-secondary-index-updates \
    '[{
      "Create": {
        "IndexName": "user-time-index",
        "Keys": [
          {"AttributeName": "user_time_pk", "KeyType": "HASH"},
          {"AttributeName": "user_time_sk", "KeyType": "RANGE"}
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
echo "aws dynamodb describe-table --table-name $TABLE_NAME --region $REGION --query 'Table.GlobalSecondaryIndexes[?IndexName==\`user-time-index\`].IndexStatus' --output text"