#!/bin/bash

# dbtテスト実行スクリプト
# Phase 3分析基盤のdbtモデルをテストします

set -e

echo "========================================="
echo "dbt分析基盤テストスクリプト"
echo "========================================="
echo ""

# 色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# プロジェクトルートディレクトリ
PROJECT_ROOT=$(cd "$(dirname "$0")/.." && pwd)
DBT_PROJECT_DIR="$PROJECT_ROOT/dbt-moderation-craft/moderation_craft"

# 環境変数チェック
check_env_vars() {
    echo "1. 環境変数チェック..."
    
    if [ -z "$AWS_ACCESS_KEY_ID" ]; then
        echo -e "${YELLOW}警告: AWS_ACCESS_KEY_ID が設定されていません${NC}"
        echo "S3アクセスが必要な場合は設定してください:"
        echo "  export AWS_ACCESS_KEY_ID=your_access_key"
    fi
    
    if [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
        echo -e "${YELLOW}警告: AWS_SECRET_ACCESS_KEY が設定されていません${NC}"
        echo "S3アクセスが必要な場合は設定してください:"
        echo "  export AWS_SECRET_ACCESS_KEY=your_secret_key"
    fi
    
    echo -e "${GREEN}✓ 環境変数チェック完了${NC}"
    echo ""
}

# Python環境チェック
check_python() {
    echo "2. Python環境チェック..."
    
    if ! command -v python3 &> /dev/null; then
        echo -e "${RED}エラー: Python3が見つかりません${NC}"
        exit 1
    fi
    
    python_version=$(python3 --version)
    echo "  Python: $python_version"
    echo -e "${GREEN}✓ Python環境チェック完了${NC}"
    echo ""
}

# dbt-duckdbインストール
install_dbt() {
    echo "3. dbt-duckdbインストール..."
    
    if ! pip show dbt-duckdb &> /dev/null; then
        echo "  dbt-duckdbをインストールしています..."
        pip install dbt-duckdb==1.7.0
    else
        version=$(pip show dbt-duckdb | grep Version | cut -d' ' -f2)
        echo "  dbt-duckdb $version がインストール済み"
    fi
    
    echo -e "${GREEN}✓ dbt-duckdbインストール完了${NC}"
    echo ""
}

# dbtプロジェクトディレクトリへ移動
cd_to_dbt_project() {
    echo "4. dbtプロジェクトディレクトリへ移動..."
    
    if [ ! -d "$DBT_PROJECT_DIR" ]; then
        echo -e "${RED}エラー: dbtプロジェクトディレクトリが見つかりません: $DBT_PROJECT_DIR${NC}"
        exit 1
    fi
    
    cd "$DBT_PROJECT_DIR"
    echo "  作業ディレクトリ: $(pwd)"
    echo -e "${GREEN}✓ ディレクトリ移動完了${NC}"
    echo ""
}

# dbt接続テスト
test_connection() {
    echo "5. dbt接続テスト..."
    echo "----------------------------------------"
    
    if dbt debug --profiles-dir="../"; then
        echo -e "${GREEN}✓ 接続テスト成功${NC}"
    else
        echo -e "${RED}✗ 接続テスト失敗${NC}"
        echo "profiles.ymlの設定を確認してください"
        exit 1
    fi
    echo ""
}

# dbtモデル実行
run_models() {
    echo "6. dbtモデル実行..."
    echo "----------------------------------------"
    
    # ステージング層のみ実行（S3アクセスが必要）
    echo "ステージング層モデルを実行中..."
    if dbt run --models staging --profiles-dir="../"; then
        echo -e "${GREEN}✓ ステージング層実行成功${NC}"
    else
        echo -e "${YELLOW}△ ステージング層実行失敗（S3アクセスが必要かもしれません）${NC}"
    fi
    
    echo ""
    
    # 中間層とマート層（ステージング層に依存）
    echo "中間層とマート層モデルを実行中..."
    if dbt run --models intermediate marts --profiles-dir="../"; then
        echo -e "${GREEN}✓ 中間層・マート層実行成功${NC}"
    else
        echo -e "${YELLOW}△ 中間層・マート層実行失敗${NC}"
    fi
    
    echo ""
}

# dbtテスト実行
run_tests() {
    echo "7. dbtテスト実行..."
    echo "----------------------------------------"
    
    if dbt test --profiles-dir="../"; then
        echo -e "${GREEN}✓ データ品質テスト成功${NC}"
    else
        echo -e "${YELLOW}△ 一部のテストが失敗しました${NC}"
    fi
    
    echo ""
}

# ドキュメント生成
generate_docs() {
    echo "8. ドキュメント生成..."
    echo "----------------------------------------"
    
    if dbt docs generate --profiles-dir="../"; then
        echo -e "${GREEN}✓ ドキュメント生成成功${NC}"
        echo "  ドキュメントを見るには: dbt docs serve --profiles-dir='../'"
    else
        echo -e "${YELLOW}△ ドキュメント生成失敗${NC}"
    fi
    
    echo ""
}

# メイン処理
main() {
    echo "開始時刻: $(date)"
    echo ""
    
    check_env_vars
    check_python
    install_dbt
    cd_to_dbt_project
    test_connection
    
    # オプション引数に応じて処理を分岐
    case "${1:-all}" in
        "debug")
            echo "接続テストのみ実行しました"
            ;;
        "run")
            run_models
            ;;
        "test")
            run_tests
            ;;
        "docs")
            generate_docs
            ;;
        "all")
            run_models
            run_tests
            generate_docs
            ;;
        *)
            echo "使用方法: $0 [debug|run|test|docs|all]"
            echo "  debug - 接続テストのみ"
            echo "  run   - モデル実行"
            echo "  test  - テスト実行"
            echo "  docs  - ドキュメント生成"
            echo "  all   - すべて実行（デフォルト）"
            exit 1
            ;;
    esac
    
    echo "========================================="
    echo -e "${GREEN}完了！${NC}"
    echo "終了時刻: $(date)"
    echo "========================================="
}

# スクリプト実行
main "$@"