const fs = require('fs');
const path = require('path');

// Load .env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^['"]|['"]$/g, '');
      process.env[key] = value;
    }
  });
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const TARGET_SONGS_PER_GENRE = 1000;
const MAX_TOTAL_SONGS = 6000000; // 6 million max (6238 genres × 1000 songs)
const OUTPUT_FILE = path.join(__dirname, 'ingest', 'staging-results-mega.json');
const CHECKPOINT_FILE = path.join(__dirname, 'ingest', 'checkpoint-mega.json');
const RATE_LIMIT_MS = 50; // 50ms = 20 req/sec (safe for Spotify)
const YEARS = Array.from({ length: 75 }, (_, i) => 2024 - i); // 2024-1950

// Load all 6,238 Spotify genres
const genreData = require('./all-spotify-genres.json');
const ALL_GENRES = genreData.genres;

console.log(`
${'='.repeat(80)}
🎵 SPOTIFY MEGA FETCH - 1000 SONGS PER GENRE
${'='.repeat(80)}

Configuration:
  • Target: ${TARGET_SONGS_PER_GENRE.toLocaleString()} songs per genre
  • Genres: ${ALL_GENRES.length.toLocaleString()} genres
  • Max total: ${MAX_TOTAL_SONGS.toLocaleString()} songs
  • Rate limit: ${RATE_LIMIT_MS}ms (${1000/RATE_LIMIT_MS} req/sec)
  • Years: ${YEARS[YEARS.length-1]}-${YEARS[0]}

${'='.repeat(80)}
`);

// ============================================================================
// SPOTIFY API
// ============================================================================

let accessToken = null;
let tokenExpiry = 0;

async function getSpotifyToken() {
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }
  
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('Missing Spotify credentials in .env');
  }
  
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
    },
    body: 'grant_type=client_credentials'
  });
  
  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Refresh 1 min early
  return accessToken;
}

