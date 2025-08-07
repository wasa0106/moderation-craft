/**
 * S3 Client
 */

import { S3Client } from '@aws-sdk/client-s3';
import { awsConfig } from '../config';

let s3Client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client(awsConfig);
  }
  return s3Client;
}