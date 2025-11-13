/*
  GET /api/ingest/queue — List queued and skipped records for manual curation.
  
  Query params:
  - ?type=queued|skipped — filter by type (default: all)
  - ?limit=50 — max records to return
  - ?offset=0 — pagination offset
  
  Response:
  {
    success: true,
    records: [ { id, artist, title, isrc, mbid, canonicalityScore, notes, rawPayload } ],
    total: number,
    limit: number,
    offset: number,
  }
*/

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'all'; // queued, skipped, or all
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Load staging records (queued)
    const stagingFile = path.join(process.cwd(), 'scripts', 'ingest', 'staging-db.json');
    const queuedRecords: any[] = [];
    if (fs.existsSync(stagingFile)) {
      const staging = JSON.parse(fs.readFileSync(stagingFile, 'utf8'));
      const records = staging.records || [];
      queuedRecords.push(
        ...records
          .filter((r: any) => r.queue)
          .map((r: any, idx: number) => ({
            id: `queue-${idx}`,
            type: 'queued',
            artist: r.artist,
            title: r.title,
            isrc: r.isrc,
            mbid: r.mbid,
            canonicalityScore: r.canonicality_score,
            notes: r.notes || [],
            rawPayload: r,
          }))
      );
    }

    // Load skipped records
    const skippedFile = path.join(process.cwd(), 'scripts', 'ingest', 'skipped.json');
    const skippedRecords: any[] = [];
    if (fs.existsSync(skippedFile)) {
      const skipped = JSON.parse(fs.readFileSync(skippedFile, 'utf8'));
      const records = skipped.records || [];
      skippedRecords.push(
        ...records.map((r: any, idx: number) => ({
          id: `skip-${idx}`,
          type: 'skipped',
          artist: r.artist,
          title: r.title,
          isrc: r.isrc,
          mbid: r.mbid,
          canonicalityScore: r.canonicality_score,
          reason: r.skip_reason,
          notes: r.notes || [],
          rawPayload: r,
        }))
      );
    }

    // Combine and filter by type
    let allRecords = [...queuedRecords, ...skippedRecords];
    if (type === 'queued') {
      allRecords = queuedRecords;
    } else if (type === 'skipped') {
      allRecords = skippedRecords;
    }

    // Paginate
    const total = allRecords.length;
    const paginatedRecords = allRecords.slice(offset, offset + limit);

    return NextResponse.json(
      {
        success: true,
        records: paginatedRecords,
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching queue:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch queue',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
