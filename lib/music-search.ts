/**
 * Music Search Integration
 * Searches Spotify and YouTube for real, verified songs with caching
 */

import { prisma } from './database';
import { execSync } from 'child_process';
import path from 'path';

interface Song {
  title: string;
  artist: string;
  genre?: string;
  mood?: string;
  year?: number;
  spotifyUrl?: string;
  youtubeUrl?: string;
  verified: boolean;
  source?: 'genre-match' | 'fuzzy-match' | 'search-fallback' | 'ai-generated' | 'database';
}

/**
 * Query verified tracks from ingestion pipeline (VerifiedTrack table)
 * Matches by artist or title
 */
async function queryVerifiedTracks(prompt: string, limit: number = 15): Promise<Song[]> {
  try {
    const promptLower = prompt.toLowerCase();
    
    // Query VerifiedTrack table with enriched search (genre, mood, popularity)
    // Note: SQLite is case-insensitive by default for LIKE operations (which contains uses)
    const verifiedTracks = await prisma.verifiedTrack.findMany({
      where: {
        OR: [
          { artist: { contains: promptLower } },
          { title: { contains: promptLower } },
          { album: { contains: promptLower } },
          { primaryGenre: { contains: promptLower } },
          { genres: { contains: promptLower } },
          { mood: { contains: promptLower } },
        ],
      },
      include: {
        identifiers: true,
      },
      orderBy: [
        { trackPopularity: 'desc' },
        { verifiedAt: 'desc' },
      ],
      take: limit,
    });

    if (verifiedTracks.length === 0) {
      return [];
    }

    // Convert VerifiedTrack records to Song format
    const songs: Song[] = verifiedTracks
      .map((track: any) => {
        const spotifyIdentifier = track.identifiers?.find((id: any) => id.type === 'spotify');
        const youtubeIdentifier = track.identifiers?.find((id: any) => id.type === 'youtube');
        
        return {
          title: track.title,
          artist: track.artist,
          year: track.releaseDate ? new Date(track.releaseDate).getFullYear() : undefined,
          spotifyUrl: spotifyIdentifier ? `spotify:track:${spotifyIdentifier.value}` : undefined,
          youtubeUrl: youtubeIdentifier ? `https://www.youtube.com/watch?v=${youtubeIdentifier.value}` : undefined,
          verified: true,
          source: 'ingestion-pipeline',
        };
      })
      .filter((s: any) => s.title && s.artist) as Song[];

    // FRESHNESS SORTING: 2015+ songs first (newest to oldest), then pre-2015 songs
    songs.sort((a: any, b: any) => {
      const yearA = a.year || 1995;
      const yearB = b.year || 1995;
      
      // Primary sort: 2015+ songs come first
      if ((yearA >= 2015) !== (yearB >= 2015)) {
        return (yearB >= 2015) ? 1 : -1;
      }
      
      // Secondary sort: within each era, newest first
      return yearB - yearA;
    });

    return songs;
  } catch (error) {
    console.error('Failed to query verified tracks:', error);
    return [];
  }
}

/**
 * Search local enhanced_music.db database for songs matching a query
 * Filters by genres/moods and returns freshest results
 * Returns songs sorted by release_year (newest first) for freshness
 */
