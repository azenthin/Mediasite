import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

// In-memory session tracking for recently shown tracks (expires after 1 hour)
const sessionCache = new Map<string, { tracks: Set<string>; timestamp: number }>();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Clean up expired sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, data] of sessionCache.entries()) {
    if (now - data.timestamp > CACHE_DURATION) {
      sessionCache.delete(sessionId);
    }
  }
}, 5 * 60 * 1000);

interface SearchParams {
  q: string;
  genre?: string;
  mood?: string;
  artist?: string;
  limit?: number;
  offset?: number;
  sessionId?: string;
  shuffle?: boolean;
  excludeRecent?: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const params: SearchParams = {
      q: (searchParams.get('q') || '').trim(),
      genre: searchParams.get('genre') || undefined,
      mood: searchParams.get('mood') || undefined,
      artist: searchParams.get('artist') || undefined,
      limit: Math.min(parseInt(searchParams.get('limit') || '20', 10), 100),
      offset: parseInt(searchParams.get('offset') || '0', 10),
      sessionId: searchParams.get('sessionId') || undefined,
      shuffle: searchParams.get('shuffle') === 'true',
      excludeRecent: searchParams.get('excludeRecent') !== 'false', // Default true
    };

    // Get session tracking data
    let excludedIds: string[] = [];
    if (params.sessionId && params.excludeRecent) {
      const session = sessionCache.get(params.sessionId);
      if (session) {
        excludedIds = Array.from(session.tracks);
        // Update timestamp
        session.timestamp = Date.now();
      } else {
        // Create new session
        sessionCache.set(params.sessionId, {
          tracks: new Set(),
          timestamp: Date.now(),
        });
      }
    }

    // Build search conditions
    const conditions: any[] = [];
    
    if (params.q) {
      // Search in title, artist, album
      const searchTerm = params.q.toLowerCase();
      conditions.push({
        OR: [
          { title: { contains: searchTerm, mode: 'insensitive' as const } },
          { artist: { contains: searchTerm, mode: 'insensitive' as const } },
          { album: { contains: searchTerm, mode: 'insensitive' as const } },
        ],
      });
    }

    if (params.genre) {
      conditions.push({ genre: { contains: params.genre, mode: 'insensitive' as const } });
    }

    if (params.mood) {
      conditions.push({ mood: { contains: params.mood, mode: 'insensitive' as const } });
    }

    if (params.artist) {
      conditions.push({ artist: { contains: params.artist, mode: 'insensitive' as const } });
    }

    // Exclude recently shown tracks
    if (excludedIds.length > 0) {
      conditions.push({
        id: { notIn: excludedIds },
      });
    }

    const where = conditions.length > 0 ? { AND: conditions } : {};

    // Get total count for pagination
    const total = await prisma.verifiedTrack.count({ where });

    // Determine ordering strategy
    let orderBy: any;
    // Fetch more than needed if shuffling to increase variety
    const limit = params.limit ?? 20;
    const offset = params.offset ?? 0;
    const fetchLimit = params.shuffle ? Math.min(limit * 3, 100) : limit;

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
      orderBy: [
        { verifiedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      skip: offset,
      take: fetchLimit,
    });

    // If shuffling, do client-side randomization
    if (params.shuffle && tracks.length > limit) {
      // Fisher-Yates shuffle
      for (let i = tracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
      }
      tracks = tracks.slice(0, limit);
    }

    // Update session cache with shown tracks
    if (params.sessionId && tracks.length > 0) {
      const session = sessionCache.get(params.sessionId);
      if (session) {
        tracks.forEach(track => session.tracks.add(track.id));
      }
    }

    // Format response
    const formattedTracks = tracks.map(track => ({
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
        offset: offset,
        limit: limit,
        hasMore: offset + tracks.length < total,
      },
      session: {
        id: params.sessionId,
        excludedCount: excludedIds.length,
      },
    });

  } catch (error) {
    logger.error('Music search error', error instanceof Error ? error : undefined, {
      component: 'api.music.search',
    });
    return NextResponse.json(
      { error: 'Search failed', tracks: [] },
      { status: 500 }
    );
  }
}
