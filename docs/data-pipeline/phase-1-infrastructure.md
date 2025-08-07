# Phase 1: 基盤構築 - 詳細実装計画

## 概要
Phase 1では、データパイプラインの基盤となるAWSインフラストラクチャを構築し、DynamoDBからS3へのデータエクスポート機能を実装します。

## Week 1: AWS環境セットアップ

### Day 1-2: S3バケット作成とIAMロール設定

#### タスクリスト
- [ ] S3バケットの作成
- [ ] バケットポリシーの設定
- [ ] IAMロールの作成
- [ ] Lambda実行ロールの設定
- [ ] DynamoDB読み取り権限の付与

#### S3バケット構成

```bash
# S3バケット作成スクリプト
aws s3api create-bucket \
  --bucket moderation-craft-data \
  --region ap-northeast-1 \
  --create-bucket-configuration LocationConstraint=ap-northeast-1

# バージョニング有効化
aws s3api put-bucket-versioning \
  --bucket moderation-craft-data \
  --versioning-configuration Status=Enabled

# ライフサイクルポリシー設定
aws s3api put-bucket-lifecycle-configuration \
  --bucket moderation-craft-data \
  --lifecycle-configuration file://s3-lifecycle.json
```

**s3-lifecycle.json**:
```json
{
  "Rules": [
    {
      "Id": "ArchiveOldData",
      "Status": "Enabled",
      "Transitions": [
        {
          "Days": 30,
          "StorageClass": "STANDARD_IA"
        },
        {
          "Days": 90,
          "StorageClass": "GLACIER"
        }
      ]
    },
    {
      "Id": "DeleteOldVersions",
      "Status": "Enabled",
      "NoncurrentVersionExpiration": {
        "NoncurrentDays": 7
      }
    }
  ]
}
```

#### IAMロール設定

**lambda-execution-role.json**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

**lambda-policy.json**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:Scan",
        "dynamodb:Query",
        "dynamodb:GetItem",
        "dynamodb:BatchGetItem",
        "dynamodb:DescribeTable",
        "dynamodb:DescribeStream",
        "dynamodb:GetRecords",
        "dynamodb:GetShardIterator",
        "dynamodb:ListStreams"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/moderation-craft-*",
        "arn:aws:dynamodb:*:*:table/moderation-craft-*/stream/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket",
        "s3:GetBucketLocation"
      ],
      "Resource": [
        "arn:aws:s3:::moderation-craft-data",
        "arn:aws:s3:::moderation-craft-data/*"
      ]
    }
  ]
}
```

### Day 3-4: Lambda関数の基本構造作成

#### ディレクトリ構造
```
lambda-functions/
├── export-dynamodb/
│   ├── index.js
│   ├── package.json
│   └── lib/
│       ├── dynamodb-client.js
│       ├── s3-client.js
│       └── data-transformer.js
├── shared/
│   ├── utils.js
│   └── error-handler.js
└── layers/
    └── aws-sdk-layer/
        └── nodejs/
            └── package.json
```

#### 基本Lambda関数実装

**export-dynamodb/index.js**:
```javascript
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
  const tableName = event.tableName || process.env.TABLE_NAME;
  const bucketName = process.env.BUCKET_NAME;
  const today = new Date().toISOString().split('T')[0];
  
  try {
    console.log(`Starting export for table: ${tableName}`);
    
    // DynamoDBからデータ取得
    const items = await scanTable(tableName);
    
    // データ変換
    const transformed = transformData(items);
    
    // S3に保存
    const key = `raw/internal/dynamodb-exports/dt=${today}/${tableName}.json`;
    await saveToS3(bucketName, key, transformed);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Export completed successfully',
        itemCount: items.length,
        s3Location: `s3://${bucketName}/${key}`
      })
    };
  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  }
};

