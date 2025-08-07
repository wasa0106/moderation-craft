#!/bin/bash

# DuckDB WASMファイルをpublicディレクトリにコピーするスクリプト

set -e

# 色定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "Copying DuckDB WASM files to public directory..."

# プロジェクトルート
PROJECT_ROOT=$(cd "$(dirname "$0")/.." && pwd)
SOURCE_DIR="$PROJECT_ROOT/node_modules/@duckdb/duckdb-wasm/dist"
TARGET_DIR="$PROJECT_ROOT/public/duckdb-wasm"

# ターゲットディレクトリ作成
mkdir -p "$TARGET_DIR"

# 必要なファイルをコピー
FILES=(
  "duckdb-mvp.wasm"
  "duckdb-eh.wasm"
  "duckdb-browser-mvp.worker.js"
  "duckdb-browser-eh.worker.js"
  "duckdb-browser-eh.worker.js.map"
  "duckdb-browser-mvp.worker.js.map"
)

for file in "${FILES[@]}"; do
  if [ -f "$SOURCE_DIR/$file" ]; then
    cp "$SOURCE_DIR/$file" "$TARGET_DIR/"
    echo -e "${GREEN}✓${NC} Copied $file"
  else
    echo -e "${YELLOW}⚠${NC} File not found: $file"
  fi
done

echo -e "${GREEN}Done! DuckDB WASM files copied to public/duckdb-wasm/${NC}"