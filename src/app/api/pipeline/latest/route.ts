/**
 * API Route: Get Latest Export
 * GET /api/pipeline/latest
 */

import { NextResponse } from 'next/server';
import { ExportService } from '@/lib/aws/services/export';

export async function GET() {
  try {
    const exportService = new ExportService();
    const latestData = await exportService.getLatestExport();
    
    if (!latestData) {
      return NextResponse.json({
        success: false,
        error: 'No export data found',
        timestamp: new Date().toISOString(),
      }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      data: latestData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to get latest export:', error);
    
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