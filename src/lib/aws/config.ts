/**
 * AWS SDK Configuration
 */

export const awsConfig = {
  region: process.env.AWS_REGION || 'ap-northeast-1',
  credentials: process.env.NODE_ENV === 'production' 
    ? undefined // Use IAM role in production
    : process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
} as const;

export const awsResources = {
  s3: {
    bucketName: process.env.S3_BUCKET_NAME || 'moderation-craft-data-800860245583',
    exportPrefix: 'raw/internal/dynamodb-exports',
  },
  lambda: {
    exportFunctionName: process.env.LAMBDA_EXPORT_FUNCTION || 'moderation-craft-export-dynamodb',
  },
  dynamodb: {
    tableName: process.env.DYNAMODB_TABLE_NAME || 'moderation-craft-data',
  },
} as const;