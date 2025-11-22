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
    
    // Add conditions for each word in the query
    for (const word of queryWords) {
      orConditions.push({ primaryGenre: { contains: word } });
      orConditions.push({ artist: { contains: word } });
      orConditions.push({ title: { contains: word } });
      orConditions.push({ mood: { contains: word } });
    }
    
    const relevantTracks = await prisma.verifiedTrack.findMany({
      where: {
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
    
    for (const track of allTracks) {
      let score = 0;
      const titleLower = track.title?.toLowerCase() || '';
      const artistLower = track.artist?.toLowerCase() || '';
      const genresLower = (track.primaryGenre || '').toLowerCase();
      const moodsLower = (track.mood || '').toLowerCase();
      
      // Score based on matches (faster than complex splits)
      for (const word of queryWords) {
        if (genresLower.includes(word)) score += 100;
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

    // Convert VerifiedTrack records to Song format
    const songs: Song[] = selectedTracks
      .map((track: any) => {
        const identifiers = identifiersByTrackId.get(track.id) || [];
        const spotifyIdentifier = identifiers.find((id: any) => id.type === 'spotify');
        const youtubeIdentifier = identifiers.find((id: any) => id.type === 'youtube');
        
        return {
          title: track.title,
          artist: track.artist,
          genre: track.primaryGenre || undefined,
          year: track.releaseDate ? new Date(track.releaseDate).getFullYear() : undefined,
          spotifyUrl: spotifyIdentifier ? `spotify:track:${spotifyIdentifier.value}` : undefined,
          youtubeUrl: youtubeIdentifier ? `https://www.youtube.com/watch?v=${youtubeIdentifier.value}` : undefined,
          verified: true,
          source: 'database',
        };
      })
      .filter((s: any) => s.title && s.artist) as Song[];

    // Apply artist diversity if requested
    if (applyDiversity && !isSingleArtist) {
      // Diversity has already been applied during selection phase
      console.log(`🎨 Artist diversity already applied during selection`);
      return songs.slice(0, limit);
    }

    return songs.slice(0, limit);
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

