/**
 * DynamoDB Table Initialization Script
 * Run this to create the table in local DynamoDB
 */

import { createTableIfNotExists } from '../src/lib/aws/dynamodb-schema'

async function main() {
  console.log('Initializing DynamoDB table...')
  
  try {
    await createTableIfNotExists()
    console.log('DynamoDB initialization complete!')
  } catch (error) {
    console.error('Failed to initialize DynamoDB:', error)
    process.exit(1)
  }
}

main()