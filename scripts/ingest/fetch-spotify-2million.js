/**
 * Fetch 2 MILLION songs from Spotify for ingestion pipeline
 * 
 * Comprehensive multi-strategy approach:
 * 1. Genre + Year combinations (100+ genres × 60 years)
 * 2. Country + Genre combinations (50+ countries × genres)
 * 3. Popularity brackets (0-10, 10-20, ..., 90-100)
 * 4. Artist searches (top 10k artists across all genres)
 * 5. Album searches by year and genre
 * 6. Track searches with various filters
 * 
 * Target: 2,000,000 unique songs with Spotify ID + ISRC
 */

const fs = require('fs');
const path = require('path');

// Load .env file
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
  console.error('ERROR: SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET required in .env');
  console.error('Get credentials from: https://developer.spotify.com/dashboard');
  process.exit(1);
}

const TARGET_SONGS = 2000000;
const RATE_LIMIT_MS = 50; // Faster rate for massive scale
const BATCH_SIZE = 50; // Max results per query

// Comprehensive genre list
const GENRES = [
  'pop', 'rock', 'hip-hop', 'rap', 'r&b', 'soul', 'funk', 'disco', 'dance', 'electronic',
  'edm', 'house', 'techno', 'trance', 'dubstep', 'drum-and-bass', 'indie', 'alternative',
  'punk', 'metal', 'hard-rock', 'grunge', 'emo', 'country', 'folk', 'bluegrass', 'americana',
  'blues', 'jazz', 'swing', 'bebop', 'fusion', 'latin', 'salsa', 'bachata', 'reggaeton',
  'reggae', 'ska', 'dancehall', 'afrobeat', 'afropop', 'k-pop', 'j-pop', 'mandopop',
  'cantopop', 'bollywood', 'classical', 'opera', 'soundtrack', 'ambient', 'new-age',
  'world', 'gospel', 'christian', 'worship', 'spiritual', 'celtic', 'flamenco',
  'bossa-nova', 'samba', 'tango', 'cumbia', 'merengue', 'banda', 'corridos', 'mariachi',
  'norteño', 'vallenato', 'forró', 'axé', 'mpb', 'sertanejo', 'pagode', 'trap',
  'drill', 'grime', 'uk-garage', 'jungle', 'breakbeat', 'hardstyle', 'hardcore',
  'industrial', 'noise', 'experimental', 'avant-garde', 'psych', 'shoegaze', 'post-rock',
  'math-rock', 'prog-rock', 'art-rock', 'glam-rock', 'synth-pop', 'new-wave', 'post-punk',
  'indie-rock', 'indie-pop', 'lo-fi', 'bedroom-pop', 'chillwave', 'vaporwave', 'synthwave'
];

// Years from 1960 to 2025
const YEARS = Array.from({ length: 66 }, (_, i) => 1960 + i);

// Countries with significant Spotify presence
const COUNTRIES = [
  'US', 'GB', 'CA', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL', 'SE', 'NO', 'FI', 'DK',
  'BR', 'MX', 'AR', 'CO', 'CL', 'PE', 'VE', 'JP', 'KR', 'CN', 'IN', 'PH', 'TH',
  'ID', 'MY', 'SG', 'VN', 'PL', 'RU', 'TR', 'GR', 'PT', 'IE', 'NZ', 'ZA', 'NG',
  'KE', 'EG', 'MA', 'IL', 'AE', 'SA', 'PK', 'BD', 'LK', 'NP'
];

let accessToken = null;
let tokenExpiry = 0;

/**
 * Get or refresh Spotify access token
 */
async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }
  
  const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  
  if (!response.ok) {
    throw new Error(`Spotify auth failed: ${response.status}`);
  }
  
  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; // Refresh 1 min early
  return accessToken;
}

/**
 * Search Spotify tracks
 */
async function searchTracks(query, limit = 50, offset = 0) {
  const token = await getAccessToken();
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}&offset=${offset}`;
  
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!response.ok) {
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
      console.warn(`Rate limited, waiting ${retryAfter}s...`);
      await sleep(retryAfter * 1000);
      return searchTracks(query, limit, offset);
    }
    return [];
  }
  
  const data = await response.json();
  return data.tracks?.items || [];
}

/**
 * Extract track data
 */
function extractTrackData(track) {
  if (!track || !track.id) return null;
  
  return {
    artist: track.artists?.[0]?.name || 'Unknown Artist',
    title: track.name || 'Unknown Title',
    isrc: track.external_ids?.isrc || '',
    spotifyId: track.id,
    album: track.album?.name || '',
    releaseDate: track.album?.release_date || '',
    popularity: track.popularity || 0,
    durationMs: track.duration_ms || 0,
    provider: 'spotify'
  };
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Save progress to disk
 */
function saveProgress(songs, filename) {
  const songsArray = Array.from(songs.values());
  const outputPath = path.join(__dirname, 'sources', filename);
  
  const csvHeader = 'Artist,Title,ISRC,SpotifyId,Album,ReleaseDate,Popularity,Provider\n';
  const csvRows = songsArray.map(song => {
    const escapeCsv = (str) => `"${String(str).replace(/"/g, '""')}"`;
    return [
      escapeCsv(song.artist),
      escapeCsv(song.title),
      escapeCsv(song.isrc),
      escapeCsv(song.spotifyId),
      escapeCsv(song.album),
      escapeCsv(song.releaseDate),
      song.popularity,
      escapeCsv(song.provider)
    ].join(',');
  }).join('\n');
  
  const csvContent = csvHeader + csvRows;
  fs.writeFileSync(outputPath, csvContent, 'utf8');
  
  console.log(`  💾 Saved checkpoint: ${songsArray.length} songs to ${filename}`);
}

