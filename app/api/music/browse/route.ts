import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

// Session cache for browse history
const browseCache = new Map<string, { viewed: Set<string>; timestamp: number }>();
const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours for browse sessions

// Clean up every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, data] of browseCache.entries()) {
    if (now - data.timestamp > CACHE_DURATION) {
      browseCache.delete(sessionId);
    }
  }
}, 10 * 60 * 1000);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const genre = searchParams.get('genre') || undefined;
    const mood = searchParams.get('mood') || undefined;
    const minScore = parseFloat(searchParams.get('minScore') || '0.7'); // Only high-quality tracks
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
    const sessionId = searchParams.get('sessionId');
    const excludeViewed = searchParams.get('excludeViewed') !== 'false'; // Default true

    // Get session tracking
    let excludedIds: string[] = [];
    if (sessionId && excludeViewed) {
      const session = browseCache.get(sessionId);
      if (session) {
        excludedIds = Array.from(session.viewed);
        session.timestamp = Date.now();
      } else {
        browseCache.set(sessionId, {
          viewed: new Set(),
          timestamp: Date.now(),
        });
      }
    }

    // Build where clause
    const conditions: any[] = [
      // canonicalityScore removed from new schema
    ];

    if (genre) {
      conditions.push({ genre: { contains: genre, mode: 'insensitive' as const } });
    }

    if (mood) {
      conditions.push({ mood: { contains: mood, mode: 'insensitive' as const } });
    }

    if (excludedIds.length > 0) {
      conditions.push({ id: { notIn: excludedIds } });
    }

    const where = { AND: conditions };

    // Get total count
    const total = await prisma.verifiedTrack.count({ where });

    if (total === 0) {
      return NextResponse.json({
        tracks: [],
        pagination: { total: 0, limit, hasMore: false },
        session: { id: sessionId, viewedCount: excludedIds.length },
      });
    }

    // Simple random sampling strategy (no canonicality scores yet):
    // 1. Fetch more tracks than needed (3x)
    // 2. Shuffle them
    // 3. Return requested limit
    const fetchMultiplier = Math.min(3, Math.ceil(100 / limit));
    const fetchLimit = Math.min(limit * fetchMultiplier, 150);
    
    // Use random offset to get different starting points
    const maxOffset = Math.max(0, total - fetchLimit);
    const randomOffset = Math.floor(Math.random() * (maxOffset + 1));

    let tracks = await prisma.verifiedTrack.findMany({
      where,
      select: {
        id: true,
        internalUuid: true,
        title: true,
        artist: true,
        album: true,
        duration: true,
        releaseDate: true,
        verifiedAt: true,
        isrc: true,

      },
      orderBy: { verifiedAt: 'desc' },
      skip: randomOffset,
      take: fetchLimit,
    });

    // Fisher-Yates shuffle for random selection
    for (let i = tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
    }
    
    const selectedTracks = tracks.slice(0, limit);

    // Update session cache
    if (sessionId) {
      const session = browseCache.get(sessionId);
      if (session) {
        selectedTracks.forEach(track => session.viewed.add(track.id));
      }
    }

    // Format response
    const formattedTracks = selectedTracks.map(track => ({
      id: track.id,
      uuid: track.internalUuid,
      title: track.title,
      artist: track.artist,
      album: track.album,
      duration: track.duration,
      releaseDate: track.releaseDate,
      identifiers: {

        isrc: track.isrc,

      },
      spotify: {
        // Spotify ID from identifiers table
      },
      verifiedAt: track.verifiedAt,
    }));

    return NextResponse.json({
      tracks: formattedTracks,
      pagination: {
        total,
        limit,
        hasMore: excludedIds.length + selectedTracks.length < total,
      },
      session: {
        id: sessionId,
        viewedCount: excludedIds.length + selectedTracks.length,
      },
    });

  } catch (error) {
    logger.error('Music browse error', error instanceof Error ? error : undefined, {
      component: 'api.music.browse',
    });
    return NextResponse.json(
      { error: 'Browse failed', tracks: [] },
      { status: 500 }
    );
  }
}
