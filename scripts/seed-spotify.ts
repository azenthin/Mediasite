#!/usr/bin/env ts-node
/**
 * Populate audio_features.db using Spotify public charts.
 *
 * DISABLED: This script requires sqlite3 and sqlite packages which have been removed
 * to maintain Next.js compatibility. These are not needed for the API.
 */

console.log('❌ seed-spotify.ts is disabled - sqlite3 packages removed for Next.js compatibility');
process.exit(0);

const DB_PATH = './audio_features.db';
const USER_AGENT = 'mediasite-audio-seeder/1.0 (+https://github.com/user)';

// Regions to pull charts from (covers a broad mix of genres)
const CHART_REGIONS = [
  'global', 'us', 'gb', 'de', 'fr', 'es', 'it', 'nl', 'se', 'no', 'fi', 'dk',
  'au', 'nz', 'ca', 'br', 'mx', 'ar', 'cl', 'co', 'pe', 'uy', 'py', 'jp', 'kr',
  'in', 'th', 'sg', 'ph', 'id', 'my', 'vn', 'za'
];

interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ id: string; name: string }>;
  duration_ms: number;
  popularity: number;
  album: string;
  releaseDate: string;
  isrc?: string;
}

interface AudioFeatures {
  id: string;
  tempo: number;
  key: number;
  mode: number;
  energy: number;
  danceability: number;
  valence: number;
  acousticness: number;
  instrumentalness: number;
  liveness: number;
  loudness: number;
  speechiness: number;
  time_signature: number;
}

interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
}

async function openDB(): Promise<Database> {
  const db = await open({ filename: DB_PATH, driver: sqlite3.Database });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS features (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT,
      title TEXT,
      artist TEXT,
      spotify_id TEXT UNIQUE,
      isrc TEXT,
      duration REAL,
      bpm REAL,
      key TEXT,
      energy REAL,
      danceability REAL,
      valence REAL,
      acousticness REAL,
      rhythm_strength REAL,
      spectral_centroid REAL,
      tags TEXT,
      processed_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  return db;
}

async function getSpotifyToken(): Promise<string> {
  let clientId = process.env.SPOTIFY_CLIENT_ID;
  let clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set in .env');
  }

  if (clientId.startsWith('"')) clientId = clientId.slice(1, -1);
  if (clientSecret.startsWith('"')) clientSecret = clientSecret.slice(1, -1);

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get Spotify token: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function fetchChartTrackIds(region: string): Promise<string[]> {
  const url = `https://spotifycharts.com/regional/${region}/daily/latest/download`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/csv,application/octet-stream',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download chart for ${region}: ${response.status}`);
  }

  if (response.url !== url) {
    console.log(`   ↪ ${region} redirected to ${response.url}`);
  }

  const csvText = await response.text();
  if (!csvText.trim()) {
    console.warn(`   ⚠️  Empty chart response for ${region}`);
  }
  if (csvText.startsWith('<') || csvText.startsWith('{')) {
    console.warn(`   ⚠️  Non-CSV content for ${region}:`, csvText.slice(0, 120).replace(/\s+/g, ' '));
  }
  const ids: string[] = [];

  for (const rawLine of csvText.split('\n')) {
    const line = rawLine.trim();
    if (!line || !line.startsWith('"')) continue;
    if (line.startsWith('"Position"')) continue;
    if (line.startsWith('"Region"')) continue;

    const stripped = line.slice(1, -1);
    const parts = stripped.split('","');
    if (parts.length < 4) continue;

    const urlPart = parts[3];
    const match = urlPart.match(/track\/([A-Za-z0-9]+)/);
    if (match) {
      ids.push(match[1]);
    }
  }

  return ids;
}

async function getTracks(token: string, trackIds: string[]): Promise<Map<string, SpotifyTrack>> {
  const chunks: string[][] = [];
  for (let i = 0; i < trackIds.length; i += 50) {
    chunks.push(trackIds.slice(i, i + 50));
  }

  const map = new Map<string, SpotifyTrack>();

  for (const chunk of chunks) {
    const response = await fetch(`https://api.spotify.com/v1/tracks?ids=${chunk.join(',')}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to fetch tracks: ${response.status} ${text}`);
    }

    const data = await response.json();
    const items = data?.tracks ?? [];

    for (const item of items) {
      if (!item) continue;
      map.set(item.id, {
        id: item.id,
        name: item.name,
        artists: (item.artists || []).map((a: any) => ({ id: a.id, name: a.name })),
        duration_ms: item.duration_ms || 0,
        popularity: item.popularity || 0,
        album: item.album?.name || '',
        releaseDate: item.album?.release_date || '',
        isrc: item.external_ids?.isrc,
      });
    }

    await new Promise(resolve => setTimeout(resolve, 50));
  }

  return map;
}

async function getArtists(token: string, artistIds: string[]): Promise<Map<string, SpotifyArtist>> {
  const unique = Array.from(new Set(artistIds));
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 50) {
    chunks.push(unique.slice(i, i + 50));
  }

  const map = new Map<string, SpotifyArtist>();

  for (const chunk of chunks) {
    const response = await fetch(`https://api.spotify.com/v1/artists?ids=${chunk.join(',')}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to fetch artists: ${response.status} ${text}`);
    }

    const data = await response.json();
    const items = data?.artists ?? [];

    for (const item of items) {
      if (!item) continue;
      map.set(item.id, {
        id: item.id,
        name: item.name,
        genres: item.genres || [],
      });
    }

    await new Promise(resolve => setTimeout(resolve, 50));
  }

  return map;
}

