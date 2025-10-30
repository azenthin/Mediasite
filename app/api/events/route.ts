import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

// Simple event ingestion endpoint
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const events = Array.isArray(body) ? body : [body];

    // Validate and only include events with valid foreign keys
    const validEvents = [];
    
    for (const e of events) {
      // Basic validation
      if (!e.sessionId || typeof e.sessionId !== 'string') continue;
      
      const event: any = {
        sessionId: e.sessionId,
        eventType: typeof e.eventType === 'string' ? e.eventType : 'UNKNOWN',
        position: typeof e.position === 'number' ? e.position : null,
        algorithmVersion: typeof e.algorithmVersion === 'string' ? e.algorithmVersion : null,
        score: typeof e.score === 'number' ? e.score : null,
        seed: typeof e.seed === 'string' ? e.seed : null,
        meta: e.meta && typeof e.meta === 'object' ? JSON.stringify(e.meta) : null,
      };

      // Only add foreign keys if they exist in database (prevent constraint violations)
      if (e.userId && typeof e.userId === 'string') {
        try {
          const userExists = await prisma.user.findUnique({ where: { id: e.userId } });
          if (userExists) event.userId = e.userId;
        } catch (err) {
          // Skip user relation if check fails
        }
      }

      if (e.mediaId && typeof e.mediaId === 'string') {
        try {
          const mediaExists = await prisma.media.findUnique({ where: { id: e.mediaId } });
          if (mediaExists) event.mediaId = e.mediaId;
        } catch (err) {
          // Skip media relation if check fails
        }
      }

      validEvents.push(event);
    }

    if (validEvents.length === 0) {
      return NextResponse.json({ ok: true, ingested: 0 });
    }

    await prisma.analyticsEvent.createMany({ data: validEvents });
    return NextResponse.json({ ok: true, ingested: validEvents.length });
  } catch (error) {
    console.error('Event ingest error', error);
    // Return success to prevent client retries that could cause loops
    return NextResponse.json({ ok: true, ingested: 0 });
  }
}


