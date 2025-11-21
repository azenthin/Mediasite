/**
 * Regional Music Recommendations
 * Provides locale-aware music suggestions with regional bias
 * 
 * Strategy: 
 * - Detect user's locale from browser/profile
 * - Weight regional artists/tracks higher in search results
 * - Preserve global diversity (don't exclude non-regional music)
 * - Allow explicit regional filtering for discovery
 */

// Spotify country codes + friendly names
export const REGION_MAP = {
  'NO': { name: 'Norway', label: 'Norsk' },
  'SE': { name: 'Sweden', label: 'Svenska' },
  'DK': { name: 'Denmark', label: 'Dansk' },
  'FI': { name: 'Finland', label: 'Suomi' },
  'US': { name: 'United States', label: 'English' },
  'GB': { name: 'United Kingdom', label: 'English' },
  'DE': { name: 'Germany', label: 'Deutsch' },
  'FR': { name: 'France', label: 'Français' },
  'ES': { name: 'Spain', label: 'Español' },
  'IT': { name: 'Italy', label: 'Italiano' },
  'JP': { name: 'Japan', label: '日本語' },
  'KR': { name: 'South Korea', label: '한국어' },
  'BR': { name: 'Brazil', label: 'Português' },
  'MX': { name: 'Mexico', label: 'Español' },
  'AU': { name: 'Australia', label: 'English' },
  'NZ': { name: 'New Zealand', label: 'English' },
  'IN': { name: 'India', label: 'हिन्दी' },
  'ID': { name: 'Indonesia', label: 'Bahasa Indonesia' },
  'TH': { name: 'Thailand', label: 'ไทย' },
  'SG': { name: 'Singapore', label: '英文' },
  'PH': { name: 'Philippines', label: 'Tagalog' },
  'VN': { name: 'Vietnam', label: 'Tiếng Việt' },
  'CN': { name: 'China', label: '中文' },
  'TW': { name: 'Taiwan', label: '繁體中文' },
  'SA': { name: 'Saudi Arabia', label: 'العربية' },
  'AE': { name: 'United Arab Emirates', label: 'العربية' },
  'IL': { name: 'Israel', label: 'עברית' },
  'ZA': { name: 'South Africa', label: 'English' },
  'NG': { name: 'Nigeria', label: 'English' },
  'AR': { name: 'Argentina', label: 'Español' },
  'CL': { name: 'Chile', label: 'Español' },
  'CO': { name: 'Colombia', label: 'Español' },
  'PE': { name: 'Peru', label: 'Español' },
} as const;

// Regional artist collections (updated during collection phase)
// These will be populated after we analyze the 1M songs dataset
export const REGIONAL_ARTISTS: Record<string, string[]> = {
  'NO': [], // Norwegian artists
  'SE': [], // Swedish artists
  'DK': [], // Danish artists
  'FI': [], // Finnish artists
  'DE': [], // German artists
  'FR': [], // French artists
  'ES': [], // Spanish artists
  'IT': [], // Italian artists
  'JP': [], // Japanese artists
  'KR': [], // Korean artists
  'BR': [], // Brazilian artists
  'US': [], // American artists
  // ... populated dynamically
};

/**
 * Detect user's region from various sources
 * Priority: User profile > Browser locale > GeoIP
 */
export function detectUserRegion(req?: any): string | null {
  // 1. User profile preference (set in /api/profile)
  if (req?.user?.region) {
    return req.user.region.toUpperCase();
  }

  // 2. Browser Accept-Language header
  const acceptLanguage = req?.headers?.['accept-language'] || '';
  const primaryLang = acceptLanguage.split(',')[0]?.split('-')[1]?.toUpperCase();
  if (primaryLang && REGION_MAP[primaryLang as keyof typeof REGION_MAP]) {
    return primaryLang;
  }

  // 3. Browser language preference (stored in session)
  if (req?.session?.region) {
    return req.session.region.toUpperCase();
  }

  return null;
}

/**
 * Build regional search query that weights regional content
 * 
 * Example for Norway:
 * - Include Norwegian artists, bands, genres popular in Norway
 * - Also include global hits and universally popular music
 * - Result: Playlist has ~30-40% Norwegian content, rest is global
 */
export function buildRegionalSearchQuery(
  baseQuery: string,
  userRegion?: string | null
): { query: string; regionalBias: boolean } {
  if (!userRegion || !REGION_MAP[userRegion as keyof typeof REGION_MAP]) {
    return { query: baseQuery, regionalBias: false };
  }

  const regionName = REGION_MAP[userRegion as keyof typeof REGION_MAP].name;

  // Add region context to the search
  // Example: "rock playlist" becomes "Norwegian rock artists" OR "rock playlist"
  const regionalQuery = `(${regionName} artists OR ${baseQuery}) AND ${baseQuery}`;

  return {
    query: regionalQuery,
    regionalBias: true,
  };
}

/**
 * Filter songs by region preference
 * 
 * Strategy:
 * 1. First try to get songs with regional artist matches
 * 2. If insufficient, blend in global popular tracks
 * 3. Preserve diversity - don't over-weight one region
 */