async function getAudioFeatures(token: string, trackIds: string[]): Promise<Map<string, AudioFeatures>> {
  const chunks: string[][] = [];
  for (let i = 0; i < trackIds.length; i += 100) {
    chunks.push(trackIds.slice(i, i + 100));
  }

  const map = new Map<string, AudioFeatures>();

  for (const chunk of chunks) {
    const response = await fetch(`https://api.spotify.com/v1/audio-features?ids=${chunk.join(',')}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to fetch audio features: ${response.status} ${text}`);
    }

    const data = await response.json();
    for (const item of data?.audio_features ?? []) {
      if (!item) continue;
      map.set(item.id, item as AudioFeatures);
    }

    await new Promise(resolve => setTimeout(resolve, 50));
  }

  return map;
}

const KEY_MAP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function keyNotation(key: number, mode: number): string {
  const note = KEY_MAP[key] || 'C';
  return mode === 1 ? note : `${note}m`;
}

function formatTags(regions: Set<string>, genres: string[]): string {
  const tags = new Set<string>();
  for (const region of regions) {
    tags.add(`chart:${region}`);
  }
  for (const genre of genres.slice(0, 3)) {
    tags.add(genre.toLowerCase().replace(/\s+/g, '-'));
  }
  return Array.from(tags).join(',');
}

async function insertTracks(
  db: Database,
  tracks: Map<string, SpotifyTrack>,
  features: Map<string, AudioFeatures>,
  artists: Map<string, SpotifyArtist>,
  regionMap: Map<string, Set<string>>
): Promise<number> {
  let inserted = 0;

  for (const [trackId, track] of tracks) {
    const feat = features.get(trackId);
    if (!feat) continue;

    const primaryArtist = track.artists[0];
    const artistGenres = primaryArtist ? artists.get(primaryArtist.id)?.genres ?? [] : [];
    const tagString = formatTags(regionMap.get(trackId) ?? new Set(), artistGenres);

    try {
      await db.run(
        `INSERT OR IGNORE INTO features
        (filename, title, artist, spotify_id, isrc, duration, bpm, key, energy, danceability, valence, acousticness, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `spotify://${track.id}`,
          track.name,
          track.artists.map(a => a.name).join(', '),
          track.id,
          track.isrc ?? null,
          track.duration_ms / 1000,
          Math.round(feat.tempo ?? 0),
          keyNotation(feat.key ?? 0, feat.mode ?? 1),
          feat.energy ?? null,
          feat.danceability ?? null,
          feat.valence ?? null,
          feat.acousticness ?? null,
          tagString,
        ],
      );
      inserted++;
    } catch (error) {
      // Ignore duplicates
    }
  }

  return inserted;
}

async function main() {
  const args = process.argv.slice(2);
  let targetLimit = 1000;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--limit' && args[i + 1]) {
      targetLimit = parseInt(args[++i], 10);
    } else if (!arg.startsWith('-')) {
      targetLimit = parseInt(arg, 10);
    }
  }

  console.log('🎵 Spotify Chart Seeder');
  console.log(`   Target tracks: ${targetLimit}`);
  console.log(`   Regions: ${CHART_REGIONS.length}`);

  const db = await openDB();
  const token = await getSpotifyToken();
  console.log('✅ Spotify token acquired\n');

  const regionMap = new Map<string, Set<string>>();

  for (const region of CHART_REGIONS) {
    try {
      const ids = await fetchChartTrackIds(region);
      console.log(`   ${region.padEnd(4)} → ${ids.length} tracks`);
      for (const id of ids) {
        if (!regionMap.has(id)) {
          regionMap.set(id, new Set());
        }
        regionMap.get(id)!.add(region);
      }
    } catch (error: any) {
      console.warn(`   ⚠️  Failed to fetch region ${region}: ${error.message}`);
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const allTrackIds = Array.from(regionMap.keys());
  console.log(`\n📈 Unique tracks collected: ${allTrackIds.length}`);

  const limitedTrackIds = targetLimit > 0 ? allTrackIds.slice(0, targetLimit) : allTrackIds;

  if (limitedTrackIds.length === 0) {
    console.log('No tracks to process. Exiting.');
    await db.close();
    return;
  }

  console.log('🎧 Fetching track metadata...');
  const tracks = await getTracks(token, limitedTrackIds);
  console.log(`   Retrieved metadata for ${tracks.size} tracks`);

  const artistIds: string[] = [];
  for (const track of tracks.values()) {
    for (const artist of track.artists) {
      if (artist?.id) artistIds.push(artist.id);
    }
  }

  console.log('🎤 Fetching artist genres...');
  const artistMap = await getArtists(token, artistIds);
  console.log(`   Retrieved ${artistMap.size} artist profiles`);

  console.log('🎚️  Fetching audio features...');
  const featureMap = await getAudioFeatures(token, Array.from(tracks.keys()));
  console.log(`   Retrieved audio features for ${featureMap.size} tracks`);

  console.log('💾 Inserting into SQLite...');
  const inserted = await insertTracks(db, tracks, featureMap, artistMap, regionMap);

  const total = await db.get('SELECT COUNT(*) as count FROM features');

  console.log('\n✨ Done!');
  console.log(`   Inserted now: ${inserted}`);
  console.log(`   Total rows: ${total.count}`);

  await db.close();
}

main().catch(err => {
  console.error('Seeder failed:', err);
  process.exitCode = 1;
});
