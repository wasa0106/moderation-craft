/**
 * Lambda Client
 */

import { LambdaClient } from '@aws-sdk/client-lambda';
import { awsConfig } from '../config';

let lambdaClient: LambdaClient | null = null;

export function getLambdaClient(): LambdaClient {
  if (!lambdaClient) {
    lambdaClient = new LambdaClient(awsConfig);
  }
  return lambdaClient;
}