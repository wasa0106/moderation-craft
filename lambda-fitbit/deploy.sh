#!/bin/bash

# 色付き出力用の関数
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_success() { echo -e "${GREEN}✅ $1${NC}"; }
echo_error() { echo -e "${RED}❌ $1${NC}"; }
echo_info() { echo -e "${YELLOW}📋 $1${NC}"; }

# .env.localファイルの読み込み
ENV_FILE="../.env.local"
if [ -f "$ENV_FILE" ]; then
    echo_info ".env.localから環境変数を読み込み中..."
    # コメント行と空行を除外して環境変数を読み込む
    set -a
    source <(grep -v '^#' "$ENV_FILE" | grep -v '^$')
    set +a
    echo_success "環境変数を読み込みました"
else
    echo_error ".env.localファイルが見つかりません: $ENV_FILE"
    echo_info "プロジェクトルートに.env.localファイルを作成してください"
    exit 1
fi

# 必須環境変数の検証
echo_info "必須環境変数を検証中..."
MISSING_VARS=()

if [ -z "$FITBIT_CLIENT_ID" ]; then
    MISSING_VARS+=("FITBIT_CLIENT_ID")
fi

if [ -z "$FITBIT_CLIENT_SECRET" ]; then
    MISSING_VARS+=("FITBIT_CLIENT_SECRET")
fi

if [ -z "$S3_BUCKET_NAME" ]; then
    MISSING_VARS+=("S3_BUCKET_NAME")
fi

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo_error "以下の環境変数が.env.localに設定されていません:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    exit 1
fi

echo_success "環境変数の検証完了"

# 設定
FUNCTION_NAME="moderation-craft-fitbit-daily-export"
ROLE_NAME="fitbit-lambda-role"
REGION="${AWS_REGION:-ap-northeast-1}"
ACCOUNT_ID="800860245583"

echo "============================================"
echo "🚀 Fitbit Lambda関数デプロイスクリプト"
echo "============================================"

# Step 1: IAMロールの作成または確認
echo_info "Step 1: IAMロールを確認中..."

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

# ロールが存在するか確認
aws iam get-role --role-name $ROLE_NAME --region $REGION 2>/dev/null

if [ $? -ne 0 ]; then
    echo_info "ロールが存在しません。作成します..."
    
    # ロールを作成
    aws iam create-role \
        --role-name $ROLE_NAME \
        --assume-role-policy-document file://trust-policy.json \
        --region $REGION
    
    if [ $? -eq 0 ]; then
        echo_success "ロールを作成しました"
    else
        echo_error "ロールの作成に失敗しました"
        exit 1
    fi
    
    # ポリシーをアタッチ
    echo_info "基本実行ポリシーをアタッチ中..."
    aws iam attach-role-policy \
        --role-name $ROLE_NAME \
        --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole \
        --region $REGION
    
    # カスタムポリシーを作成してアタッチ
    echo_info "カスタムポリシーを作成中..."
    aws iam put-role-policy \
        --role-name $ROLE_NAME \
        --policy-name FitbitLambdaPolicy \
        --policy-document file://execution-policy.json \
        --region $REGION
    
    echo_success "ポリシーをアタッチしました"
    
    # ロールの作成を待つ
    echo_info "ロールの反映を待っています（10秒）..."
    sleep 10
else
    echo_success "ロールは既に存在します"
fi

# Step 2: ZIPファイルを作成
echo_info "Step 2: デプロイパッケージを作成中..."

# クリーンアップ
rm -rf package
rm -f function.zip

# パッケージディレクトリを作成
mkdir package

# 依存関係をインストール（必要な場合）
if [ -s requirements.txt ]; then
    echo_info "依存関係をインストール中..."
    pip install -r requirements.txt -t package/ --quiet
fi

# Lambda関数のコードをコピー
cp lambda_function.py package/

# ZIPファイルを作成
cd package
zip -r ../function.zip . -q
cd ..

echo_success "デプロイパッケージを作成しました (function.zip)"

# Step 3: Lambda関数の作成または更新
echo_info "Step 3: Lambda関数をデプロイ中..."

# 関数が存在するか確認
aws lambda get-function --function-name $FUNCTION_NAME --region $REGION 2>/dev/null

if [ $? -ne 0 ]; then
    echo_info "新規作成します..."
    
    # Lambda関数を作成
    aws lambda create-function \
        --function-name $FUNCTION_NAME \
        --runtime python3.11 \
        --role $ROLE_ARN \
        --handler lambda_function.lambda_handler \
        --zip-file fileb://function.zip \
        --timeout 60 \
        --memory-size 256 \
        --region $REGION \
        --environment Variables="{
            FITBIT_CLIENT_ID=${FITBIT_CLIENT_ID},
            FITBIT_CLIENT_SECRET=${FITBIT_CLIENT_SECRET},
            S3_BUCKET=${S3_BUCKET_NAME},
            DYNAMODB_TABLE=fitbit_tokens,
            FITBIT_USER_ID=BGPGCR
        }"
    
    if [ $? -eq 0 ]; then
        echo_success "Lambda関数を作成しました"
    else
        echo_error "Lambda関数の作成に失敗しました"
        exit 1
    fi
else
    echo_info "既存の関数を更新します..."
    
    # 関数コードを更新
    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --zip-file fileb://function.zip \
        --region $REGION
    
    # 環境変数を更新
    aws lambda update-function-configuration \
        --function-name $FUNCTION_NAME \
        --environment Variables="{
            FITBIT_CLIENT_ID=${FITBIT_CLIENT_ID},
            FITBIT_CLIENT_SECRET=${FITBIT_CLIENT_SECRET},
            S3_BUCKET=${S3_BUCKET_NAME},
            DYNAMODB_TABLE=fitbit_tokens,
            FITBIT_USER_ID=BGPGCR
        }" \
        --region $REGION
    
    echo_success "Lambda関数を更新しました"
fi

# Step 4: テスト実行
echo_info "Step 4: テスト実行しますか？"
read -p "今すぐテストを実行しますか？ (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo_info "Lambda関数をテスト実行中..."
    
    aws lambda invoke \
        --function-name $FUNCTION_NAME \
        --payload '{}' \
        --region $REGION \
        response.json
    
    if [ $? -eq 0 ]; then
        echo_success "テスト実行完了"
        echo_info "レスポンス:"
        cat response.json | python -m json.tool
    else
        echo_error "テスト実行に失敗しました"
    fi
fi

# クリーンアップ
echo_info "一時ファイルをクリーンアップ中..."
rm -rf package
rm -f function.zip
rm -f response.json

echo ""
echo "============================================"
echo_success "デプロイ完了！"
echo "============================================"
echo ""
echo "📌 次のステップ:"
echo "1. CloudWatchログを確認:"
echo "   aws logs tail /aws/lambda/$FUNCTION_NAME --follow"
echo ""
echo "2. 手動実行:"
echo "   aws lambda invoke --function-name $FUNCTION_NAME --payload '{}' response.json"
echo ""
echo "3. EventBridge（定期実行）を設定:"
echo "   毎日AM3:00に実行するルールを作成します"
echo ""