import { NextRequest, NextResponse } from 'next/server';
import { safeAuth } from '@/lib/safe-auth';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const session = await safeAuth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get pagination params from query string
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const skip = (page - 1) * limit;

    // Fetch playlists for the user
    const [playlists, total] = await Promise.all([
      prisma.aIPlaylist.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.aIPlaylist.count({ where: { userId } }),
    ]);

    // Parse songs JSON for each playlist
    const playlistsWithParsedSongs = playlists.map((pl: any) => ({
      ...pl,
      songs: JSON.parse(pl.songs),
    }));

    return NextResponse.json({
      playlists: playlistsWithParsedSongs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('AI Playlists fetch error', error instanceof Error ? error : undefined, {
      component: 'api.ai-playlists',
    });
    return NextResponse.json(
      { error: 'Failed to fetch playlists' },
      { status: 500 }
    );
  }
}
