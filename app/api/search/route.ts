import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    const category = searchParams.get('category');
    const limit = Math.min(parseInt(searchParams.get('limit') || '40', 10), 100);

    if (!q) return NextResponse.json({ media: [] });

    const terms = q.split(/\s+/).filter(Boolean);
    const where = {
      isPublic: true,
      ...(category && category !== 'All' ? { category } : {}),
      OR: [
        { title: { contains: q, mode: 'insensitive' as const } },
        { description: { contains: q, mode: 'insensitive' as const } },
        { tags: { contains: q, mode: 'insensitive' as const } },
        { uploader: { username: { contains: q, mode: 'insensitive' as const } } },
      ],
    } as any;

    const media = await prisma.media.findMany({
      where,
      include: {
        uploader: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        _count: { select: { likeRecords: true, comments: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    });

    return NextResponse.json({ media });
  } catch (e) {
    return NextResponse.json({ media: [] });
  }
}




