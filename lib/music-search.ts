/**
 * Music Search Integration
 * Searches Spotify and YouTube for real, verified songs with caching
 */

import { prisma } from './database';
import { execSync } from 'child_process';
import path from 'path';
import type { TrackIdentifier, VerifiedTrack, Prisma } from '@prisma/client';

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

const supportsCaseInsensitiveFilters = !((process.env.DATABASE_URL || '').startsWith('file:'));

/**
 * Check if the prompt is requesting a single artist
 */
function isSingleArtistRequest(prompt: string): boolean {
  const promptLower = prompt.toLowerCase().trim();
  
  // Check for explicit patterns like "songs by X", "music from X", "X songs", etc.
  const explicitArtistPatterns = [
    /^(?:songs?|music|tracks?) (?:by|from) /i,
    /^only /i,
    /^just /i,
    / only$/i,
    /^([a-z0-9\s]+) songs?$/i,
    /^([a-z0-9\s]+) music$/i,
  ];
  
  if (explicitArtistPatterns.some(pattern => pattern.test(promptLower))) {
    return true;
  }
  
  // Heuristic: If it's a 1-2 word query that DOESN'T contain any genre keywords,
  // it's probably an artist name
  const wordCount = promptLower.split(/\s+/).length;
  if (wordCount <= 2) {
    // Check if it contains known genre/mood keywords
    const genreKeywords = [
      'rock', 'pop', 'jazz', 'metal', 'hip hop', 'hip-hop', 'rap', 'electronic', 'electronic', 'edm',
      'ambient', 'indie', 'folk', 'blues', 'country', 'reggae', 'soul', 'funk', 'disco', 'punk',
      'happy', 'sad', 'chill', 'relaxing', 'energetic', 'upbeat', 'mellow', 'angry', 'peaceful',
      'dark', 'light', 'romantic', 'party', 'workout', 'study', 'focus', 'calm', 'intense',
      'acoustic', 'electric', 'synth', 'instrumental', 'vocal', 'uplifting', 'melancholic'
    ];
    
    const hasGenreKeyword = genreKeywords.some(keyword => promptLower.includes(keyword));
    
    if (!hasGenreKeyword) {
      // Likely an artist name
      return true;
    }
  }
  
  return false;
}

/**
 * Apply artist diversity: remove duplicate artists unless it's a single-artist request
 * or we don't have enough songs to fill the playlist
 */
function applyArtistDiversity(songs: Song[], targetCount: number, isSingleArtist: boolean): Song[] {
  if (isSingleArtist) {
    // For single artist requests, allow all tracks from that artist
    return songs.slice(0, targetCount);
  }
  
  // Allow max 2 songs per artist (not 1) to provide some variety while allowing related songs
  const MAX_SONGS_PER_ARTIST = 2;
  const artistSongCount = new Map<string, number>();
  const diverseTracks: Song[] = [];
  
  for (const song of songs) {
    const artistKey = song.artist.toLowerCase().trim();
    const currentCount = artistSongCount.get(artistKey) || 0;
    
    // Allow up to MAX_SONGS_PER_ARTIST from each artist
    if (currentCount < MAX_SONGS_PER_ARTIST) {
      diverseTracks.push(song);
      artistSongCount.set(artistKey, currentCount + 1);
      
      if (diverseTracks.length >= targetCount) {
        break;
      }
    }
  }
  
  // If we still don't have enough tracks, add more (don't fail on low count)
  if (diverseTracks.length < targetCount && songs.length > diverseTracks.length) {
    const remaining = songs.filter(s => !diverseTracks.includes(s));
    diverseTracks.push(...remaining.slice(0, targetCount - diverseTracks.length));
  }
  
  return diverseTracks;
}

/**
 * Query verified tracks from ingestion pipeline (VerifiedTrack table)
 * Uses database-agnostic Prisma queries to work with both SQLite and PostgreSQL
 */
