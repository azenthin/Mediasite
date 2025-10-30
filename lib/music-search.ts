/**
 * Music Search Integration
 * Searches Spotify and YouTube for real, verified songs with caching
 */

import { prisma } from './database';

interface Song {
  title: string;
  artist: string;
  genre?: string;
  mood?: string;
  year?: number;
  spotifyUrl?: string;
  youtubeUrl?: string;
  verified: boolean;
  source?: 'genre-match' | 'fuzzy-match' | 'search-fallback' | 'ai-generated';
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
        artist: { equals: artist, mode: 'insensitive' },
        title: { equals: title, mode: 'insensitive' },
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
 * Get Spotify access token
 */
async function getSpotifyToken(): Promise<string | null> {
  try {
    console.log('🔑 Requesting Spotify token...');
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString('base64'),
      },
      body: 'grant_type=client_credentials',
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ Spotify token error:', tokenResponse.status, errorText);
      return null;
    }

    const { access_token } = await tokenResponse.json();
    console.log('✅ Got Spotify token:', access_token ? 'SUCCESS' : 'FAILED');
    return access_token;
  } catch (error) {
    console.error('❌ Spotify token exception:', error);
    return null;
  }
}

/**
 * Get all available genre seeds from Spotify
 */
async function getAvailableGenres(token: string): Promise<string[]> {
  try {
    const url = 'https://api.spotify.com/v1/recommendations/available-genre-seeds';
    console.log(`🌐 Fetching Spotify genres from: ${url}`);
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Spotify genre API failed: ${response.status} ${response.statusText}`);
      console.error(`❌ Response body:`, errorText.substring(0, 500));
      console.error(`❌ Request headers: Authorization: Bearer ${token.substring(0, 20)}...`);
      return [];
    }

    const data = await response.json();
    const genres = data.genres || [];
    console.log(`✅ Loaded ${genres.length} genres from Spotify`);
    return genres;
  } catch (error) {
    console.error('Failed to get Spotify genres:', error);
    return [];
  }
}

/**
 * Map popular genre names to their Spotify equivalents or related genres
 * This handles genres that users might search for but don't exist in Spotify's seed list
 */
const GENRE_MAPPINGS: Record<string, string[]> = {
  'uptempo': ['hardstyle', 'hardcore', 'hard-techno', 'gabber', 'speedcore'],
  'rawstyle': ['hardstyle', 'hardcore', 'hard-techno'],
  'frenchcore': ['hardcore', 'hardstyle', 'hard-techno'],
  'terrorcore': ['hardcore', 'speedcore', 'hardstyle'],
  'mainstream': ['pop', 'dance-pop', 'electro-house'],
  'euphoric': ['trance', 'progressive-trance', 'uplifting-trance'],
  'psytrance': ['psych-rock', 'trance', 'psychedelic'],
  'future-bass': ['edm', 'electro', 'dubstep'],
  'lo-fi': ['chill', 'study', 'ambient'],
  'lofi': ['chill', 'study', 'ambient'],
};

/**
 * Calculate similarity between two strings (Levenshtein-based)
 * Returns a score from 0 (no match) to 1 (exact match)
 */
function stringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  // Check for substring matches (higher score)
  if (longer.includes(shorter) || shorter.includes(longer)) {
    return 0.7 + (shorter.length / longer.length) * 0.3;
  }
  
  // Simple character overlap
  const longerChars = new Set(longer.split(''));
  const shorterChars = new Set(shorter.split(''));
  let overlap = 0;
  shorterChars.forEach(char => {
    if (longerChars.has(char)) overlap++;
  });
  
  return overlap / longer.length;
}

/**
 * Find similar genres from Spotify's available genres using fuzzy matching
 */
function findSimilarGenres(searchTerm: string, availableGenres: string[], maxResults: number = 5): string[] {
  const scored = availableGenres
    .map(genre => ({
      genre,
      score: stringSimilarity(searchTerm.toLowerCase(), genre.toLowerCase()),
    }))
    .filter(item => item.score > 0.4) // Only include reasonably similar genres
    .sort((a, b) => b.score - a.score) // Sort by similarity
    .slice(0, maxResults)
    .map(item => item.genre);
  
  return scored;
}

/**
 * Get song recommendations from Spotify based on genre, mood, or search query
 * This uses Spotify's actual recommendation engine and ALL available genres
 */
export async function getSpotifyRecommendations(
  prompt: string,
  limit: number = 15
): Promise<Song[]> {
  try {
    const token = await getSpotifyToken();
    if (!token) return [];

    const promptLower = prompt.toLowerCase();
    console.log(`🎵 getSpotifyRecommendations called with prompt: "${prompt}"`);
    
    // Get ALL available genres from Spotify (hundreds of them!)
    const allGenres = await getAvailableGenres(token);
    console.log(`📊 Spotify has ${allGenres.length} available genres`);
    
    // Find genres that match words in the prompt
    const matchedGenres: string[] = [];
    
    // Split prompt into words and check each against Spotify's genre list
    const promptWords = promptLower.split(/\s+/);
    console.log(`🔍 Prompt words:`, promptWords);
    
    // First, check if any prompt words match our genre mappings
    for (const word of promptWords) {
      if (GENRE_MAPPINGS[word]) {
        console.log(`✅ Found hardcoded mapping for "${word}":`, GENRE_MAPPINGS[word]);
        const mappedGenres = GENRE_MAPPINGS[word].filter(g => allGenres.includes(g));
        console.log(`✅ Validated genres (exist in Spotify):`, mappedGenres);
        matchedGenres.push(...mappedGenres);
        if (matchedGenres.length >= 5) break;
      }
    }
    
    // If we still don't have enough genres, try direct matching
    if (matchedGenres.length < 5) {
      for (const genre of allGenres) {
        const genreLower = genre.toLowerCase();
        
        // Exact match or contains match
        if (promptWords.some(word => 
          word === genreLower || 
          genreLower.includes(word) || 
          word.includes(genreLower)
        )) {
          if (!matchedGenres.includes(genre)) {
            matchedGenres.push(genre);
          }
        }
        
        // Stop at 5 genres (Spotify's max for recommendations)
        if (matchedGenres.length >= 5) break;
      }
    }
    
    // If we STILL don't have enough genres, use fuzzy matching on each word
    if (matchedGenres.length < 5) {
      for (const word of promptWords) {
        // Skip very short words
        if (word.length < 3) continue;
        
        const similarGenres = findSimilarGenres(word, allGenres, 5 - matchedGenres.length);
        for (const genre of similarGenres) {
          if (!matchedGenres.includes(genre)) {
            matchedGenres.push(genre);
            console.log(`Fuzzy match: "${word}" → "${genre}"`);
          }
          if (matchedGenres.length >= 5) break;
        }
        if (matchedGenres.length >= 5) break;
      }
    }

    // If we found genre matches, use recommendations API
    if (matchedGenres.length > 0) {
      console.log(`✨ Found ${matchedGenres.length} genre matches for "${prompt}":`, matchedGenres);
      const genreParam = matchedGenres.slice(0, 5).join(',');
      const recommendResponse = await fetch(
        `https://api.spotify.com/v1/recommendations?seed_genres=${encodeURIComponent(genreParam)}&limit=${limit}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      if (recommendResponse.ok) {
        const data = await recommendResponse.json();
        const tracks = data.tracks || [];

        // Also search YouTube for each track using ISRC and caching
        const enrichedTracks = await Promise.all(
          tracks.map(async (track: any) => {
            const artist = track.artists.map((a: any) => a.name).join(', ');
            const title = track.name;
            const year = track.album?.release_date ? new Date(track.album.release_date).getFullYear() : undefined;
            const spotifyUrl = track.external_urls?.spotify;
            const spotifyId = track.id;
            const isrc = track.external_ids?.isrc;
            
            // Check cache first
            const cached = await checkSongCache(artist, title, spotifyId, isrc);
            if (cached) {
              console.log(`Cache hit for: ${artist} - ${title}`);
              return { ...cached, source: 'genre-match' as const };
            }
            
            // Not in cache, search YouTube with ISRC
            const query = `${artist} ${title}`;
            const youtubeResult = await searchYouTube(query, isrc);
            
            const song: Song = {
              title,
              artist,
              year,
              spotifyUrl,
              youtubeUrl: youtubeResult?.youtubeUrl,
              verified: true,
              source: 'genre-match',
            };
            
            // Save to cache
            await saveSongCache(
              title,
              artist,
              spotifyUrl,
              youtubeResult?.youtubeUrl,
              spotifyId,
              isrc,
              year
            );
            
            return song;
          })
        );

        console.log(`🎯 Returning ${enrichedTracks.length} tracks from GENRE MATCHING (${matchedGenres.join(', ')})`);
        return enrichedTracks;
      }
    }

    // Fallback: Use search API with genre-specific queries
    console.log(`🔎 No genre matches found for "${prompt}", using SEARCH FALLBACK`);
    
    // For genre-like searches, just use the raw prompt - Spotify will match it in track titles, artists, etc.
    const searchQuery = prompt;
    console.log(`🔍 Searching Spotify for: "${searchQuery}"`);
    
    const searchResponse = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=${limit}`,
      {
        headers: { 'Authorization': `Bearer ${token}` },
      }
    );

    if (searchResponse.ok) {
      const data = await searchResponse.json();
      const tracks = data.tracks?.items || [];
      console.log(`📦 Spotify search returned ${tracks.length} tracks`);
      
      // Also search YouTube for each track with ISRC and caching
      const enrichedTracks = await Promise.all(
        tracks.map(async (track: any) => {
          const artist = track.artists.map((a: any) => a.name).join(', ');
          const title = track.name;
          const year = track.album?.release_date ? new Date(track.album.release_date).getFullYear() : undefined;
          const spotifyUrl = track.external_urls?.spotify;
          const spotifyId = track.id;
          const isrc = track.external_ids?.isrc;
          
          // Check cache first
          const cached = await checkSongCache(artist, title, spotifyId, isrc);
          if (cached) {
            console.log(`Cache hit for: ${artist} - ${title}`);
            return { ...cached, source: 'search-fallback' as const };
          }
          
          // Not in cache, search YouTube with ISRC
          const query = `${artist} ${title}`;
          const youtubeResult = await searchYouTube(query, isrc);
          
          const song: Song = {
            title,
            artist,
            year,
            spotifyUrl,
            youtubeUrl: youtubeResult?.youtubeUrl,
            verified: true,
            source: 'search-fallback',
          };
          
          // Save to cache
          await saveSongCache(
            title,
            artist,
            spotifyUrl,
            youtubeResult?.youtubeUrl,
            spotifyId,
            isrc,
            year
          );
          
          return song;
        })
      );
      
      console.log(`🔍 Returning ${enrichedTracks.length} tracks from SEARCH FALLBACK`);
      return enrichedTracks;
    }

    return [];
  } catch (error) {
    console.error('Spotify recommendations error:', error);
    return [];
  }
}

/**
 * Search Spotify for a song and return with ISRC
 */
export async function searchSpotify(query: string): Promise<(Song & { isrc?: string; spotifyId?: string }) | null> {
  try {
    // Get Spotify access token (client credentials flow)
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString('base64'),
      },
      body: 'grant_type=client_credentials',
    });

    if (!tokenResponse.ok) {
      console.error('Spotify token error:', await tokenResponse.text());
      return null;
    }

    const { access_token } = await tokenResponse.json();

    // Search for the track
    const searchResponse = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${access_token}`,
        },
      }
    );

    if (!searchResponse.ok) {
      console.error('Spotify search error:', await searchResponse.text());
      return null;
    }

    const data = await searchResponse.json();
    const track = data.tracks?.items?.[0];

    if (!track) return null;

    return {
      title: track.name,
      artist: track.artists.map((a: any) => a.name).join(', '),
      year: track.album?.release_date ? new Date(track.album.release_date).getFullYear() : undefined,
      spotifyUrl: track.external_urls?.spotify,
      spotifyId: track.id,
      isrc: track.external_ids?.isrc, // ← This is the key for accurate YouTube search!
      verified: true,
    };
  } catch (error) {
    console.error('Spotify search error:', error);
    return null;
  }
}

