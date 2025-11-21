const fs = require('fs');
const path = require('path');

// Manually load .env (UTF-8 encoding issue workaround)
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
// CONFIGURATION - 1 MILLION SONGS WITH BATCH COLLECTION
// ============================================================================

const TARGET_SONGS = 1000000;
const BATCH_SIZE = 50000; // Save checkpoint every 50k songs
const RATE_LIMIT_MS = 3000; // 3000ms between requests = 0.33 req/sec (extremely conservative, respects Spotify heavily)

// Output files
const OUTPUT_DIR = path.join(__dirname, 'ingest');
const BATCH_PREFIX = 'staging-results-1m';
const CHECKPOINT_FILE = path.join(OUTPUT_DIR, `${BATCH_PREFIX}-checkpoint.json`);

// ============================================================================
// SEARCH CATEGORIES - EXPANDED WITH REGIONAL PLAYLISTS
// ============================================================================

const PLAYLIST_CATEGORIES = [
  // Mainstream & Discovery
  'top hits', 'popular', 'trending', 'viral', 'charts', 'hot', 'new releases',
  'all out', 'best of', 'essential', 'must have', 'legendary', 'classics',
  
  // Major genres
  'pop', 'rock', 'hip hop', 'rap', 'r&b', 'soul', 'funk', 'jazz', 'blues',
  'country', 'folk', 'bluegrass', 'americana',
  
  // Electronic
  'edm', 'house', 'techno', 'trance', 'dubstep', 'drum and bass', 'electronic',
  'ambient', 'chillout', 'downtempo', 'deep house', 'techno', 'progressive',
  
  // Rock subgenres
  'metal', 'death metal', 'black metal', 'thrash', 'metalcore', 'hardcore',
  'punk', 'post punk', 'emo', 'screamo', 'grunge', 'alternative',
  'indie rock', 'indie pop', 'shoegaze', 'post rock', 'math rock',
  
  // International
  'latin', 'reggaeton', 'salsa', 'bachata', 'cumbia', 'tango', 'bossa nova',
  'k-pop', 'j-pop', 'c-pop', 'mandopop', 'cantopop',
  'reggae', 'dancehall', 'ska', 'dub',
  'afrobeat', 'african', 'arabic', 'turkish', 'indian', 'bollywood',
  'flamenco', 'fado', 'celtic', 'irish',
  
  // Mood-based
  'chill', 'relax', 'sleep', 'study', 'focus', 'work', 'workout', 'party',
  'sad', 'happy', 'upbeat', 'mellow', 'energetic', 'motivational',
  
  // Era-based
  '80s', '90s', '00s', '2000s', '2010s', '2020s', 'throwback', 'oldies', 'classics',
  'retro', 'vintage', 'timeless',
  
  // Additional varieties
  'acoustic', 'unplugged', 'live', 'remix', 'cover', 'karaoke',
  'lo-fi', 'vaporwave', 'synthwave', 'retrowave',
  'synthpop', 'darkwave', 'coldwave', 'post-punk revival',
  'trap', 'drill', 'grime', 'garage', 'uk garage', 'bass',
  'breakcore', 'breakbeat', 'jungle', 'drum and bass', 'liquid funk',
  'disco', 'boogie', 'funk', 'soul', 'motown',
  'gospel', 'christian', 'worship', 'spiritual',
  'soundtrack', 'score', 'musical', 'anime', 'video game',
  'classical', 'opera', 'baroque', 'romantic', 'contemporary classical',
  'world music', 'ethnic', 'indigenous', 'traditional',
];