async function queryVerifiedTracks(prompt: string, limit: number = 15, applyDiversity: boolean = true): Promise<Song[]> {
  try {
    const promptLower = prompt.toLowerCase();
    const isSingleArtist = isSingleArtistRequest(prompt);
    const startTime = Date.now();
    
    // Optimize fetch limits: smaller pools = faster queries (50 for diversity, 30 for single artist)
    const fetchLimit = (applyDiversity && !isSingleArtist) ? 50 : 30;
    
    console.log(`🔍 queryVerifiedTracks: searching for "${promptLower}", fetchLimit=${fetchLimit}`);
    
    // First, check if we can find relevant tracks by genre/mood/artist/title
    // This ensures we're not just ranking by global popularity which would miss niche genres
    // For multi-word queries, split into individual words and match ANY word for broader results
    const queryWords = promptLower.split(/\s+/).filter(w => w.length > 0);
    const orConditions = [];
    
    // Smart genre matching: when searching for "pop", exclude subgenres like k-pop, j-pop, c-pop
    // unless explicitly requested. Prioritize mainstream pop genres.
    const isGenreSearch = queryWords.length === 1 && ['pop', 'rock', 'jazz', 'metal', 'hip hop', 'hip-hop'].includes(queryWords[0]);
    const excludeSubgenres = isGenreSearch ? {
      AND: [
        { primaryGenre: { not: null } },
        { NOT: { primaryGenre: { contains: '-pop' } } },  // Exclude k-pop, j-pop, c-pop, etc.
      ]
    } : undefined;
    
    // Add conditions for each word in the query
    for (const word of queryWords) {
      orConditions.push({ primaryGenre: { contains: word } });
      orConditions.push({ artist: { contains: word } });
      orConditions.push({ title: { contains: word } });
      orConditions.push({ mood: { contains: word } });
    }
    
    const relevantTracks = await prisma.verifiedTrack.findMany({
      where: excludeSubgenres ? {
        AND: [
          excludeSubgenres,
          { OR: orConditions.length > 0 ? orConditions : undefined }
        ]
      } : {
        OR: orConditions.length > 0 ? orConditions : undefined
      },
      orderBy: { trackPopularity: 'desc' },
      take: fetchLimit  // Reduced from 150 for faster queries
    });
    
    // If we found relevant tracks, use them. Otherwise, fall back to top 100 by popularity
    let allTracks = relevantTracks;
    if (allTracks.length === 0) {
      console.log(`📊 No relevant tracks found, falling back to top 100 by popularity`);
      allTracks = await prisma.verifiedTrack.findMany({
        orderBy: { trackPopularity: 'desc' },
        take: 100  // Reduced from 500 for better performance
      });
    }
    
    console.log(`📊 PRIMARY: Found ${relevantTracks.length} relevant tracks, using ${allTracks.length} total`);

    // Optimize scoring: cache string operations, reduce splits
    const scoredTracks: Array<{track: any, score: number}> = [];
    
    // Mainstream pop subgenres that are English/Western-focused
    const mainstreampopGenres = new Set([
      'pop', 'pop rock', 'dance pop', 'electropop', 'pop punk', 
      'soft pop', 'pop soul', 'power pop', 'pop rap', 'synth pop'
    ]);
    
    for (const track of allTracks) {
      let score = 0;
      const titleLower = track.title?.toLowerCase() || '';
      const artistLower = track.artist?.toLowerCase() || '';
      const genresLower = (track.primaryGenre || '').toLowerCase();
      const moodsLower = (track.mood || '').toLowerCase();
      
      // Score based on matches with intelligent genre emphasis
      for (const word of queryWords) {
        if (genresLower === word) {
          // Exact genre match (e.g., "pop" = "pop") gets highest score
          score += 300;
        } else if (isGenreSearch && mainstreampopGenres.has(genresLower)) {
          // Boost mainstream pop subgenres when searching for "pop"
          score += 200;
        } else if (genresLower.includes(word)) {
          // Partial match (e.g., "pop" in "soft pop") gets good score
          score += 100;
        }
        
        if (moodsLower.includes(word)) score += 80;
        if (titleLower.includes(word)) score += 40;
        if (artistLower.includes(word)) score += 30;
      }
      
      // Only add tracks with matches
      if (score > 0) {
        score += (track.trackPopularity || 0) * 0.2;  // Popularity bonus
        scoredTracks.push({ track, score });
      }
    }
    
    // Sort and limit in one pass
    scoredTracks.sort((a, b) => b.score - a.score).splice(fetchLimit);

    console.log(`📊 queryVerifiedTracks: found ${scoredTracks.length} matches`);
    if (scoredTracks.length === 0) {
      console.log(`⚠️  No tracks found for query "${promptLower}"`);
      return [];
    }
    
    if (scoredTracks.length > 0) {
      console.log(`📊 Sample: "${scoredTracks[0].track.title}" by "${scoredTracks[0].track.artist}" (score: ${scoredTracks[0].score.toFixed(1)})`);
    }

    // Apply artist diversity BEFORE random selection to get diverse pool
    let tracksForSelection = scoredTracks;
    if (applyDiversity && !isSingleArtist) {
      // Filter for diversity: max 3 songs per artist before random selection
      const MAX_SONGS_PER_ARTIST = 3;
      const artistSongCount = new Map<string, number>();
      tracksForSelection = [];
      
      for (const scoredTrack of scoredTracks) {
        const artistKey = scoredTrack.track.artist.toLowerCase().trim();
        const currentCount = artistSongCount.get(artistKey) || 0;
        
        if (currentCount < MAX_SONGS_PER_ARTIST) {
          tracksForSelection.push(scoredTrack);
          artistSongCount.set(artistKey, currentCount + 1);
        }
      }
      
      console.log(`🎨 Diversity filter: ${tracksForSelection.length} tracks after limiting to ${MAX_SONGS_PER_ARTIST} per artist`);
    }

    // Efficiently select N random tracks from pool using Fisher-Yates
    const selectedTracks: any[] = [];
    const available = [...tracksForSelection];
    
    for (let i = 0; i < Math.min(limit, available.length); i++) {
      const randomIdx = Math.floor(Math.random() * available.length);
      selectedTracks.push(available[randomIdx].track);
      available.splice(randomIdx, 1);  // Remove selected to avoid duplicates
    }

    // Check if we have enough tracks
    if (selectedTracks.length < limit) {
      console.warn(`⚠️  Only found ${selectedTracks.length}/${limit} tracks for "${promptLower}"`);
    }
    
    const dbTime = Date.now() - startTime;
    if (dbTime > 300) console.log(`⏱️  Query took ${dbTime}ms`);

    // Fetch identifiers for these tracks
    const trackIds = selectedTracks.map(t => t.id);
    
    const identifiersData = await prisma.trackIdentifier.findMany({
      where: {
        trackId: { in: trackIds },
      },
      select: {
        trackId: true,
        type: true,
        value: true,
      },
    });

    // Group identifiers by trackId
    const identifiersByTrackId = new Map<string, any[]>();
    identifiersData.forEach(id => {
      if (!identifiersByTrackId.has(id.trackId)) {
        identifiersByTrackId.set(id.trackId, []);
      }
      identifiersByTrackId.get(id.trackId)!.push(id);
    });

    // Convert VerifiedTrack records to Song format with metadata for sorting
    const songs: (Song & { popularity?: number; releaseDate?: Date })[] = selectedTracks
      .map((track: any) => {
        const identifiers = identifiersByTrackId.get(track.id) || [];
        const spotifyIdentifier = identifiers.find((id: any) => id.type === 'spotify');
        const youtubeIdentifier = identifiers.find((id: any) => id.type === 'youtube');
        const resolvedSpotifyUrl =
          buildSpotifyUrl(track.spotifyUrl) ||
          buildSpotifyUrl(track.spotifyId) ||
          buildSpotifyUrl(spotifyIdentifier?.value);
        
        return {
          title: track.title,
          artist: track.artist,
          genre: track.primaryGenre || undefined,
          year: track.releaseDate ? new Date(track.releaseDate).getFullYear() : undefined,
          spotifyUrl: resolvedSpotifyUrl || undefined,
          youtubeUrl: youtubeIdentifier ? `https://www.youtube.com/watch?v=${youtubeIdentifier.value}` : undefined,
          verified: true,
          source: 'database',
          popularity: track.trackPopularity || 0,
          releaseDate: track.releaseDate,
        };
      })
      .filter((s: any) => s.title && s.artist) as Song[];

    // Sort with heavy bias toward newer songs while maintaining popularity quality
    // Algorithm: Combined score = (recency * 0.7) + (popularity * 0.3)
    // This heavily favors recent songs but still respects popularity
    const currentYear = new Date().getFullYear();
    songs.sort((a, b) => {
      const aYear = a.releaseDate ? new Date(a.releaseDate).getFullYear() : currentYear - 30;
      const aRecency = Math.max(0, (aYear - (currentYear - 30)) / 30); // Songs in last 30 years normalized to 0-1
      const aPopularity = (a.popularity || 0) / 100; // Normalize to 0-1
      const aScore = (aRecency * 0.7) + (aPopularity * 0.3);
      
      const bYear = b.releaseDate ? new Date(b.releaseDate).getFullYear() : currentYear - 30;
      const bRecency = Math.max(0, (bYear - (currentYear - 30)) / 30);
      const bPopularity = (b.popularity || 0) / 100;
      const bScore = (bRecency * 0.7) + (bPopularity * 0.3);
      
      return bScore - aScore; // Higher score first
    });

    // Remove the metadata fields before returning
    const finalSongs = songs.slice(0, limit).map(({ popularity, releaseDate, ...song }) => song);

    if (applyDiversity && !isSingleArtist) {
      console.log(`🎨 Songs sorted by popularity and year`);
      return finalSongs;
    }

    return finalSongs;
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
async function searchLocalDatabase(query: string, limit: number = 15, applyDiversity: boolean = true): Promise<Song[]> {
  try {
    const queryLower = query.toLowerCase();
    const isSingleArtist = isSingleArtistRequest(query);
    const fetchLimit = (applyDiversity && !isSingleArtist) ? limit * 3 : limit;
    
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
      LIMIT ${fetchLimit}
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

    // Apply artist diversity if requested
    if (applyDiversity) {
      const diverseSongs = applyArtistDiversity(songs, limit, isSingleArtist);
      console.log(`🎨 Artist diversity applied: ${diverseSongs.length} tracks (single artist: ${isSingleArtist})`);
      return diverseSongs;
    }

    return songs.slice(0, limit);
  } catch (error) {
    console.error('❌ Local database search error:', error);
    return [];
  }
}

function songFromCache(cached: {
  title: string;
  artist: string;
  year: number | null;
  spotifyUrl: string | null;
  spotifyId?: string | null;
  youtubeUrl: string | null;
}): Song {
  const resolvedSpotifyUrl = buildSpotifyUrl(cached.spotifyUrl || cached.spotifyId);
  return {
    title: cached.title,
    artist: cached.artist,
    year: cached.year || undefined,
    spotifyUrl: resolvedSpotifyUrl || undefined,
    youtubeUrl: cached.youtubeUrl || undefined,
    verified: true,
  };
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

        return songFromCache(cached);
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

        return songFromCache(cached);
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

      return songFromCache(cached);
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
    const normalizedSpotifyUrl = buildSpotifyUrl(spotifyUrl);
    const spotifyUrlUpdate = normalizedSpotifyUrl ? { spotifyUrl: normalizedSpotifyUrl } : {};
    const youtubeUrlUpdate = youtubeUrl ? { youtubeUrl } : {};

    // Use upsert to handle duplicates gracefully
    if (spotifyId) {
      await prisma.songCache.upsert({
        where: { spotifyId },
        update: {
          ...spotifyUrlUpdate,
          ...youtubeUrlUpdate,
          lastAccessed: new Date(),
          hitCount: { increment: 1 },
        },
        create: {
          title,
          artist,
          spotifyId,
          isrc,
          spotifyUrl: normalizedSpotifyUrl,
          youtubeUrl,
          year,
        },
      });
    } else if (isrc) {
      await prisma.songCache.upsert({
        where: { isrc },
        update: {
          ...spotifyUrlUpdate,
          ...youtubeUrlUpdate,
          lastAccessed: new Date(),
          hitCount: { increment: 1 },
        },
        create: {
          title,
          artist,
          isrc,
          spotifyUrl: normalizedSpotifyUrl,
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
          spotifyUrl: normalizedSpotifyUrl,
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

type VerifiedTrackWithIds = VerifiedTrack & { identifiers: TrackIdentifier[]; spotifyUrl?: string | null };

function normalizeKey(title: string, artist: string) {
  return `${title.toLowerCase().trim()}::${artist.toLowerCase().trim()}`;
}

function normalizeSpotifyTrackId(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const value = raw.trim();
  if (!value) return undefined;

  if (value.startsWith('spotify:track:')) {
    return value.substring('spotify:track:'.length);
  }

  const urlMatch = value.match(/spotify\.com\/track\/([A-Za-z0-9]+)/i);
  if (urlMatch?.[1]) {
    return urlMatch[1];
  }

  const bareIdMatch = value.match(/^[A-Za-z0-9]{11,}$/);
  if (bareIdMatch) {
    return value;
  }

  return undefined;
}

function extractSpotifyId(track: VerifiedTrackWithIds): string | undefined {
  const identifierValue = track.identifiers.find((id) => id.type === 'spotify')?.value;
  return normalizeSpotifyTrackId(track.spotifyUrl || track.spotifyId || identifierValue);
}

function extractYoutubeUrl(track: VerifiedTrackWithIds): string | undefined {
  const raw = track.identifiers.find((id) => id.type === 'youtube')?.value;
  if (!raw) return undefined;
  if (raw.startsWith('http')) return raw;
  return `https://www.youtube.com/watch?v=${raw}`;
}

function buildSpotifyUrl(raw?: string | null) {
  const normalized = normalizeSpotifyTrackId(raw);
  if (!normalized) return undefined;
  return `spotify:track:${normalized}`;
}

function buildExactMatchClause(title: string, artist: string): Prisma.VerifiedTrackWhereInput | null {
  if (!title || !artist) return null;
  if (supportsCaseInsensitiveFilters) {
    return {
      AND: [
        { title: { equals: title, mode: 'insensitive' as const } },
        { artist: { equals: artist, mode: 'insensitive' as const } },
      ],
    };
  }
  return {
    AND: [
      { title: { equals: title } },
      { artist: { equals: artist } },
    ],
  };
}

function buildFuzzyMatchClause(title: string, artist: string): Prisma.VerifiedTrackWhereInput | null {
  if (!title || !artist) return null;
  if (supportsCaseInsensitiveFilters) {
    return {
      AND: [
        { title: { contains: title, mode: 'insensitive' as const } },
        { artist: { contains: artist, mode: 'insensitive' as const } },
      ],
    };
  }
  return {
    AND: [
      { title: { contains: title } },
      { artist: { contains: artist } },
    ],
  };
}

function trackToSong(track: VerifiedTrackWithIds & { spotifyUrl?: string | null }, fallback?: Partial<Song>): Song {
  const spotifyId = extractSpotifyId(track);
  const spotifyUrl = buildSpotifyUrl(track.spotifyUrl || spotifyId);
  const youtubeUrl = extractYoutubeUrl(track);
  const releaseYear = track.releaseDate ? new Date(track.releaseDate).getFullYear() : fallback?.year;

  return {
    title: track.title,
    artist: track.artist,
    genre: track.primaryGenre || fallback?.genre,
    mood: track.mood || fallback?.mood,
    year: releaseYear,
    spotifyUrl: spotifyUrl,
    youtubeUrl,
    verified: true,
    source: 'database',
  };
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
    
    // PRIMARY: Query VerifiedTrack table from ingestion pipeline (PostgreSQL)
    console.log(`📊 PRIMARY: Querying verified tracks from ingestion pipeline (VerifiedTrack)...`);
    const verifiedTracks = await queryVerifiedTracks(prompt, limit);
    
    if (verifiedTracks.length > 0) {
      console.log(`✅ Verified tracks found: ${verifiedTracks.length} tracks from ingestion pipeline`);
      console.log(`🎯 Returning ${verifiedTracks.length} tracks from INGESTION PIPELINE - FRESHNESS SORTED`);
      console.log(`📊 Top 3 years: ${verifiedTracks.slice(0, 3).map((t) => t.year || '?').join(', ')}`);
      return verifiedTracks;
    }

    console.log(`⚠️  No verified tracks found in PostgreSQL pipeline`);
    console.log(`📝 Note: Local SQLite fallback disabled - all data should be in PostgreSQL`);
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

export async function verifySongs(
  songs: Array<{ title: string; artist: string; genre?: string; mood?: string; year?: number }>
): Promise<Song[]> {
  if (!songs || songs.length === 0) return [];

  const normalizedInputs = songs.map((song, idx) => ({
    idx,
    original: song,
    title: song.title?.trim() || '',
    artist: song.artist?.trim() || '',
  }));

  const resolved: (Song | null)[] = Array(songs.length).fill(null);

  // Step 1: quick cache lookups to avoid repeated Prisma queries
  await Promise.all(
    normalizedInputs.map(async (entry) => {
      if (!entry.title || !entry.artist) return;
      const cached = await checkSongCache(entry.artist, entry.title);
      if (cached) {
        resolved[entry.idx] = {
          ...cached,
          genre: cached.genre || entry.original.genre,
          mood: cached.mood || entry.original.mood,
          year: cached.year || entry.original.year,
          source: cached.source || 'database',
          verified: true,
        };
      }
    })
  );

  const unresolved = normalizedInputs.filter((entry) => !resolved[entry.idx] && entry.title && entry.artist);
  if (unresolved.length === 0) {
    return resolved.map((song, idx) => song || {
      ...songs[idx],
      verified: false,
      source: 'ai-generated',
    });
  }

  // Step 2: batch exact matches for the remaining songs
  const exactClauses = unresolved
    .map((entry) => buildExactMatchClause(entry.title, entry.artist))
    .filter(Boolean) as Prisma.VerifiedTrackWhereInput[];

  const trackMap = new Map<string, VerifiedTrackWithIds>();
  if (exactClauses.length > 0) {
    const matches = await prisma.verifiedTrack.findMany({
      where: { OR: exactClauses },
      include: { identifiers: true },
    });
    matches.forEach((track) => {
      trackMap.set(normalizeKey(track.title, track.artist), track);
    });
  }

  // Step 3: resolve each outstanding song, using fuzzy search as a fallback
  for (const entry of unresolved) {
    const key = normalizeKey(entry.title, entry.artist);
    let track = trackMap.get(key);

    if (!track) {
      const fuzzyClause = buildFuzzyMatchClause(entry.title, entry.artist);
      if (fuzzyClause) {
        track = await prisma.verifiedTrack.findFirst({
          where: fuzzyClause,
          include: { identifiers: true },
        }) || undefined;
      }
    }

    if (track) {
      const verifiedSong = trackToSong(track, entry.original);
      resolved[entry.idx] = verifiedSong;
      await saveSongCache(
        verifiedSong.title,
        verifiedSong.artist,
        verifiedSong.spotifyUrl,
        verifiedSong.youtubeUrl,
        extractSpotifyId(track),
        track.isrc || undefined,
        verifiedSong.year
      );
    } else {
      resolved[entry.idx] = {
        ...entry.original,
        verified: false,
          source: 'ai-generated',
      };
    }
  }

  return resolved.map((song, idx) => song || {
    ...songs[idx],
    verified: false,
    source: 'ai-generated',
  });
}

