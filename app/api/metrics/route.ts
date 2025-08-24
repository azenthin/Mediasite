import { NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

export async function GET() {
  try {
    const rows = await prisma.analyticsEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, createdAt: true, eventType: true, sessionId: true, userId: true, mediaId: true },
    });
    return NextResponse.json({ rows });
  } catch (e) {
    return NextResponse.json({ rows: [] });
  }
}