/**
 * Search YouTube for a song using ISRC or query
 */
export async function searchYouTube(query: string, isrc?: string): Promise<Song | null> {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      console.error('YouTube API key not configured');
      return null;
    }

    // Don't use ISRC search - it's not reliable on YouTube
    // Instead, use exact match with official audio filter
    const searchQuery = `${query} official audio`;
    console.log(`Searching YouTube for: ${searchQuery}`);

    const searchResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchQuery)}&type=video&videoCategoryId=10&maxResults=1&key=${apiKey}`
    );

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('YouTube search error:', errorText);
      return null;
    }

    const data = await searchResponse.json();
    
    // Check for API errors (like quota exceeded)
    if (data.error) {
      console.error('YouTube search error:', data.error);
      return null;
    }
    
    const video = data.items?.[0];

    if (!video) {
      return null;
    }

    // Parse title to extract artist and song (common YouTube format: "Artist - Song")
    const title = video.snippet.title;
    const parts = title.split(' - ');
    
    return {
      title: parts.length > 1 ? parts[1].trim() : title,
      artist: parts.length > 1 ? parts[0].trim() : video.snippet.channelTitle,
      youtubeUrl: `https://www.youtube.com/watch?v=${video.id.videoId}`,
      verified: true,
    };
  } catch (error) {
    console.error('YouTube search error:', error);
    return null;
  }
}