async function searchTracks(query, limit = 50, offset = 0) {
  const token = await getSpotifyToken();
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}&offset=${offset}`;
  
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('retry-after') || '5');
    console.log(`⚠️  Rate limited, waiting ${retryAfter}s...`);
    await sleep(retryAfter * 1000);
    return searchTracks(query, limit, offset);
  }
  
  if (!response.ok) {
    return [];
  }
  
  const data = await response.json();
  return data.tracks?.items || [];
}

function formatTrackData(track) {
  const isrc = track.external_ids?.isrc;
  if (!isrc) return null;
  
  return {
    isrc,
    spotify: {
      found: true,
      spotify_id: track.id,
      raw: {
        id: track.id,
        name: track.name,
        artists: track.artists?.map(a => ({ name: a.name, id: a.id })),
        album: {
          name: track.album?.name,
          release_date: track.album?.release_date,
          images: track.album?.images
        },
        duration_ms: track.duration_ms,
        popularity: track.popularity,
        explicit: track.explicit,
        preview_url: track.preview_url,
        external_ids: { isrc }
      }
    }
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// CHECKPOINT SYSTEM
// ============================================================================

function loadCheckpoint() {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    const data = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
    console.log(`📂 Resuming from checkpoint: ${data.songsCount.toLocaleString()} songs, genre ${data.currentGenreIdx + 1}/${ALL_GENRES.length}\n`);
    return data;
  }
  return {
    currentGenreIdx: 0,
    songsCount: 0,
    genreStats: {}
  };
}

function saveCheckpoint(checkpoint) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
}

function saveSongs(songs) {
  const results = Array.from(songs.values());
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ results }, null, 2));
}

// ============================================================================
// MAIN FETCH LOGIC
// ============================================================================

async function fetchSongsForGenre(genre, songs, checkpoint) {
  const genreStats = checkpoint.genreStats[genre] || { total: 0, queries: 0 };
  
  // Strategy 1: Direct genre search (most effective)
  for (let offset = 0; offset < 1000 && genreStats.total < TARGET_SONGS_PER_GENRE; offset += 50) {
    const query = `genre:"${genre}"`;
    const tracks = await searchTracks(query, 50, offset);
    await sleep(RATE_LIMIT_MS);
    
    if (tracks.length === 0) break;
    
    tracks.forEach(track => {
      const trackData = formatTrackData(track);
      if (trackData?.spotify.spotify_id && !songs.has(trackData.spotify.spotify_id)) {
        songs.set(trackData.spotify.spotify_id, trackData);
        genreStats.total++;
      }
    });
    
    genreStats.queries++;
  }
  
  // Strategy 2: Genre + year combinations (if we need more)
  if (genreStats.total < TARGET_SONGS_PER_GENRE) {
    for (const year of YEARS) {
      if (genreStats.total >= TARGET_SONGS_PER_GENRE) break;
      
      for (let offset = 0; offset < 200 && genreStats.total < TARGET_SONGS_PER_GENRE; offset += 50) {
        const query = `genre:"${genre}" year:${year}`;
        const tracks = await searchTracks(query, 50, offset);
        await sleep(RATE_LIMIT_MS);
        
        if (tracks.length === 0) break;
        
        tracks.forEach(track => {
          const trackData = formatTrackData(track);
          if (trackData?.spotify.spotify_id && !songs.has(trackData.spotify.spotify_id)) {
            songs.set(trackData.spotify.spotify_id, trackData);
            genreStats.total++;
          }
        });
        
        genreStats.queries++;
      }
    }
  }
  
  checkpoint.genreStats[genre] = genreStats;
  return genreStats.total;
}

async function megaFetch() {
  const startTime = Date.now();
  const checkpoint = loadCheckpoint();
  const songs = new Map();
  
  // Load existing songs if resuming
  if (fs.existsSync(OUTPUT_FILE)) {
    const existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
    existing.results?.forEach(track => {
      if (track.spotify?.spotify_id) {
        songs.set(track.spotify.spotify_id, track);
      }
    });
    console.log(`📂 Loaded ${songs.size.toLocaleString()} existing songs\n`);
  }
  
  console.log('🚀 Starting mega fetch...\n');
  
  let lastSaveTime = Date.now();
  let genresProcessed = 0;
  let genresWithSongs = 0;
  
  for (let i = checkpoint.currentGenreIdx; i < ALL_GENRES.length; i++) {
    const genre = ALL_GENRES[i];
    const genreNum = i + 1;
    const progress = ((genreNum / ALL_GENRES.length) * 100).toFixed(1);
    
    process.stdout.write(`\r[${progress}%] Genre ${genreNum}/${ALL_GENRES.length}: ${genre.padEnd(40).substring(0, 40)} `);
    
    const songsFound = await fetchSongsForGenre(genre, songs, checkpoint);
    
    if (songsFound > 0) {
      genresWithSongs++;
      process.stdout.write(`✓ ${songsFound} songs`);
    } else {
      process.stdout.write(`⚠️  0 songs`);
    }
    
    console.log('');
    
    genresProcessed++;
    checkpoint.currentGenreIdx = i;
    checkpoint.songsCount = songs.size;
    
    // Save checkpoint every 10 genres or 5 minutes
    if (genresProcessed % 10 === 0 || Date.now() - lastSaveTime > 300000) {
      saveCheckpoint(checkpoint);
      saveSongs(songs);
      lastSaveTime = Date.now();
      
      const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      const avgPerGenre = (songs.size / genresProcessed).toFixed(0);
      const remaining = ALL_GENRES.length - genreNum;
      const eta = (remaining / (genresProcessed / (Date.now() - startTime)) / 1000 / 60).toFixed(0);
      
      console.log(`\n📊 Progress Update:`);
      console.log(`   Genres processed: ${genresProcessed}/${ALL_GENRES.length} (${progress}%)`);
      console.log(`   Genres with songs: ${genresWithSongs} (${((genresWithSongs/genresProcessed)*100).toFixed(1)}%)`);
      console.log(`   Total songs: ${songs.size.toLocaleString()}`);
      console.log(`   Average per genre: ${avgPerGenre} songs`);
      console.log(`   Elapsed: ${elapsed} minutes`);
      console.log(`   ETA: ${eta} minutes\n`);
    }
    
    // Stop if we hit max total songs
    if (songs.size >= MAX_TOTAL_SONGS) {
      console.log(`\n✅ Reached max total songs (${MAX_TOTAL_SONGS.toLocaleString()}). Stopping.`);
      break;
    }
  }
  
  // Final save
  saveCheckpoint(checkpoint);
  saveSongs(songs);
  
  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  
  console.log(`\n${'='.repeat(80)}`);
  console.log('✅ MEGA FETCH COMPLETE!');
  console.log(`${'='.repeat(80)}\n`);
  console.log('📊 Final Statistics:');
  console.log(`   Genres processed: ${genresProcessed.toLocaleString()}/${ALL_GENRES.length.toLocaleString()}`);
  console.log(`   Genres with songs: ${genresWithSongs.toLocaleString()}`);
  console.log(`   Total unique songs: ${songs.size.toLocaleString()}`);
  console.log(`   Average per genre: ${(songs.size / genresProcessed).toFixed(0)} songs`);
  console.log(`   Total time: ${totalTime} minutes`);
  console.log(`   Songs per minute: ${(songs.size / totalTime).toFixed(0)}\n`);
  
  // Show top genres by song count
  const topGenres = Object.entries(checkpoint.genreStats)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 20);
  
  console.log('🏆 Top 20 Genres by Song Count:\n');
  topGenres.forEach(([genre, stats], i) => {
    console.log(`   ${(i + 1).toString().padStart(2)}. ${genre.padEnd(40)} ${stats.total.toString().padStart(4)} songs`);
  });
  
  console.log(`\n💾 Output file: ${OUTPUT_FILE}\n`);
}

// Run it
megaFetch().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
