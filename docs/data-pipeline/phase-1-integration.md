# Phase 1: コードベース統合ドキュメント

## 概要

ModerationCraftアプリケーションとAWSデータパイプラインの統合実装について記載します。

## 実装内容

### 1. AWS SDK統合レイヤー

#### ディレクトリ構造
```
/src/lib/aws/
├── config.ts          # AWS設定管理
├── types.ts           # 型定義
├── clients/           # AWSクライアント
│   ├── dynamodb.ts
│   ├── lambda.ts
│   └── s3.ts
└── services/          # サービスレイヤー
    └── export.ts
```

#### 主要機能
- Lambda関数の手動実行
- S3からのエクスポート履歴取得
- 最新データのダウンロード

### 2. API Routes

| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/api/pipeline/export` | POST | エクスポート実行 |
| `/api/pipeline/status` | GET | ステータス確認 |
| `/api/pipeline/latest` | GET | 最新データ取得 |

### 3. デバッグUI

**アクセス方法**: `/debug/pipeline`

#### 機能
- **ステータスタブ**
  - エクスポート統計の表示
  - 最新実行結果の確認
  - 手動エクスポート実行

- **履歴タブ**
  - 過去7日間のエクスポート履歴
  - ファイルサイズと日時の表示
  - 最新データのダウンロード

- **設定タブ**
  - AWSリソース情報の表示
  - スケジュール設定の確認

## セットアップ手順

### 1. 環境変数設定

`.env.local`に以下を追加：

```env
# AWS設定
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key

# Data Pipeline設定
S3_BUCKET_NAME=moderation-craft-data-800860245583
LAMBDA_EXPORT_FUNCTION=moderation-craft-export-dynamodb
DYNAMODB_TABLE_NAME=moderation-craft-data
```

### 2. 依存パッケージ

```bash
npm install @aws-sdk/client-dynamodb @aws-sdk/client-s3 @aws-sdk/client-lambda @aws-sdk/lib-dynamodb
```

## API仕様

### POST /api/pipeline/export

**リクエスト**:
```json
{
  "tableName": "moderation-craft-data"  // オプション
}
```

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "statusCode": 200,
    "body": {
      "message": "Export completed successfully",
      "itemCount": 100,
      "s3Location": "s3://bucket/key"
    }
  },
  "timestamp": "2024-02-01T12:00:00Z"
}
```

### GET /api/pipeline/status

**パラメータ**:
- `days`: 取得する日数（デフォルト: 7）

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "exports": [...],
    "totalCount": 5,
    "latestExport": {...}
  }
}
```

## トラブルシューティング

### よくある問題

| 問題 | 原因 | 解決方法 |
|------|------|---------|
| 認証エラー | AWS認証情報が未設定 | .env.localを確認 |
| タイムアウト | Lambda実行時間超過 | Lambda設定でタイムアウトを延長 |
| 404エラー | リソースが見つからない | AWS設定を確認 |
| CORS エラー | クロスオリジン制限 | API Routesを使用 |

### デバッグ方法

1. **CloudWatchログ確認**
   ```bash
   aws logs tail /aws/lambda/moderation-craft-export-dynamodb --follow
   ```

2. **S3バケット確認**
   ```bash
   aws s3 ls s3://moderation-craft-data-800860245583/raw/internal/dynamodb-exports/ --recursive
   ```

3. **Lambda関数テスト**
   ```bash
   aws lambda invoke --function-name moderation-craft-export-dynamodb response.json
   ```

## セキュリティ考慮事項

1. **本番環境**
   - IAMロールを使用（環境変数のAWS認証情報は不要）
   - API Routesに認証を追加

2. **開発環境**
   - .env.localをgitignoreに追加
   - AWS認証情報を安全に管理

3. **アクセス制御**
   - 必要最小限のIAM権限
   - S3バケットポリシーの適切な設定

## 今後の拡張

- [ ] リアルタイムステータス更新（WebSocket）
- [ ] 複数テーブル対応
- [ ] エクスポート形式選択（JSON/Parquet）
- [ ] 自動リトライ機能
- [ ] エクスポート通知機能

---

*最終更新: 2024年2月*
*作成者: ModerationCraft開発チーム*