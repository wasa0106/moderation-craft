import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: process.env.AWS_REGION });

export const handler = async (event) => {
  const tableName = event.tableName || process.env.TABLE_NAME || 'moderation-craft-data';
  const bucketName = process.env.BUCKET_NAME;
  const exportMode = event.mode || 'full'; // 'full' or 'incremental'
  const today = new Date().toISOString().split('T')[0];

  try {
    console.log(`Starting ${exportMode} export for table: ${tableName}`);

    // DynamoDBからデータ取得
    let items;
    if (exportMode === 'incremental') {
      const days = event.incrementalDays || 1;
      items = await scanTableIncremental(tableName, days);
      console.log(`Scanned ${items.length} items (incremental, last ${days} days) from ${tableName}`);
    } else {
      items = await scanTable(tableName);
      console.log(`Scanned ${items.length} items (full) from ${tableName}`);
    }

    // データが空の場合の処理
    if (items.length === 0) {
      console.log(`No data found in ${tableName}`);
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'No data to export',
          tableName,
          exportMode,
          itemCount: 0
        })
      };
    }

    // データ変換
    const transformed = transformData(items, tableName, exportMode);

    // S3に保存
    const key = `raw/internal/dynamodb-exports/dt=${today}/${tableName}.json`;
    await saveToS3(bucketName, key, transformed);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Export completed successfully',
        tableName,
        exportMode,
        itemCount: items.length,
        s3Location: `s3://${bucketName}/${key}`,
        exportDate: today
      })
    };
  } catch (error) {
    console.error('Export failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Export failed',
        message: error.message,
        tableName,
        exportMode: event.mode || 'full'
      })
    };
  }
};

/**
 * フルスキャン: テーブル全体をスキャン
 */
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
    items.push(...(response.Items || []));
    lastEvaluatedKey = response.LastEvaluatedKey;

    // プログレス表示
    console.log(`Scanned ${items.length} items so far...`);
  } while (lastEvaluatedKey);

  return items;
}

/**
 * 増分スキャン: 指定日数以内に更新されたデータのみスキャン
 */
async function scanTableIncremental(tableName, days = 1) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffTimestamp = cutoffDate.toISOString();

  console.log(`Incremental scan: items updated after ${cutoffTimestamp}`);

  const items = [];
  let lastEvaluatedKey = undefined;

  do {
    const params = {
      TableName: tableName,
      FilterExpression: 'updated_at > :cutoff OR created_at > :cutoff',
      ExpressionAttributeValues: {
        ':cutoff': cutoffTimestamp
      },
      Limit: 1000,
      ExclusiveStartKey: lastEvaluatedKey
    };

    const response = await docClient.send(new ScanCommand(params));
    items.push(...(response.Items || []));
    lastEvaluatedKey = response.LastEvaluatedKey;

    console.log(`Scanned ${items.length} items (incremental)...`);
  } while (lastEvaluatedKey);

  return items;
}

function transformData(items, tableName, exportMode) {
  const timestamp = new Date().toISOString();
  return {
    export_metadata: {
      table_name: tableName,
      exported_at: timestamp,
      export_version: '1.0',
      export_mode: exportMode,
      record_count: items.length
    },
    data: items
  };
}

async function saveToS3(bucket, key, data) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json',
    ServerSideEncryption: 'AES256',
    Metadata: {
      'export-timestamp': new Date().toISOString(),
      'export-mode': data.export_metadata.export_mode,
      'record-count': String(data.export_metadata.record_count)
    }
  });

  const response = await s3Client.send(command);
  console.log(`Data saved to S3: ${bucket}/${key}`);
  return response;
}
