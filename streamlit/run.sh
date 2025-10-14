#!/bin/bash

# Streamlitダッシュボード起動スクリプト

echo "📊 ModerationCraft Analytics Dashboard を起動します..."
echo ""

# Pythonバージョンチェック
python_version=$(python3 --version 2>&1 | grep -oE '[0-9]+\.[0-9]+')
echo "Python version: $python_version"

# 依存パッケージのインストール
echo "📦 依存パッケージをインストール中..."
pip install -r requirements.txt --quiet

echo ""
echo "🚀 Streamlitを起動中..."
echo "ブラウザで http://localhost:8501 にアクセスしてください"
echo ""
echo "終了するには Ctrl+C を押してください"
echo "----------------------------------------"

# Streamlit起動
streamlit run app.py