/**
 * DynamoDB Client
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { awsConfig } from '../config';

let dynamoClient: DynamoDBClient | null = null;
let docClient: DynamoDBDocumentClient | null = null;

export function getDynamoDBClient(): DynamoDBClient {
  if (!dynamoClient) {
    dynamoClient = new DynamoDBClient(awsConfig);
  }
  return dynamoClient;
}

export function getDynamoDBDocumentClient(): DynamoDBDocumentClient {
  if (!docClient) {
    const client = getDynamoDBClient();
    docClient = DynamoDBDocumentClient.from(client);
  }
  return docClient;
}