// REGIONAL PLAYLISTS - Search for top playlists in different countries
const REGIONAL_SEARCHES = [
  // North America
  'hot 50 usa', 'top 50 canada', 'viral 50 usa',
  
  // Europe
  'top 50 uk', 'top 50 germany', 'top 50 france', 'top 50 italy', 'top 50 spain',
  'top 50 netherlands', 'top 50 sweden', 'top 50 norway', 'top 50 denmark',
  'top 50 poland', 'top 50 russia', 'viral 50 europe',
  
  // Asia Pacific
  'top 50 japan', 'top 50 korea', 'top 50 india', 'top 50 australia',
  'top 50 indonesia', 'top 50 thailand', 'top 50 singapore', 'top 50 philippines',
  'top 50 china', 'top 50 vietnam', 'viral 50 asia',
  
  // Latin America & Caribbean
  'top 50 mexico', 'top 50 brazil', 'top 50 argentina', 'top 50 chile',
  'top 50 colombia', 'top 50 peru', 'viral 50 latin america',
  
  // Middle East & Africa
  'top 50 saudi arabia', 'top 50 united arab emirates', 'top 50 israel',
  'top 50 south africa', 'top 50 nigeria', 'viral 50 africa',
];

// Comprehensive genre list
const GENRES = [
  'pop', 'rock', 'hip-hop', 'rap', 'r-n-b', 'soul', 'funk', 'jazz', 'blues',
  'country', 'folk', 'bluegrass', 'americana',
  'edm', 'house', 'techno', 'trance', 'dubstep', 'drum-and-bass', 'electronic',
  'ambient', 'idm', 'glitch', 'experimental', 'deep-house', 'tech-house',
  'metal', 'death-metal', 'black-metal', 'thrash', 'metalcore', 'deathcore',
  'hardcore', 'punk', 'post-punk', 'emo', 'screamo', 'grunge', 'alternative',
  'indie', 'indie-rock', 'indie-pop', 'shoegaze', 'post-rock', 'math-rock',
  'classical', 'opera', 'baroque', 'romantic', 'contemporary-classical',
  'latin', 'reggaeton', 'salsa', 'bachata', 'cumbia', 'tango', 'bossa-nova',
  'k-pop', 'j-pop', 'j-rock', 'c-pop', 'mandopop', 'cantopop',
  'reggae', 'dancehall', 'ska', 'dub', 'roots-reggae',
  'afrobeat', 'highlife', 'soukous', 'afro-pop', 'amapiano',
  'world', 'ethnic', 'new-age', 'celtic', 'flamenco', 'fado',
  'disco', 'boogie', 'electro', 'synthwave', 'vaporwave', 'chillwave',
  'trap', 'drill', 'grime', 'uk-garage', 'bass', 'garage',
  'progressive', 'psytrance', 'minimal', 'breakbeat', 'jungle', 'footwork',
  'singer-songwriter', 'acoustic', 'unplugged', 'folk-pop',
  'gospel', 'christian', 'worship', 'spiritual',
  'soundtrack', 'score', 'musical', 'anime', 'video-game',
  'comedy', 'spoken-word', 'audiobook', 'podcast',
  'children', 'kids', 'lullaby', 'educational',
  'holiday', 'christmas', 'seasonal', 'easter'
];

// Year range for searches
const YEARS = Array.from({ length: 75 }, (_, i) => 2024 - i); // 2024 down to 1950

// ============================================================================
// SPOTIFY API
// ============================================================================

let accessToken = null;

async function getSpotifyToken() {
  if (accessToken) return accessToken;
  
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
  return accessToken;
}

