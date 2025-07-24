# DynamoDB GSI Migration Guide

## 概要

本番環境と開発環境のDynamoDB GSI（Global Secondary Index）を統一するための手順書です。

### 現在の状況

| 環境 | テーブル名 | 既存のGSI |
|-----|-----------|----------|
| 本番環境 | moderation-craft-data | entity-type-index (entity_type, updated_at) |
| 開発環境 | moderation-craft-data-dev | user-time-index (user_time_pk, user_time_sk) |

### 移行後の状況

両環境とも以下の2つのGSIを持つようになります：
- **user-time-index**: user_time_pk (HASH) + user_time_sk (RANGE)
- **entity-type-index**: entity_type (HASH) + updated_at (RANGE)

## GSI追加手順

### 前提条件

- AWS CLIがインストールされていること
- 適切なAWS認証情報が設定されていること
- DynamoDBテーブルへの更新権限があること

### 1. 本番環境にuser-time-indexを追加

```bash
# 実行権限を付与
chmod +x scripts/add-user-time-index-to-prod.sh

# スクリプトを実行
./scripts/add-user-time-index-to-prod.sh
```

### 2. 開発環境にentity-type-indexを追加

```bash
# 実行権限を付与
chmod +x scripts/add-entity-type-index-to-dev.sh

# スクリプトを実行
./scripts/add-entity-type-index-to-dev.sh
```

### 3. GSI作成状況の確認

GSIの作成には数分かかります。以下のコマンドで状況を確認できます：

#### 本番環境のuser-time-index状況確認
```bash
aws dynamodb describe-table \
  --table-name moderation-craft-data \
  --region ap-northeast-1 \
  --query 'Table.GlobalSecondaryIndexes[?IndexName==`user-time-index`].IndexStatus' \
  --output text
```

#### 開発環境のentity-type-index状況確認
```bash
aws dynamodb describe-table \
  --table-name moderation-craft-data-dev \
  --region ap-northeast-1 \
  --query 'Table.GlobalSecondaryIndexes[?IndexName==`entity-type-index`].IndexStatus' \
  --output text
```

ステータスが `ACTIVE` になれば利用可能です。

### 4. 全GSIの確認

#### 本番環境
```bash
aws dynamodb describe-table \
  --table-name moderation-craft-data \
  --region ap-northeast-1 \
  --query 'Table.GlobalSecondaryIndexes[].{IndexName:IndexName,Status:IndexStatus}' \
  --output table
```

#### 開発環境
```bash
aws dynamodb describe-table \
  --table-name moderation-craft-data-dev \
  --region ap-northeast-1 \
  --query 'Table.GlobalSecondaryIndexes[].{IndexName:IndexName,Status:IndexStatus}' \
  --output table
```

## 注意事項

1. **GSI作成中の影響**
   - GSI作成中もテーブルは利用可能です
   - パフォーマンスへの影響は最小限です
   - オンデマンド課金モードなので追加コストは使用量に応じて発生します

2. **アプリケーションへの影響**
   - 現在のコードはGSIを使用していないため、アプリケーションへの影響はありません
   - GSI追加後も既存の動作に変更はありません

3. **既存データの扱い**
   - 既存のアイテムは自動的に新しいGSIにインデックスされます
   - すでに必要な属性（user_time_pk/user_time_sk、entity_type/updated_at）は設定されています

## トラブルシューティング

### GSI作成が失敗する場合

1. **属性が存在しない**
   - エラー: `One or more parameter values were invalid`
   - 対処: テーブルに必要な属性定義があることを確認

2. **GSI名が重複**
   - エラー: `Index already exists`
   - 対処: 既存のGSIを確認し、必要に応じて削除してから再作成

3. **権限不足**
   - エラー: `AccessDeniedException`
   - 対処: IAMロールまたはユーザーに`dynamodb:UpdateTable`権限があることを確認

## 今後の展望

GSI統一後は、以下のような機能実装が可能になります：

1. **user-time-indexの活用**
   - 週次タスクの効率的な検索
   - ユーザー別・期間別のデータ取得

2. **entity-type-indexの活用**
   - エンティティタイプ別の最新データ取得
   - 管理画面での一覧表示
   - 同期処理の最適化