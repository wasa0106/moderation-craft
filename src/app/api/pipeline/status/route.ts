/**
 * API Route: Pipeline Status
 * GET /api/pipeline/status
 */

import { NextResponse } from 'next/server';
import { ExportService } from '@/lib/aws/services/export';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');
    
    const exportService = new ExportService();
    const history = await exportService.getExportHistory(days);
    
    return NextResponse.json({
      success: true,
      data: {
        exports: history,
        totalCount: history.length,
        latestExport: history[0] || null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to get export status:', error);
    
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