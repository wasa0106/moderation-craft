/**
 * API Route: Pipeline Export
 * POST /api/pipeline/export
 */

import { NextResponse } from 'next/server';
import { ExportService } from '@/lib/aws/services/export';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { tableName } = body;
    
    const exportService = new ExportService();
    const result = await exportService.triggerExport(tableName);
    
    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Export trigger failed:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}