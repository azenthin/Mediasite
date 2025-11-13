import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const media = await prisma.media.findUnique({
      where: { id: params.id },
      include: {
        uploader: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        _count: { select: { likeRecords: true, comments: true } }
      }
    });
    if (!media) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(media);
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}