export function applyRegionalFilter(
  songs: any[],
  userRegion: string | null,
  regionalPercentage: number = 35 // 35% regional, 65% global
): any[] {
  if (!userRegion || songs.length === 0) {
    return songs;
  }

  const regionArtists = REGIONAL_ARTISTS[userRegion] || [];
  if (regionArtists.length === 0) {
    // No regional data yet, return as-is
    return songs;
  }

  // Separate regional and global songs
  const regionalSongs = songs.filter(song =>
    regionArtists.some(artist =>
      song.artist?.toLowerCase().includes(artist.toLowerCase())
    )
  );

  const globalSongs = songs.filter(song =>
    !regionArtists.some(artist =>
      song.artist?.toLowerCase().includes(artist.toLowerCase())
    )
  );

  // Calculate target counts
  const targetRegional = Math.ceil(songs.length * (regionalPercentage / 100));
  const targetGlobal = songs.length - targetRegional;

  // Blend: prioritize regional, then fill with global
  const result = [
    ...regionalSongs.slice(0, targetRegional),
    ...globalSongs.slice(0, targetGlobal),
  ];

  return result.slice(0, songs.length);
}

/**
 * Get regional recommendations for user
 * 
 * Example: User from Norway requesting "rock playlist"
 * Returns: Norwegian rock bands (Turbonegro, Black Metal Scene) +
 *          International rock classics (Led Zeppelin, etc)
 */
export function getRegionalRecommendationContext(userRegion: string | null) {
  if (!userRegion) {
    return {
      region: null,
      bias: 'global',
      description: 'Global recommendations - no regional preference',
      examples: [],
    };
  }

  const region = REGION_MAP[userRegion as keyof typeof REGION_MAP];
  if (!region) {
    return {
      region: null,
      bias: 'global',
      description: 'Unknown region - using global recommendations',
      examples: [],
    };
  }

  const regionalArtists = REGIONAL_ARTISTS[userRegion] || [];

  return {
    region: userRegion,
    regionName: region.name,
    bias: 'regional-plus-global',
    description: `Showing ${region.name} artists + global hits (35% regional bias)`,
    regionalArtistCount: regionalArtists.length,
    exampleArtists: regionalArtists.slice(0, 5),
  };
}

/**
 * Build regional filter for SQL query
 * Returns SQL WHERE clause that matches regional artists
 */
export function buildRegionalSQLFilter(userRegion: string | null): string {
  if (!userRegion) {
    return '1=1'; // No filter
  }

  const regionName = REGION_MAP[userRegion as keyof typeof REGION_MAP]?.name;
  if (!regionName) {
    return '1=1';
  }

  // This would need to be populated with real artist data
  // For now, return generic regional query filter
  return `(
    "primaryGenre" ILIKE '%${regionName}%' OR
    genres ILIKE '%${regionName}%' OR
    artist ILIKE '%${regionName}%'
  )`;
}

/**
 * Track regional preference in user session
 */
export function setRegionalPreference(userId: string, region: string): void {
  // Store in User model (requires schema update)
  // Temporary: Store in session
  // Permanent: Add 'preferredRegion' field to User schema
  console.log(`📍 Set regional preference for user ${userId}: ${region}`);
}

/**
 * Get user's regional preference
 */
export function getRegionalPreference(user: any): string | null {
  return user?.preferredRegion || null;
}

/**
 * Analyze songs dataset to extract top regional artists
 * Run after 1M song collection to populate REGIONAL_ARTISTS
 */
export async function analyzeRegionalArtists(tracks: any[]): Promise<Record<string, string[]>> {
  const regionalArtistMap: Record<string, Set<string>> = {};

  // Initialize with empty sets
  Object.keys(REGION_MAP).forEach(region => {
    regionalArtistMap[region] = new Set();
  });

  // Map regional searches from the collection to artist names
  const regionSearchMap: Record<string, string[]> = {
    'NO': ['norwegian', 'norway', 'norsk'],
    'SE': ['swedish', 'sweden', 'sverige'],
    'DK': ['danish', 'denmark', 'danmark'],
    'FI': ['finnish', 'finland', 'suomi'],
    'DE': ['german', 'germany', 'deutsch'],
    'FR': ['french', 'france', 'français'],
    'ES': ['spanish', 'spain', 'españa'],
    'IT': ['italian', 'italy', 'italia'],
    'JP': ['japanese', 'japan', 'j-pop', 'j-rock'],
    'KR': ['korean', 'korea', 'k-pop', 'kpop'],
    'BR': ['brazilian', 'brazil', 'brasil', 'bossa nova'],
    'US': ['american', 'usa', 'united states'],
    'GB': ['british', 'uk', 'united kingdom'],
    'AU': ['australian', 'australia'],
    // Add more as needed
  };

  // This is a simplified version - in production you'd:
  // 1. Check track metadata for artist origin
  // 2. Query Spotify API for artist region
  // 3. Use music databases for historical artist origins
  // For now, just track patterns from our search queries

  console.log('📊 Regional artist analysis would be populated from:');
  console.log('  1. Spotify artist profiles (market presence)');
  console.log('  2. Collection search results (regional playlists)');
  console.log('  3. Genre classifications (regional music styles)');

  return Object.fromEntries(
    Object.entries(regionalArtistMap).map(([region, artists]) => [
      region,
      Array.from(artists),
    ])
  );
}
