/**
 * MusicBrainz + AcousticBrainz API client
 * Free, unlimited music metadata and audio features
 */

const MB_BASE = 'https://musicbrainz.org/ws/2';
const AB_BASE = 'https://acousticbrainz.org/api/v1';

// Rate limiting: MusicBrainz requires 1 request/second
let lastRequest = 0;
const MIN_INTERVAL = 1000;

async function rateLimitedFetch(url: string, options?: RequestInit) {
  const now = Date.now();
  const wait = Math.max(0, MIN_INTERVAL - (now - lastRequest));
  if (wait > 0) {
    await new Promise(resolve => setTimeout(resolve, wait));
  }
  lastRequest = Date.now();
  
  const headers = {
    'User-Agent': 'Mediasite/1.0 (https://mediasite.com)',
    'Accept': 'application/json',
    ...options?.headers,
  };
  
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    throw new Error(`MusicBrainz API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export interface MBTrack {
  id: string; // MBID
  title: string;
  artist: string;
  isrc?: string;
  length?: number; // milliseconds
  tags?: string[];
}

export interface AudioFeatures {
  bpm?: number;
  key?: string;
  energy?: number;
  danceability?: number;
  valence?: number;
  acousticness?: number;
  instrumentalness?: number;
}

/**
 * Search MusicBrainz for recordings by query
 */
export async function searchRecordings(
  query: string,
  limit = 25
): Promise<MBTrack[]> {
  const params = new URLSearchParams({
    query,
    fmt: 'json',
    limit: String(limit),
  });
  
  const url = `${MB_BASE}/recording?${params}`;
  const data = await rateLimitedFetch(url);
  
  return (data.recordings || []).map((rec: any) => ({
    id: rec.id,
    title: rec.title,
    artist: rec['artist-credit']?.[0]?.name || 'Unknown Artist',
    isrc: rec.isrcs?.[0],
    length: rec.length,
    tags: rec.tags?.map((t: any) => t.name) || [],
  }));
}

/**
 * Search by tag/genre (e.g., "rock", "chill", "summer")
 */
export async function searchByTag(
  tag: string,
  limit = 25
): Promise<MBTrack[]> {
  const params = new URLSearchParams({
    query: `tag:${tag}`,
    fmt: 'json',
    limit: String(limit),
  });
  
  const url = `${MB_BASE}/recording?${params}`;
  const data = await rateLimitedFetch(url);
  
  return (data.recordings || []).map((rec: any) => ({
    id: rec.id,
    title: rec.title,
    artist: rec['artist-credit']?.[0]?.name || 'Unknown Artist',
    isrc: rec.isrcs?.[0],
    length: rec.length,
    tags: rec.tags?.map((t: any) => t.name) || [],
  }));
}

/**
 * Fetch audio features from AcousticBrainz
 */
export async function getAudioFeatures(mbid: string): Promise<AudioFeatures | null> {
  try {
    const url = `${AB_BASE}/${mbid}/low-level`;
    // AcousticBrainz doesn't require rate limiting
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mediasite/1.0',
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      // Not all MBIDs have audio features - this is normal
      return null;
    }
    
    const data = await response.json();
    
    // Extract features from AcousticBrainz low-level data
    const rhythm = data.rhythm;
    const tonal = data.tonal;
    
    return {
      bpm: rhythm?.bpm,
      key: tonal?.key_key,
      energy: rhythm?.beats_loudness?.mean, // proxy for energy
      danceability: rhythm?.danceability,
      // AcousticBrainz doesn't have valence/acousticness directly
      // We can compute proxies or leave undefined
    };
  } catch (error) {
    // AcousticBrainz is best-effort; return null if unavailable
    return null;
  }
}

/**
 * Get popular recordings by genre with audio features
 */
export async function getPopularByGenre(
  genre: string,
  limit = 100
): Promise<Array<MBTrack & { features?: AudioFeatures }>> {
  const tracks = await searchByTag(genre, limit);
  
  // Fetch audio features for each (in parallel batches to respect rate limits)
  const BATCH_SIZE = 10;
  const results: Array<MBTrack & { features?: AudioFeatures }> = [];
  
  for (let i = 0; i < tracks.length; i += BATCH_SIZE) {
    const batch = tracks.slice(i, i + BATCH_SIZE);
    const withFeatures = await Promise.all(
      batch.map(async (track) => {
        const features = await getAudioFeatures(track.id);
        return { ...track, features: features || undefined };
      })
    );
    results.push(...withFeatures);
    
    // Progress indicator
    if (typeof process !== 'undefined' && process.stdout) {
      process.stdout.write(`\rFetched ${results.length}/${tracks.length} tracks...`);
    }
  }
  
  if (typeof process !== 'undefined' && process.stdout) {
    process.stdout.write('\n');
  }
  
  return results;
}

/**
 * Map MusicBrainz key to pitch class notation
 */
export function normalizeMBKey(mbKey?: string): string | undefined {
  if (!mbKey) return undefined;
  
  const keyMap: Record<string, string> = {
    'C': 'C', 'C#': 'C#', 'Db': 'C#',
    'D': 'D', 'D#': 'D#', 'Eb': 'D#',
    'E': 'E',
    'F': 'F', 'F#': 'F#', 'Gb': 'F#',
    'G': 'G', 'G#': 'G#', 'Ab': 'G#',
    'A': 'A', 'A#': 'A#', 'Bb': 'A#',
    'B': 'B',
  };
  
  return keyMap[mbKey] || mbKey;
}
