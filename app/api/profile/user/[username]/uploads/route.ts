import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { username: string } }
) {
  try {
    const { username } = params;

    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const media = await prisma.media.findMany({
      where: { uploaderId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        url: true,
        thumbnailUrl: true,
        views: true,
        createdAt: true,
        _count: {
          select: {
            likeRecords: true,
            comments: true
          }
        }
      }
    });

    return NextResponse.json({ items: media });
  } catch (error) {
    console.error('Error fetching user uploads:', error);
    return NextResponse.json(
      { error: 'Failed to fetch uploads' },
      { status: 500 }
    );
  }
}
