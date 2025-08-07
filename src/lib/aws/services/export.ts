/**
 * Export Service for Data Pipeline
 */

import { InvokeCommand } from '@aws-sdk/client-lambda';
import { ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { getLambdaClient } from '../clients/lambda';
import { getS3Client } from '../clients/s3';
import { awsResources } from '../config';
import type { ExportResult, ExportHistoryItem } from '../types';

export class ExportService {
  /**
   * Trigger Lambda export function
   */
  async triggerExport(tableName?: string): Promise<ExportResult> {
    const lambdaClient = getLambdaClient();
    
    const command = new InvokeCommand({
      FunctionName: awsResources.lambda.exportFunctionName,
      Payload: JSON.stringify({ 
        tableName: tableName || awsResources.dynamodb.tableName 
      }),
    });
    
    const response = await lambdaClient.send(command);
    
    if (!response.Payload) {
      throw new Error('No response from Lambda function');
    }
    
    const payload = JSON.parse(new TextDecoder().decode(response.Payload));
    
    // Parse the Lambda response body if it's a string
    if (typeof payload.body === 'string') {
      payload.body = JSON.parse(payload.body);
    }
    
    return payload as ExportResult;
  }

  /**
   * Get export history from S3
   */
  async getExportHistory(days = 7): Promise<ExportHistoryItem[]> {
    const s3Client = getS3Client();
    const prefix = `${awsResources.s3.exportPrefix}/`;
    
    const command = new ListObjectsV2Command({
      Bucket: awsResources.s3.bucketName,
      Prefix: prefix,
      MaxKeys: 100,
    });
    
    const response = await s3Client.send(command);
    
    if (!response.Contents) {
      return [];
    }
    
    // Filter and parse S3 contents
    const items = response.Contents
      .filter(item => item.Key && item.Key.endsWith('.json'))
      .map(item => ({
        key: item.Key!,
        size: item.Size || 0,
        lastModified: item.LastModified || new Date(),
        date: this.extractDateFromKey(item.Key!),
        tableName: this.extractTableNameFromKey(item.Key!),
      }))
      .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
    
    // Filter by days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return items.filter(item => item.lastModified >= cutoffDate);
  }

  /**
   * Get latest export data
   */
  async getLatestExport(): Promise<any | null> {
    const history = await this.getExportHistory(1);
    
    if (history.length === 0) {
      return null;
    }
    
    const latest = history[0];
    const s3Client = getS3Client();
    
    const command = new GetObjectCommand({
      Bucket: awsResources.s3.bucketName,
      Key: latest.key,
    });
    
    const response = await s3Client.send(command);
    
    if (!response.Body) {
      return null;
    }
    
    const body = await response.Body.transformToString();
    return JSON.parse(body);
  }

  /**
   * Extract date from S3 key
   */
  private extractDateFromKey(key: string): string {
    const match = key.match(/dt=(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : '';
  }

  /**
   * Extract table name from S3 key
   */
  private extractTableNameFromKey(key: string): string {
    const parts = key.split('/');
    const filename = parts[parts.length - 1];
    return filename.replace('.json', '');
  }
}