async function searchPlaylists(query, limit = 50) {
  const token = await getSpotifyToken();
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=playlist&limit=${limit}`;
  
  let retryCount = 0;
  const MAX_RETRIES = 10; // Increased from 5 to 10
  
  while (retryCount <= MAX_RETRIES) {
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.status === 429) {
      // Rate limited - check Retry-After header first
      const retryAfter = response.headers.get('Retry-After');
      let backoffMs;
      
      if (retryAfter) {
        // If Spotify tells us to wait, use that + extra buffer
        backoffMs = parseInt(retryAfter) * 1000 + Math.random() * 5000;
        console.log(`  ⏳ Rate limited, Spotify says retry after ${retryAfter}s, waiting ${(backoffMs/1000).toFixed(1)}s`);
      } else {
        // Otherwise use exponential backoff: start at 5 seconds, double each time
        retryCount++;
        if (retryCount > MAX_RETRIES) {
          console.error(`  ✗ Search failed (429 - rate limited after ${MAX_RETRIES} retries): ${query}`);
          return [];
        }
        backoffMs = (Math.pow(2, retryCount) * 5000) + Math.random() * 3000;
        console.log(`  ⏳ Backing off ${(backoffMs/1000).toFixed(1)}s (attempt ${retryCount}/${MAX_RETRIES})`);
      }
      
      await sleep(backoffMs);
      continue;
    }
    
    if (!response.ok) {
      console.error(`  ✗ Playlist search failed (${response.status}): ${query}`);
      return [];
    }
    
    const data = await response.json();
    return data.playlists?.items || [];
  }
  
  return [];
}

async function getPlaylistTracks(playlistId) {
  const token = await getSpotifyToken();
  let allTracks = [];
  let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;
  let retryCount = 0;
  const MAX_RETRIES = 10; // Increased from 5 to 10
  
  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.status === 429) {
      // Rate limited - check Retry-After header first
      const retryAfter = response.headers.get('Retry-After');
      let backoffMs;
      
      if (retryAfter) {
        // If Spotify tells us to wait, use that + extra buffer
        backoffMs = parseInt(retryAfter) * 1000 + Math.random() * 5000;
        console.log(`  ⏳ Playlist rate limited, Spotify says retry after ${retryAfter}s, waiting ${(backoffMs/1000).toFixed(1)}s`);
      } else {
        // Otherwise use exponential backoff: start at 5 seconds, double each time
        retryCount++;
        if (retryCount > MAX_RETRIES) {
          console.error(`  ✗ Playlist fetch failed (429 - rate limited after ${MAX_RETRIES} retries): ${playlistId}`);
          break;
        }
        backoffMs = (Math.pow(2, retryCount) * 5000) + Math.random() * 3000;
        console.log(`  ⏳ Backing off ${(backoffMs/1000).toFixed(1)}s (attempt ${retryCount}/${MAX_RETRIES})`);
      }
      
      await sleep(backoffMs);
      continue;
    }
    
    if (!response.ok) {
      console.error(`  ✗ Playlist fetch failed (${response.status}): ${playlistId}`);
      break;
    }
    
    retryCount = 0; // Reset retry counter on success
    const data = await response.json();
    allTracks.push(...(data.items || []));
    nextUrl = data.next;
    
    // Small delay between pagination requests
    await sleep(RATE_LIMIT_MS);
  }
  
  return allTracks;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// BATCH COLLECTION & CHECKPOINT SYSTEM
// ============================================================================

async function collectSongsWithCheckpoints() {
  console.log('\n🎵 1 MILLION SONGS COLLECTION - BATCH MODE\n');
  console.log(`Target: ${TARGET_SONGS.toLocaleString()} songs`);
  console.log(`Batch size: ${BATCH_SIZE.toLocaleString()} songs per checkpoint`);
  console.log(`Expected batches: ${Math.ceil(TARGET_SONGS / BATCH_SIZE)}\n`);

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Clear old checkpoint to start fresh
  if (fs.existsSync(CHECKPOINT_FILE)) {
    fs.unlinkSync(CHECKPOINT_FILE);
  }
  
  let checkpoint = {};
  let allCollectedTracks = [];
  let batchNumber = 1;
  
  console.log(`📋 Starting fresh collection...\n`);

  const uniqueTracks = new Map(); // Deduplicate by Spotify ID
  allCollectedTracks.forEach(track => {
    if (track.spotify?.spotify_id) {
      uniqueTracks.set(track.spotify.spotify_id, track);
    }
  });

  // Combine all search queries
  const allSearchQueries = [
    ...PLAYLIST_CATEGORIES,
    ...REGIONAL_SEARCHES,
    ...GENRES.map(g => `${g} playlist`),
    ...GENRES.map(g => `${g} hits`),
  ];

  console.log(`📊 Total search queries: ${allSearchQueries.length.toLocaleString()}`);
  console.log(`⏱️  Estimated time: ~${Math.round((allSearchQueries.length * 20) / 60)} hours (20 req/sec = 1 query per ~50ms)\n`);
  console.log('🚀 Starting collection...\n');

  let queryCount = 0;
  const startTime = Date.now();

  for (const query of allSearchQueries) {
    if (uniqueTracks.size >= TARGET_SONGS) {
      console.log(`\n✅ Target reached: ${uniqueTracks.size.toLocaleString()} unique tracks`);
      break;
    }

    queryCount++;
    process.stdout.write(`\r[${queryCount}/${allSearchQueries.length}] Searching playlists... (${uniqueTracks.size.toLocaleString()} tracks)`);

    try {
      const playlists = await searchPlaylists(query, 50);
      
      for (const playlist of playlists) {
        if (uniqueTracks.size >= TARGET_SONGS) break;
        if (!playlist || !playlist.id) continue; // Skip null/invalid playlists
        
        const tracks = await getPlaylistTracks(playlist.id);
        for (const item of tracks) {
          if (uniqueTracks.size >= TARGET_SONGS) break;
          
          const track = item.track;
          if (track && track.id && !uniqueTracks.has(track.id)) {
            uniqueTracks.set(track.id, {
              spotify: {
                spotify_id: track.id,
                raw: {
                  name: track.name,
                  artists: track.artists,
                  album: track.album,
                  duration_ms: track.duration_ms,
                  popularity: track.popularity,
                  explicit: track.explicit,
                  isrc: track.external_ids?.isrc,
                }
              },
              isrc: track.external_ids?.isrc,
              musicbrainz: { mbid: null }
            });
          }
        }
        
        await sleep(RATE_LIMIT_MS);
      }
      
      // Add delay after each search query for Spotify API courtesy
      await sleep(RATE_LIMIT_MS * 1.5);
    } catch (error) {
      console.error(`\n✗ Error processing query "${query}":`, error.message);
    }

    // Save checkpoint every 50k songs
    if (uniqueTracks.size % BATCH_SIZE < 100 || uniqueTracks.size >= TARGET_SONGS) {
      const batchData = Array.from(uniqueTracks.values());
      const batchFile = path.join(OUTPUT_DIR, `${BATCH_PREFIX}-batch-${batchNumber}.json`);
      
      fs.writeFileSync(batchFile, JSON.stringify(batchData, null, 2));
      
      fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify({
        tracks: batchData,
        collectedAt: new Date().toISOString(),
        nextBatch: batchNumber + 1,
        totalTracks: batchData.length,
        searchQueriesProcessed: queryCount,
      }, null, 2));
      
      console.log(`\n💾 Batch #${batchNumber} saved: ${batchData.length.toLocaleString()} total tracks (${Math.round(Date.now() - startTime) / 1000}s elapsed)`);
      batchNumber++;
    }
  }

  const finalTracks = Array.from(uniqueTracks.values());
  const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
  const elapsedMinutes = Math.round(elapsedSeconds / 60);
  const elapsedHours = (elapsedMinutes / 60).toFixed(1);

  console.log(`\n✅ COLLECTION COMPLETE`);
  console.log(`📊 Total unique tracks: ${finalTracks.length.toLocaleString()}`);
  console.log(`⏱️  Time elapsed: ${elapsedHours}h (${elapsedMinutes}m, ${elapsedSeconds}s)`);
  console.log(`📈 Speed: ${Math.round(finalTracks.length / elapsedMinutes)} tracks/minute`);

  // Save final file
  const finalFile = path.join(OUTPUT_DIR, `${BATCH_PREFIX}-final.json`);
  fs.writeFileSync(finalFile, JSON.stringify(finalTracks, null, 2));
  console.log(`\n📁 Final file saved: ${finalFile}`);
  console.log(`📁 Use this file with turbo-upsert.js to import to database\n`);

  return finalTracks;
}

// ============================================================================
// MAIN
// ============================================================================

if (require.main === module) {
  collectSongsWithCheckpoints().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { collectSongsWithCheckpoints };