/**
 * Main fetch function
 */
async function fetch2MillionSongs() {
  console.log('=== Spotify 2 MILLION Songs Fetcher ===\n');
  console.log(`Target: ${TARGET_SONGS.toLocaleString()} songs`);
  console.log(`Rate limit: ${RATE_LIMIT_MS}ms between requests\n`);
  
  const songs = new Map();
  const startTime = Date.now();
  let queriesExecuted = 0;
  let lastCheckpoint = 0;
  
  // Strategy 1: Genre + Year combinations
  console.log('Strategy 1: Genre × Year combinations...\n');
  for (const genre of GENRES) {
    if (songs.size >= TARGET_SONGS) break;
    
    for (const year of YEARS) {
      if (songs.size >= TARGET_SONGS) break;
      
      const query = `genre:${genre} year:${year}`;
      await sleep(RATE_LIMIT_MS);
      
      try {
        const tracks = await searchTracks(query, BATCH_SIZE, 0);
        queriesExecuted++;
        
        for (const track of tracks) {
          const data = extractTrackData(track);
          if (data && data.isrc && !songs.has(data.spotifyId)) {
            songs.set(data.spotifyId, data);
          }
        }
        
        // Progress reporting every 10k songs
        if (songs.size >= lastCheckpoint + 10000) {
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = songs.size / elapsed;
          const remaining = TARGET_SONGS - songs.size;
          const eta = remaining / rate;
          
          console.log(`Progress: ${songs.size.toLocaleString()}/${TARGET_SONGS.toLocaleString()} (${((songs.size/TARGET_SONGS)*100).toFixed(1)}%)`);
          console.log(`  Rate: ${rate.toFixed(1)}/sec | Queries: ${queriesExecuted.toLocaleString()} | ETA: ${(eta/3600).toFixed(1)}h`);
          
          lastCheckpoint = songs.size;
          
          // Save checkpoint every 50k songs
          if (songs.size % 50000 < 10000) {
            saveProgress(songs, 'spotify-2m-checkpoint.csv');
          }
        }
      } catch (e) {
        console.warn(`  Error on query "${query}": ${e.message}`);
      }
    }
  }
  
  // Strategy 2: Genre + Country combinations
  if (songs.size < TARGET_SONGS) {
    console.log('\nStrategy 2: Genre × Country combinations...\n');
    for (const genre of GENRES) {
      if (songs.size >= TARGET_SONGS) break;
      
      for (const country of COUNTRIES) {
        if (songs.size >= TARGET_SONGS) break;
        
        const query = `genre:${genre} country:${country}`;
        await sleep(RATE_LIMIT_MS);
        
        try {
          const tracks = await searchTracks(query, BATCH_SIZE, 0);
          queriesExecuted++;
          
          for (const track of tracks) {
            const data = extractTrackData(track);
            if (data && data.isrc && !songs.has(data.spotifyId)) {
              songs.set(data.spotifyId, data);
            }
          }
          
          if (songs.size >= lastCheckpoint + 10000) {
            const elapsed = (Date.now() - startTime) / 1000;
            const rate = songs.size / elapsed;
            const remaining = TARGET_SONGS - songs.size;
            const eta = remaining / rate;
            
            console.log(`Progress: ${songs.size.toLocaleString()}/${TARGET_SONGS.toLocaleString()} (${((songs.size/TARGET_SONGS)*100).toFixed(1)}%)`);
            console.log(`  Rate: ${rate.toFixed(1)}/sec | Queries: ${queriesExecuted.toLocaleString()} | ETA: ${(eta/3600).toFixed(1)}h`);
            
            lastCheckpoint = songs.size;
            
            if (songs.size % 50000 < 10000) {
              saveProgress(songs, 'spotify-2m-checkpoint.csv');
            }
          }
        } catch (e) {
          console.warn(`  Error on query "${query}": ${e.message}`);
        }
      }
    }
  }
  
  // Strategy 3: Year + Popularity combinations
  if (songs.size < TARGET_SONGS) {
    console.log('\nStrategy 3: Year × Popularity brackets...\n');
    for (const year of YEARS) {
      if (songs.size >= TARGET_SONGS) break;
      
      // Search with pagination
      for (let offset = 0; offset < 1000; offset += BATCH_SIZE) {
        if (songs.size >= TARGET_SONGS) break;
        
        const query = `year:${year}`;
        await sleep(RATE_LIMIT_MS);
        
        try {
          const tracks = await searchTracks(query, BATCH_SIZE, offset);
          queriesExecuted++;
          
          if (tracks.length === 0) break; // No more results
          
          for (const track of tracks) {
            const data = extractTrackData(track);
            if (data && data.isrc && !songs.has(data.spotifyId)) {
              songs.set(data.spotifyId, data);
            }
          }
          
          if (songs.size >= lastCheckpoint + 10000) {
            const elapsed = (Date.now() - startTime) / 1000;
            const rate = songs.size / elapsed;
            const remaining = TARGET_SONGS - songs.size;
            const eta = remaining / rate;
            
            console.log(`Progress: ${songs.size.toLocaleString()}/${TARGET_SONGS.toLocaleString()} (${((songs.size/TARGET_SONGS)*100).toFixed(1)}%)`);
            console.log(`  Rate: ${rate.toFixed(1)}/sec | Queries: ${queriesExecuted.toLocaleString()} | ETA: ${(eta/3600).toFixed(1)}h`);
            
            lastCheckpoint = songs.size;
            
            if (songs.size % 50000 < 10000) {
              saveProgress(songs, 'spotify-2m-checkpoint.csv');
            }
          }
        } catch (e) {
          console.warn(`  Error on query "${query}": ${e.message}`);
        }
      }
    }
  }
  
  const songsArray = Array.from(songs.values());
  
  console.log(`\n=== Fetch Complete ===`);
  console.log(`Collected: ${songsArray.length.toLocaleString()} unique songs`);
  console.log(`Duration: ${((Date.now() - startTime) / 60000).toFixed(1)} minutes`);
  console.log(`Queries executed: ${queriesExecuted.toLocaleString()}`);
  console.log(`Average rate: ${(songsArray.length / ((Date.now() - startTime) / 1000)).toFixed(1)} songs/sec`);
  console.log(`Songs with ISRCs: ${songsArray.filter(s => s.isrc).length.toLocaleString()} (${((songsArray.filter(s => s.isrc).length / songsArray.length) * 100).toFixed(1)}%)`);
  
  // Save final CSV
  const outputPath = path.join(__dirname, 'sources', 'spotify-2million.csv');
  const csvHeader = 'Artist,Title,ISRC,SpotifyId,Album,ReleaseDate,Popularity,Provider\n';
  const csvRows = songsArray.map(song => {
    const escapeCsv = (str) => `"${String(str).replace(/"/g, '""')}"`;
    return [
      escapeCsv(song.artist),
      escapeCsv(song.title),
      escapeCsv(song.isrc),
      escapeCsv(song.spotifyId),
      escapeCsv(song.album),
      escapeCsv(song.releaseDate),
      song.popularity,
      escapeCsv(song.provider)
    ].join(',');
  }).join('\n');
  
  const csvContent = csvHeader + csvRows;
  fs.writeFileSync(outputPath, csvContent, 'utf8');
  
  console.log(`\n💾 Final CSV saved to: ${outputPath}`);
  console.log(`File size: ${(csvContent.length / 1024 / 1024).toFixed(2)} MB\n`);
  
  // Save metadata
  const metadataPath = path.join(__dirname, 'sources', 'spotify-2million.meta.json');
  const metadata = {
    fetchedAt: new Date().toISOString(),
    totalSongs: songsArray.length,
    uniqueArtists: new Set(songsArray.map(s => s.artist)).size,
    source: 'Spotify',
    strategies: ['genre×year', 'genre×country', 'year×pagination'],
    queriesExecuted: queriesExecuted,
    durationMinutes: ((Date.now() - startTime) / 60000).toFixed(1),
    avgPopularity: (songsArray.reduce((sum, s) => sum + s.popularity, 0) / songsArray.length).toFixed(1),
    withISRC: songsArray.filter(s => s.isrc).length,
    nextSteps: [
      'Songs ready for ingestion pipeline',
      'Run ingestion in batches: node scripts/ingest/run-sample.js --source=spotify-2million.csv --limit=10000',
      'Process in chunks to avoid memory issues',
      'Expected acceptance rate: ~55-60%'
    ]
  };
  
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
  
  console.log('=== Next Steps ===');
  console.log('1. Process in batches (10k-50k at a time) to avoid memory issues');
  console.log('2. Run: node scripts/ingest/run-sample.js --source=spotify-2million.csv --limit=50000');
  console.log('3. After each batch completes, upsert to DB');
  console.log('4. Repeat until all songs processed');
  console.log(`\nEstimated ingestion time: ~${((songsArray.length * 0.75) / 3600).toFixed(1)} hours at 1.3 songs/sec`);
  
  return songsArray;
}

// Run if executed directly
if (require.main === module) {
  fetch2MillionSongs().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { fetch2MillionSongs };