/**
 * Search both Spotify and YouTube for a song with caching
 */
export async function searchBoth(title: string, artist: string): Promise<Song> {
  const query = `${artist} ${title}`;
  
  // Check cache first
  const cached = await checkSongCache(artist, title);
  if (cached) {
    console.log(`Cache hit for: ${artist} - ${title}`);
    return cached;
  }
  
  console.log(`Cache miss for: ${artist} - ${title}, searching APIs...`);
  
  // Search Spotify first to get ISRC and metadata
  const spotifyResult = await searchSpotify(query);
  
  let youtubeResult: Song | null = null;
  
  // If we have Spotify result with ISRC, use it for YouTube search
  if (spotifyResult) {
    // Extract Spotify ID and ISRC from the full track object
    // We need to modify searchSpotify to return these
    const spotifyId = spotifyResult.spotifyUrl?.split('/track/')[1];
    const isrc = (spotifyResult as any).isrc; // Will add this to searchSpotify
    
    if (isrc) {
      youtubeResult = await searchYouTube(query, isrc);
    } else {
      youtubeResult = await searchYouTube(query);
    }
  } else {
    // No Spotify result, search YouTube with query only
    youtubeResult = await searchYouTube(query);
  }

  // Merge results, preferring Spotify data
  const merged: Song = {
    title: spotifyResult?.title || youtubeResult?.title || title,
    artist: spotifyResult?.artist || youtubeResult?.artist || artist,
    year: spotifyResult?.year,
    spotifyUrl: spotifyResult?.spotifyUrl,
    youtubeUrl: youtubeResult?.youtubeUrl,
    verified: !!(spotifyResult || youtubeResult),
  };
  
  // Save to cache for next time
  if (merged.verified) {
    const spotifyId = merged.spotifyUrl?.split('/track/')[1];
    const isrc = (spotifyResult as any)?.isrc;
    
    await saveSongCache(
      merged.title,
      merged.artist,
      merged.spotifyUrl,
      merged.youtubeUrl,
      spotifyId,
      isrc,
      merged.year
    );
  }

  return merged;
}

/**
 * Verify and enrich a list of AI-generated songs
 */
export async function verifySongs(songs: Array<{ title: string; artist: string; genre?: string; mood?: string; year?: number }>): Promise<Song[]> {
  // Process all songs in parallel for much faster results
  const verificationPromises = songs.map(async (song) => {
    try {
      const verified = await searchBoth(song.title, song.artist);
      return {
        ...verified,
        genre: song.genre,
        mood: song.mood,
        year: verified.year || song.year,
      };
    } catch (error) {
      console.error(`Error verifying song: ${song.artist} - ${song.title}`, error);
      // Include unverified song as fallback
      return {
        ...song,
        verified: false,
      };
    }
  });

  // Wait for all searches to complete in parallel
  const verifiedSongs = await Promise.all(verificationPromises);
  return verifiedSongs;
}

