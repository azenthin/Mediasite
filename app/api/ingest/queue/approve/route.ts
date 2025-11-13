/*
  POST /api/ingest/queue/{recordId}/approve — Approve a queued record for upsert.
  POST /api/ingest/queue/{recordId}/reject — Reject a queued record.
  
  Request body:
  {
    action: 'approve' | 'reject',
    notes: 'optional manual notes',
    reviewedBy: 'username',
  }
  
  Response:
  {
    success: true,
    recordId: string,
    action: string,
    updatedAt: ISO-string,
  }
*/

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(
  request: NextRequest,
  { params }: { params: { recordId: string } }
) {
  try {
    const { action, notes = '', reviewedBy = 'unknown' } = await request.json();

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Must be approve or reject.' },
        { status: 400 }
      );
    }

    // Load curation log (or create if missing)
    const curationLogFile = path.join(process.cwd(), 'scripts', 'ingest', 'curation-log.json');
    let curationLog: { entries: Array<{ timestamp: string; recordId: string; action: string; notes: string; reviewedBy: string }> } = { entries: [] };
    if (fs.existsSync(curationLogFile)) {
      curationLog = JSON.parse(fs.readFileSync(curationLogFile, 'utf8'));
    }

    // Add entry
    const entry = {
      timestamp: new Date().toISOString(),
      recordId: params.recordId,
      action,
      notes,
      reviewedBy,
    };
    curationLog.entries.push(entry);

    // Save curation log
    fs.writeFileSync(curationLogFile, JSON.stringify(curationLog, null, 2));

    return NextResponse.json(
      {
        success: true,
        recordId: params.recordId,
        action,
        updatedAt: entry.timestamp,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error approving record:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process approval',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
