/**
 * AWS Pipeline Types
 */

export interface ExportResult {
  statusCode: number;
  body: {
    message: string;
    tableName?: string;
    itemCount?: number;
    s3Location?: string;
    exportDate?: string;
    error?: string;
  };
}

export interface ExportHistoryItem {
  key: string;
  size: number;
  lastModified: Date;
  date: string;
  tableName: string;
}

export interface ExportStatus {
  exports: ExportHistoryItem[];
  totalCount: number;
  latestExport: ExportHistoryItem | null;
}

export interface PipelineConfig {
  bucketName: string;
  lambdaFunctionName: string;
  dynamodbTableName: string;
  scheduleExpression: string;
}