async function scanTable(tableName) {
  const items = [];
  let lastEvaluatedKey = undefined;
  
  do {
    const params = {
      TableName: tableName,
      Limit: 1000,
      ExclusiveStartKey: lastEvaluatedKey
    };
    
    const response = await docClient.send(new ScanCommand(params));
    items.push(...response.Items);
    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  
  return items;
}

function transformData(items) {
  return items.map(item => ({
    ...item,
    exported_at: new Date().toISOString(),
    export_version: '1.0'
  }));
}

async function saveToS3(bucket, key, data) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json',
    ServerSideEncryption: 'AES256'
  });
  
  return s3Client.send(command);
}
```

**package.json**:
```json
{
  "name": "export-dynamodb",
  "version": "1.0.0",
  "description": "Export DynamoDB data to S3",
  "main": "index.js",
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.478.0",
    "@aws-sdk/client-s3": "^3.478.0",
    "@aws-sdk/lib-dynamodb": "^3.478.0"
  },
  "scripts": {
    "build": "zip -r function.zip .",
    "deploy": "aws lambda update-function-code --function-name export-dynamodb --zip-file fileb://function.zip"
  }
}
```

### Day 5: CI/CDパイプライン構築

#### GitHub Actions ワークフロー

**.github/workflows/deploy-lambda.yml**:
```yaml
name: Deploy Lambda Functions

on:
  push:
    branches: [main]
    paths:
      - 'lambda-functions/**'
  pull_request:
    branches: [main]
    paths:
      - 'lambda-functions/**'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd lambda-functions/export-dynamodb
          npm ci
      
      - name: Run tests
        run: |
          cd lambda-functions/export-dynamodb
          npm test
      
      - name: Lint
        run: |
          cd lambda-functions/export-dynamodb
          npm run lint

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-northeast-1
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Build and Deploy Lambda
        run: |
          cd lambda-functions/export-dynamodb
          npm ci --production
          zip -r function.zip .
          
          aws lambda update-function-code \
            --function-name export-dynamodb \
            --zip-file fileb://function.zip \
            --publish
          
          aws lambda update-function-configuration \
            --function-name export-dynamodb \
            --environment Variables="{
              TABLE_NAME='moderation-craft-prod',
              BUCKET_NAME='moderation-craft-data'
            }"
```

## Week 2: データエクスポート基盤

### Day 1-2: DynamoDB → S3エクスポート実装

#### バッチエクスポート用Lambda関数

**batch-export/index.js**:
```javascript
const { DynamoDBClient, ExportTableToPointInTimeCommand } = require('@aws-sdk/client-dynamodb');
const { EventBridgeClient, PutEventsCommand } = require('@aws-sdk/client-eventbridge');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const eventClient = new EventBridgeClient({ region: process.env.AWS_REGION });

const TABLES = [
  'moderation-craft-projects',
  'moderation-craft-tasks',
  'moderation-craft-sessions',
  'moderation-craft-users'
];