async function searchLocalDatabase(query: string, limit: number = 15): Promise<Song[]> {
  try {
    const queryLower = query.toLowerCase();
    console.log(`🏠 Searching local database for: "${query}"`);

    // Use sqlite3 CLI to query the database
    // Search by genre, mood, or title/artist with 2015+ prioritization
    const sqlQuery = `
      SELECT 
        title,
        artist,
        genres,
        moods,
        release_year,
        popularity_score
      FROM songs
      WHERE 
        (LOWER(genres) LIKE '%${queryLower}%' OR 
         LOWER(moods) LIKE '%${queryLower}%' OR 
         LOWER(title) LIKE '%${queryLower}%' OR
         LOWER(artist) LIKE '%${queryLower}%' OR
         LOWER(tags) LIKE '%${queryLower}%')
        AND release_year IS NOT NULL
      ORDER BY 
        CASE WHEN release_year >= 2015 THEN 0 ELSE 1 END,
        release_year DESC,
        popularity_score DESC
      LIMIT ${limit}
    `.replace(/\n/g, ' ');

    const dbPath = path.join(process.cwd(), 'enhanced_music.db');
    const command = `sqlite3 "${dbPath}" "${sqlQuery.replace(/"/g, '\\"')}"`;
    
    let output = '';
    try {
      output = execSync(command, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    } catch (error: any) {
      console.error('❌ Database query failed:', error.message);
      return [];
    }

    if (!output.trim()) {
      console.log(`📦 Database returned 0 tracks`);
      return [];
    }

    // Parse the pipe-delimited output
    const lines = output.trim().split('\n');
    const songs: Song[] = lines.map(line => {
      const parts = line.split('|');
      return {
        title: parts[0]?.trim() || '',
        artist: parts[1]?.trim() || '',
        genre: parts[2] ? parts[2].trim().split(',')[0] : undefined,
        mood: parts[3] ? parts[3].trim().split(',')[0] : undefined,
        year: parts[4] ? parseInt(parts[4].trim(), 10) : undefined,
        verified: true,
        source: 'database',
      } as Song;
    }).filter(s => s.title && s.artist) as Song[];

    console.log(`📦 Database returned ${songs.length} tracks`);

    if (songs.length > 0) {
      console.log(`📅 APPLYING FRESHNESS SORT: Prioritizing 2015+ songs (database search)`);
      console.log(`📊 Top 3 years: ${songs.slice(0, 3).map(s => s.year).join(', ')}`);
    }

    return songs;
  } catch (error) {
    console.error('❌ Local database search error:', error);
    return [];
  }
}

/**
 * Check cache for song URLs
 */
async function checkSongCache(
  artist: string,
  title: string,
  spotifyId?: string,
  isrc?: string
): Promise<Song | null> {
  try {
    // Try to find by ISRC first (most accurate)
    if (isrc) {
      const cached = await prisma.songCache.findUnique({
        where: { isrc },
      });
      
      if (cached) {
        // Update hit count and last accessed
        await prisma.songCache.update({
          where: { id: cached.id },
          data: {
            hitCount: { increment: 1 },
            lastAccessed: new Date(),
          },
        });
        
        return {
          title: cached.title,
          artist: cached.artist,
          year: cached.year || undefined,
          spotifyUrl: cached.spotifyUrl || undefined,
          youtubeUrl: cached.youtubeUrl || undefined,
          verified: true,
        };
      }
    }
    
    // Try Spotify ID
    if (spotifyId) {
      const cached = await prisma.songCache.findUnique({
        where: { spotifyId },
      });
      
      if (cached) {
        await prisma.songCache.update({
          where: { id: cached.id },
          data: {
            hitCount: { increment: 1 },
            lastAccessed: new Date(),
          },
        });
        
        return {
          title: cached.title,
          artist: cached.artist,
          year: cached.year || undefined,
          spotifyUrl: cached.spotifyUrl || undefined,
          youtubeUrl: cached.youtubeUrl || undefined,
          verified: true,
        };
      }
    }
    
    // Fallback to artist + title match
    const cached = await prisma.songCache.findFirst({
      where: {
        artist: { equals: artist },
        title: { equals: title },
      },
    });
    
    if (cached) {
      await prisma.songCache.update({
        where: { id: cached.id },
        data: {
          hitCount: { increment: 1 },
          lastAccessed: new Date(),
        },
      });
      
      return {
        title: cached.title,
        artist: cached.artist,
        year: cached.year || undefined,
        spotifyUrl: cached.spotifyUrl || undefined,
        youtubeUrl: cached.youtubeUrl || undefined,
        verified: true,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Cache lookup error:', error);
    return null;
  }
}

/**
 * Save song to cache
 */
async function saveSongCache(
  title: string,
  artist: string,
  spotifyUrl?: string,
  youtubeUrl?: string,
  spotifyId?: string,
  isrc?: string,
  year?: number
): Promise<void> {
  try {
    // Use upsert to handle duplicates gracefully
    if (spotifyId) {
      await prisma.songCache.upsert({
        where: { spotifyId },
        update: {
          youtubeUrl: youtubeUrl || undefined,
          lastAccessed: new Date(),
          hitCount: { increment: 1 },
        },
        create: {
          title,
          artist,
          spotifyId,
          isrc,
          spotifyUrl,
          youtubeUrl,
          year,
        },
      });
    } else if (isrc) {
      await prisma.songCache.upsert({
        where: { isrc },
        update: {
          youtubeUrl: youtubeUrl || undefined,
          lastAccessed: new Date(),
          hitCount: { increment: 1 },
        },
        create: {
          title,
          artist,
          isrc,
          spotifyUrl,
          youtubeUrl,
          year,
        },
      });
    } else {
      // No unique identifier, just create
      await prisma.songCache.create({
        data: {
          title,
          artist,
          spotifyUrl,
          youtubeUrl,
          year,
        },
      });
    }
  } catch (error) {
    // Non-fatal - just log
    console.error('Failed to cache song:', error);
  }
}

/**
 * @deprecated These functions were used for old Spotify genre-based recommendations
 * Now using ingestion pipeline verified tracks instead
 */
// Disabled: getSpotifyToken, getAvailableGenres, GENRE_MAPPINGS, stringSimilarity, findSimilarGenres
// All Spotify genre-based recommendations have been replaced with queryVerifiedTracks()

/**
 * Get song recommendations - PRIMARY: verified tracks from ingestion pipeline (VerifiedTrack table)
 * Falls back to local database cache if ingestion pipeline has no matches
 */
export async function getSpotifyRecommendations(
  prompt: string,
  limit: number = 15
): Promise<Song[]> {
  try {
    console.log(`🎵 getSpotifyRecommendations called with prompt: "${prompt}"`);
    
    // PRIMARY: Query VerifiedTrack table from ingestion pipeline
    console.log(`📊 PRIMARY: Querying verified tracks from ingestion pipeline (VerifiedTrack)...`);
    const verifiedTracks = await queryVerifiedTracks(prompt, limit);
    
    if (verifiedTracks.length > 0) {
      console.log(`✅ Verified tracks found: ${verifiedTracks.length} tracks from ingestion pipeline`);
      console.log(`🎯 Returning ${verifiedTracks.length} tracks from INGESTION PIPELINE - FRESHNESS SORTED`);
      console.log(`📊 Top 3 years: ${verifiedTracks.slice(0, 3).map((t) => t.year || '?').join(', ')}`);
      return verifiedTracks;
    }

    console.log(`⚠️  No verified tracks found in pipeline, falling back to local database cache...`);
    
    const cacheResults = await searchLocalDatabase(prompt, limit);
    if (cacheResults.length > 0) {
      console.log(`✅ Local cache found: ${cacheResults.length} tracks`);
      console.log(`🎯 Returning ${cacheResults.length} tracks from LOCAL CACHE - FRESHNESS SORTED`);
      console.log(`📊 Top 3 years: ${cacheResults.slice(0, 3).map((t) => t.year || '?').join(', ')}`);
      return cacheResults;
    }

    console.log(`⚠️  No results found in verified pipeline or local cache`);
    return [];
  } catch (error) {
    console.error('Music recommendations error:', error);
    return [];
  }
}

/**
 * @deprecated Use queryVerifiedTracks() from ingestion pipeline instead
 * This function is disabled and should not be used
 */
export async function searchSpotify(query: string): Promise<(Song & { isrc?: string; spotifyId?: string }) | null> {
  console.warn('❌ searchSpotify() is DEPRECATED - use ingestion pipeline verified tracks instead');
  return null;
}

/**
 * @deprecated Use ingestion pipeline verified tracks instead
 * This function is disabled and should not be used
 */
export async function searchYouTube(query: string, isrc?: string): Promise<Song | null> {
  console.warn('❌ searchYouTube() is DEPRECATED - use ingestion pipeline verified tracks instead');
  return null;
}

/**
 * @deprecated Use ingestion pipeline verified tracks instead
 * This function is disabled and should not be used
 */
export async function searchBoth(title: string, artist: string): Promise<Song> {
  console.warn('❌ searchBoth() is DEPRECATED - use ingestion pipeline verified tracks instead');
  return {
    title,
    artist,
    verified: false,
  };
}

/**
 * @deprecated Use ingestion pipeline verified tracks instead
 * This function is disabled and should not be used
 */
export async function verifySongs(songs: Array<{ title: string; artist: string; genre?: string; mood?: string; year?: number }>): Promise<Song[]> {
  console.warn('❌ verifySongs() is DEPRECATED - use ingestion pipeline verified tracks instead');
  return songs.map(song => ({
    ...song,
    verified: false,
  }));
}

