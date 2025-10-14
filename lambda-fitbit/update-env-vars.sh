#!/bin/bash

# 色付き出力用の関数
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_success() { echo -e "${GREEN}✅ $1${NC}"; }
echo_error() { echo -e "${RED}❌ $1${NC}"; }
echo_info() { echo -e "${YELLOW}📋 $1${NC}"; }

# 設定
FUNCTION_NAME="moderation-craft-fitbit-daily-export"
REGION="${AWS_REGION:-ap-northeast-1}"

echo "============================================"
echo "🔧 Lambda環境変数更新スクリプト"
echo "============================================"

# .env.localファイルの読み込み
ENV_FILE="../.env.local"
if [ -f "$ENV_FILE" ]; then
    echo_info ".env.localから環境変数を読み込み中..."
    set -a
    source <(grep -v '^#' "$ENV_FILE" | grep -v '^$')
    set +a
    echo_success "環境変数を読み込みました"
else
    echo_error ".env.localファイルが見つかりません: $ENV_FILE"
    exit 1
fi

# 現在の環境変数を表示
echo_info "現在のLambda環境変数:"
aws lambda get-function-configuration \
    --function-name $FUNCTION_NAME \
    --region $REGION \
    --query 'Environment.Variables' \
    --output json | python3 -m json.tool

echo ""
echo_info "新しい環境変数:"
echo "  FITBIT_CLIENT_ID=${FITBIT_CLIENT_ID}"
echo "  FITBIT_CLIENT_SECRET=${FITBIT_CLIENT_SECRET:0:10}..." # 一部のみ表示
echo "  S3_BUCKET=${S3_BUCKET_NAME}"
echo ""

# 確認
read -p "環境変数を更新しますか？ (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo_info "Lambda環境変数を更新中..."

    aws lambda update-function-configuration \
        --function-name $FUNCTION_NAME \
        --environment Variables="{
            FITBIT_CLIENT_ID=${FITBIT_CLIENT_ID},
            FITBIT_CLIENT_SECRET=${FITBIT_CLIENT_SECRET},
            S3_BUCKET=${S3_BUCKET_NAME},
            DYNAMODB_TABLE=fitbit_tokens,
            FITBIT_USER_ID=BGPGCR
        }" \
        --region $REGION \
        --output json > /dev/null

    if [ $? -eq 0 ]; then
        echo_success "環境変数を更新しました"

        # 更新後の確認
        echo ""
        echo_info "更新後の環境変数:"
        aws lambda get-function-configuration \
            --function-name $FUNCTION_NAME \
            --region $REGION \
            --query 'Environment.Variables' \
            --output json | python3 -m json.tool
    else
        echo_error "環境変数の更新に失敗しました"
        exit 1
    fi
else
    echo_info "更新をキャンセルしました"
fi