exports.handler = async (event) => {
  const exportResults = [];
  
  for (const tableName of TABLES) {
    try {
      const exportArn = await exportTable(tableName);
      exportResults.push({
        tableName,
        exportArn,
        status: 'INITIATED'
      });
      
      // エクスポート開始イベントを発行
      await publishEvent('TableExportStarted', {
        tableName,
        exportArn,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Failed to export ${tableName}:`, error);
      exportResults.push({
        tableName,
        error: error.message,
        status: 'FAILED'
      });
    }
  }
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Batch export initiated',
      results: exportResults
    })
  };
};

async function exportTable(tableName) {
  const today = new Date().toISOString().split('T')[0];
  
  const params = {
    TableArn: `arn:aws:dynamodb:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:table/${tableName}`,
    S3Bucket: process.env.BUCKET_NAME,
    S3Prefix: `raw/internal/dynamodb-exports/dt=${today}/${tableName}/`,
    ExportFormat: 'DYNAMODB_JSON',
    ExportType: 'FULL_EXPORT'
  };
  
  const response = await dynamoClient.send(new ExportTableToPointInTimeCommand(params));
  return response.ExportDescription.ExportArn;
}

async function publishEvent(detailType, detail) {
  const params = {
    Entries: [
      {
        Source: 'moderation-craft.data-pipeline',
        DetailType: detailType,
        Detail: JSON.stringify(detail),
        EventBusName: 'default'
      }
    ]
  };
  
  return eventClient.send(new PutEventsCommand(params));
}
```

### Day 3-4: データパーティショニング設定

#### パーティション戦略実装

**partition-manager/index.js**:
```javascript
const { S3Client, ListObjectsV2Command, CopyObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
  const bucket = process.env.BUCKET_NAME;
  const prefix = 'raw/internal/dynamodb-exports/';
  
  try {
    // 未パーティション化データを検索
    const unpartitionedData = await findUnpartitionedData(bucket, prefix);
    
    // パーティションごとに再編成
    for (const object of unpartitionedData) {
      await partitionObject(bucket, object);
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Partitioning completed',
        processedCount: unpartitionedData.length
      })
    };
  } catch (error) {
    console.error('Partitioning failed:', error);
    throw error;
  }
};

async function findUnpartitionedData(bucket, prefix) {
  const params = {
    Bucket: bucket,
    Prefix: prefix,
    MaxKeys: 1000
  };
  
  const response = await s3Client.send(new ListObjectsV2Command(params));
  return response.Contents || [];
}

async function partitionObject(bucket, object) {
  const key = object.Key;
  
  // パーティションキーを抽出
  const metadata = extractMetadata(key);
  const partitionKey = generatePartitionKey(metadata);
  
  // 新しいキーで複製
  const newKey = `${partitionKey}/${key.split('/').pop()}`;
  
  await s3Client.send(new CopyObjectCommand({
    Bucket: bucket,
    CopySource: `${bucket}/${key}`,
    Key: newKey,
    MetadataDirective: 'COPY'
  }));
  
  // 元のオブジェクトを削除
  await s3Client.send(new DeleteObjectCommand({
    Bucket: bucket,
    Key: key
  }));
}

function extractMetadata(key) {
  const parts = key.split('/');
  const dateMatch = key.match(/dt=(\d{4}-\d{2}-\d{2})/);
  
  return {
    date: dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0],
    tableName: parts[parts.length - 2] || 'unknown'
  };
}

function generatePartitionKey(metadata) {
  const date = new Date(metadata.date);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `raw/internal/dynamodb-exports/year=${year}/month=${month}/day=${day}/${metadata.tableName}`;
}
```

### Day 5: ログ設定とエラーハンドリング

#### シンプルなログ実装

**logger.js**:
```javascript
class SimpleLogger {
  constructor(serviceName = 'DataPipeline') {
    this.serviceName = serviceName;
  }
  
  log(level, message, metadata = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      message,
      ...metadata
    };
    
    console.log(JSON.stringify(logEntry));
  }
  
  info(message, metadata) {
    this.log('INFO', message, metadata);
  }
  
  error(message, error, metadata) {
    this.log('ERROR', message, {
      ...metadata,
      error: error.message,
      stack: error.stack
    });
  }
  
  debug(message, metadata) {
    if (process.env.DEBUG) {
      this.log('DEBUG', message, metadata);
    }
  }
}

module.exports = SimpleLogger;
```

#### エラーハンドリング改善

**error-handler.js**:
```javascript
class ErrorHandler {
  static handleLambdaError(error, context) {
    console.error('Lambda execution failed:', {
      error: error.message,
      stack: error.stack,
      requestId: context.awsRequestId,
      functionName: context.functionName
    });
    
    // エラーの種類に応じた処理
    if (error.name === 'ThrottlingException') {
      return {
        statusCode: 429,
        body: JSON.stringify({
          error: 'Rate limit exceeded. Please retry later.'
        })
      };
    }
    
    if (error.name === 'ResourceNotFoundException') {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: 'Resource not found.'
        })
      };
    }
    
    // デフォルトエラーレスポンス
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        requestId: context.awsRequestId
      })
    };
  }
}

module.exports = ErrorHandler;
```

## テスト計画

### 単体テスト

**export-dynamodb.test.js**:
```javascript
const { handler } = require('../index');
const { mockClient } = require('aws-sdk-client-mock');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const ddbMock = mockClient(DynamoDBDocumentClient);
const s3Mock = mockClient(S3Client);

describe('Export DynamoDB Handler', () => {
  beforeEach(() => {
    ddbMock.reset();
    s3Mock.reset();
    process.env.TABLE_NAME = 'test-table';
    process.env.BUCKET_NAME = 'test-bucket';
  });
  
  test('should export data successfully', async () => {
    const mockData = [
      { id: '1', name: 'Test 1' },
      { id: '2', name: 'Test 2' }
    ];
    
    ddbMock.on(ScanCommand).resolves({
      Items: mockData,
      LastEvaluatedKey: undefined
    });
    
    s3Mock.on(PutObjectCommand).resolves({});
    
    const result = await handler({});
    
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.itemCount).toBe(2);
    expect(body.message).toBe('Export completed successfully');
  });
  
  test('should handle pagination', async () => {
    ddbMock
      .on(ScanCommand)
      .resolvesOnce({
        Items: [{ id: '1' }],
        LastEvaluatedKey: { id: '1' }
      })
      .resolvesOnce({
        Items: [{ id: '2' }],
        LastEvaluatedKey: undefined
      });
    
    s3Mock.on(PutObjectCommand).resolves({});
    
    const result = await handler({});
    
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.itemCount).toBe(2);
  });
});
```

### 統合テスト

**integration-test.sh**:
```bash
#!/bin/bash

echo "Running integration tests for Phase 1..."

# テスト用のDynamoDBテーブル作成
aws dynamodb create-table \
  --table-name test-moderation-craft \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
  --key-schema \
    AttributeName=id,KeyType=HASH \
  --provisioned-throughput \
    ReadCapacityUnits=5,WriteCapacityUnits=5

# テストデータ投入
aws dynamodb put-item \
  --table-name test-moderation-craft \
  --item '{"id": {"S": "test-1"}, "data": {"S": "test data"}}'

# Lambda関数実行
aws lambda invoke \
  --function-name export-dynamodb \
  --payload '{"tableName": "test-moderation-craft"}' \
  response.json

# 結果確認
if grep -q "Export completed successfully" response.json; then
  echo "✅ Export test passed"
else
  echo "❌ Export test failed"
  exit 1
fi

# S3確認
aws s3 ls s3://moderation-craft-data/raw/internal/dynamodb-exports/

# クリーンアップ
aws dynamodb delete-table --table-name test-moderation-craft
```

## 成果物チェックリスト

### Week 1 完了基準
- [ ] S3バケット作成完了
- [ ] IAMロール設定完了
- [ ] Lambda関数デプロイ完了
- [ ] CI/CDパイプライン稼働
- [ ] 基本的なエラーハンドリング実装

### Week 2 完了基準
- [ ] DynamoDB全テーブルのエクスポート成功
- [ ] データパーティショニング実装
- [ ] エラーハンドリング実装
- [ ] ドキュメント作成完了

## トラブルシューティング

### よくある問題と解決策

| 問題 | 原因 | 解決策 |
|------|------|--------|
| Lambda タイムアウト | データ量が多い | タイムアウト値を15分に延長、バッチサイズ調整 |
| S3 アクセス拒否 | IAMロール権限不足 | バケットポリシーとIAMロールを確認 |
| DynamoDB スロットリング | 読み取り容量不足 | オンデマンドモードに変更、またはRCU増加 |
| メモリ不足エラー | Lambda メモリ不足 | メモリを3008MBまで増加 |

## 次のフェーズへの準備

### Phase 2に必要な事前準備
1. Fitbit開発者アカウント作成
2. OpenWeatherMap APIキー取得
3. OAuth2.0実装の学習
4. API レート制限の確認

### 引き継ぎ事項
- S3バケット名: `moderation-craft-data`
- Lambda関数名: `export-dynamodb`, `batch-export`, `partition-manager`

---

*最終更新: 2024年2月*
*Phase 1 リード: データエンジニアリングチーム*