#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo_success() { echo -e "${GREEN}✅ $1${NC}"; }
echo_error() { echo -e "${RED}❌ $1${NC}"; }
echo_info() { echo -e "${YELLOW}📋 $1${NC}"; }

ENV_FILE="../.env.local"
if [ -f "$ENV_FILE" ]; then
  echo_info ".env.local から環境変数を読み込み中..."
  set -a
  source <(grep -v '^#' "$ENV_FILE" | grep -v '^$')
  set +a
  echo_success "環境変数を読み込みました"
else
  echo_error ".env.local が見つかりません: $ENV_FILE"
  exit 1
fi

echo_info "必須環境変数をチェック中..."
missing=()
[ -z "$FITBIT_CLIENT_ID" ] && missing+=("FITBIT_CLIENT_ID")
[ -z "$FITBIT_CLIENT_SECRET" ] && missing+=("FITBIT_CLIENT_SECRET")
[ -z "$S3_BUCKET_NAME" ] && missing+=("S3_BUCKET_NAME")

if [ ${#missing[@]} -gt 0 ]; then
  echo_error "以下を .env.local に設定してください:"
  for var in "${missing[@]}"; do
    echo "  - $var"
  done
  exit 1
fi

echo_success "必須変数チェック完了"

FUNCTION_NAME="moderation-craft-fitbit-backfill"
ROLE_NAME="fitbit-lambda-role"
REGION="${AWS_REGION:-ap-northeast-1}"
ACCOUNT_ID="800860245583"
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

echo "============================================"
echo "🚀 FitbitバックフィルLambda デプロイ"
echo "============================================"

aws iam get-role --role-name "$ROLE_NAME" --region "$REGION" >/dev/null 2>&1
if [ $? -ne 0 ]; then
  echo_error "IAM Role ${ROLE_NAME} が存在しません。既存の日次Lambda用のロールを共有する想定です。必要なら先に作成してください。"
  exit 1
fi

echo_info "パッケージを作成中..."
rm -rf package function.zip
mkdir package
if [ -s requirements.txt ]; then
  pip install -r requirements.txt -t package/ --quiet
fi
cp lambda_function.py package/
(
  cd package || exit 1
  zip -r ../function.zip . -q
)
rm -rf package

echo_success "function.zip を作成しました"

echo_info "Lambda関数を作成または更新します"
aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" >/dev/null 2>&1
if [ $? -ne 0 ]; then
  echo_info "新規作成します..."
  aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --runtime python3.11 \
    --role "$ROLE_ARN" \
    --handler lambda_function.lambda_handler \
    --zip-file fileb://function.zip \
    --timeout 900 \
    --memory-size 512 \
    --region "$REGION" \
    --environment "Variables={FITBIT_CLIENT_ID=${FITBIT_CLIENT_ID},FITBIT_CLIENT_SECRET=${FITBIT_CLIENT_SECRET},S3_BUCKET=${S3_BUCKET_NAME},DYNAMODB_TABLE=fitbit_tokens,FITBIT_USER_ID=BGPGCR}" >/dev/null
  if [ $? -ne 0 ]; then
    echo_error "Lambda関数の作成に失敗しました"
    rm -f function.zip
    exit 1
  fi
  echo_success "Lambda関数を作成しました"
else
  echo_info "既存関数を更新します..."
  aws lambda update-function-code --function-name "$FUNCTION_NAME" --zip-file fileb://function.zip --region "$REGION" >/dev/null
  if [ $? -ne 0 ]; then
    echo_error "コード更新に失敗しました"
    rm -f function.zip
    exit 1
  fi
  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --timeout 900 \
    --memory-size 512 \
    --region "$REGION" \
    --environment "Variables={FITBIT_CLIENT_ID=${FITBIT_CLIENT_ID},FITBIT_CLIENT_SECRET=${FITBIT_CLIENT_SECRET},S3_BUCKET=${S3_BUCKET_NAME},DYNAMODB_TABLE=fitbit_tokens,FITBIT_USER_ID=BGPGCR}" >/dev/null
  if [ $? -ne 0 ]; then
    echo_error "設定更新に失敗しました"
    rm -f function.zip
    exit 1
  fi
  echo_success "Lambda関数を更新しました"
fi

rm -f function.zip

echo ""
echo "============================================"
echo_success "デプロイ完了"
echo "============================================"
echo "1. CloudWatch Logs 監視: aws logs tail /aws/lambda/$FUNCTION_NAME --follow"
echo "2. 手動テスト   : aws lambda invoke --function-name $FUNCTION_NAME --payload '{\"force\":false}' response.json"
echo "3. 終了後 cleanup: rm -f response.json"
echo ""
