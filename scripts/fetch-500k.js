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
// CONFIGURATION
// ============================================================================

const TARGET_SONGS = 500000;
const OUTPUT_FILE = path.join(__dirname, 'ingest', 'staging-results-500k.json');
const CHECKPOINT_FILE = path.join(__dirname, 'ingest', 'checkpoint-500k.json');
const RATE_LIMIT_MS = 50; // 50ms between requests = 20 req/sec (safe for Spotify)

// Expanded playlist categories for Phase 1
const PLAYLIST_CATEGORIES = [
  // Mainstream
  'top hits', 'popular', 'trending', 'viral', 'charts', 'hot', 'new releases',
  
  // Major genres
  'pop', 'rock', 'hip hop', 'rap', 'r&b', 'soul', 'funk', 'jazz', 'blues',
  'country', 'folk', 'bluegrass', 'americana',
  
  // Electronic
  'edm', 'house', 'techno', 'trance', 'dubstep', 'drum and bass', 'electronic',
  'ambient', 'chillout', 'downtempo',
  
  // Rock subgenres
  'metal', 'death metal', 'black metal', 'thrash', 'metalcore', 'hardcore',
  'punk', 'post punk', 'emo', 'screamo', 'grunge', 'alternative',
  'indie rock', 'indie pop', 'shoegaze', 'post rock', 'math rock',
  
  // International
  'latin', 'reggaeton', 'salsa', 'bachata', 'cumbia', 'tango', 'bossa nova',
  'k-pop', 'j-pop', 'c-pop', 'mandopop', 'cantopop',
  'reggae', 'dancehall', 'ska', 'dub',
  'afrobeat', 'african', 'arabic', 'turkish', 'indian', 'bollywood',
  'flamenco', 'fado', 'celtic',
  
  // Mood-based
  'chill', 'relax', 'sleep', 'study', 'focus', 'work', 'workout', 'party',
  'sad', 'happy', 'upbeat', 'mellow', 'energetic',
  
  // Era-based
  '80s', '90s', '00s', '2000s', '2010s', '2020s', 'throwback', 'oldies', 'classics'
];

// Comprehensive genre list for Phase 2
const GENRES = [
  'pop', 'rock', 'hip-hop', 'rap', 'r-n-b', 'soul', 'funk', 'jazz', 'blues',
  'country', 'folk', 'bluegrass', 'americana',
  'edm', 'house', 'techno', 'trance', 'dubstep', 'drum-and-bass', 'electronic',
  'ambient', 'idm', 'glitch', 'experimental',
  'metal', 'death-metal', 'black-metal', 'thrash', 'metalcore', 'deathcore',
  'hardcore', 'punk', 'post-punk', 'emo', 'screamo', 'grunge', 'alternative',
  'indie', 'indie-rock', 'indie-pop', 'shoegaze', 'post-rock', 'math-rock',
  'classical', 'opera', 'baroque', 'romantic', 'contemporary-classical',
  'latin', 'reggaeton', 'salsa', 'bachata', 'cumbia', 'tango', 'bossa-nova',
  'k-pop', 'j-pop', 'j-rock', 'c-pop', 'mandopop', 'cantopop',
  'reggae', 'dancehall', 'ska', 'dub', 'roots-reggae',
  'afrobeat', 'highlife', 'soukous', 'afro-pop',
  'world', 'ethnic', 'new-age', 'celtic', 'flamenco', 'fado',
  'disco', 'boogie', 'electro', 'synthwave', 'vaporwave',
  'trap', 'drill', 'grime', 'uk-garage', 'bass',
  'progressive', 'psytrance', 'minimal', 'deep-house', 'tech-house',
  'garage', 'breakbeat', 'jungle', 'footwork',
  'singer-songwriter', 'acoustic', 'unplugged',
  'gospel', 'christian', 'worship',
  'soundtrack', 'score', 'musical', 'anime',
  'comedy', 'spoken-word', 'audiobook',
  'children', 'kids', 'lullaby',
  'holiday', 'christmas', 'seasonal'
];

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
  
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!response.ok) {
    console.error(`Playlist search failed (${response.status}): ${query}`);
    return [];
  }
  
  const data = await response.json();
  return data.playlists?.items || [];
}

async function getPlaylistTracks(playlistId) {
  const token = await getSpotifyToken();
  const url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;
  
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!response.ok) {
    console.error(`Playlist fetch failed (${response.status}): ${playlistId}`);
    return [];
  }
  
  const data = await response.json();
  return data.items || [];
}

async function searchTracks(query, limit = 50, offset = 0) {
  const token = await getSpotifyToken();
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}&offset=${offset}`;
  
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!response.ok) {
    if (response.status === 429) {
      console.error('Rate limited! Waiting 10 seconds...');
      await sleep(10000);
      return searchTracks(query, limit, offset);
    }
    return [];
  }
  
  const data = await response.json();
  return data.tracks?.items || [];
}

// ============================================================================
// UTILITIES
// ============================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function saveCheckpoint(data) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
}

function loadCheckpoint() {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('Failed to load checkpoint:', error.message);
  }
  return null;
}

function formatTrackData(track) {
  if (!track?.id) return null;
  
  const isrc = track.external_ids?.isrc || null;
  if (!isrc) return null;
  
  return {
    isrc,
    spotify: {
      found: true,
      spotify_id: track.id,
      raw: {
        id: track.id,
        name: track.name,
        artists: track.artists?.map(a => ({
          name: a.name,
          id: a.id
        })) || [],
        album: {
          name: track.album?.name,
          release_date: track.album?.release_date
        },
        duration_ms: track.duration_ms,
        popularity: track.popularity,
        explicit: track.explicit,
        external_ids: {
          isrc: track.external_ids?.isrc
        }
      }
    }
  };
}

// ============================================================================
// PHASE 1: PLAYLISTS
// ============================================================================

async function phase1Playlists(songs, checkpoint) {
  console.log('\n🎵 PHASE 1: Fetching from curated playlists (fast)...\n');
  
  const startCategory = checkpoint?.phase1?.lastCategory || 0;
  let playlistsProcessed = checkpoint?.phase1?.playlistsProcessed || 0;
  
  for (let i = startCategory; i < PLAYLIST_CATEGORIES.length; i++) {
    const category = PLAYLIST_CATEGORIES[i];
    console.log(`\n📂 Category ${i + 1}/${PLAYLIST_CATEGORIES.length}: "${category}"`);
    
    const playlists = await searchPlaylists(category, 50);
    await sleep(RATE_LIMIT_MS);
    
    for (const playlist of playlists) {
      if (!playlist?.id) continue; // Skip invalid playlists
      
      const tracks = await getPlaylistTracks(playlist.id);
      await sleep(RATE_LIMIT_MS);
      
      for (const item of tracks) {
        if (item?.track) {
          const trackData = formatTrackData(item.track);
          if (trackData && trackData.spotify.spotify_id) {
            songs.set(trackData.spotify.spotify_id, trackData);
          }
        }
      }
      
      playlistsProcessed++;
      
      if (playlistsProcessed % 10 === 0) {
        console.log(`  ✓ Playlists: ${playlistsProcessed}, Songs: ${songs.size.toLocaleString()}`);
        saveCheckpoint({
          phase: 1,
          phase1: { lastCategory: i, playlistsProcessed },
          songsCount: songs.size
        });
      }
    }
    
    console.log(`  ✅ Category complete: ${songs.size.toLocaleString()} total songs`);
    
    // Stop Phase 1 if we hit 80k (good coverage)
    if (songs.size >= 80000) {
      console.log('\n✅ Phase 1 target reached (80k songs). Moving to Phase 2...');
      break;
    }
  }
  
  console.log(`\n✅ Phase 1 complete: ${songs.size.toLocaleString()} songs from ${playlistsProcessed} playlists\n`);
  return songs;
}

// ============================================================================
// PHASE 2: GENRE × YEAR SEARCHES
// ============================================================================

async function phase2Searches(songs, checkpoint) {
  console.log('🔍 PHASE 2: Genre searches to reach target (comprehensive)...\n');
  
  const startGenreIdx = checkpoint?.phase2?.lastGenreIdx || 0;
  const startYearIdx = checkpoint?.phase2?.lastYearIdx || 0;
  const startOffset = checkpoint?.phase2?.lastOffset || 0;
  
  for (let g = startGenreIdx; g < GENRES.length; g++) {
    const genre = GENRES[g];
    
    for (let y = (g === startGenreIdx ? startYearIdx : 0); y < YEARS.length; y++) {
      const year = YEARS[y];
      const query = `genre:"${genre}" year:${year}`;
      
      // Paginate through results (max 1000 per query)
      for (let offset = (g === startGenreIdx && y === startYearIdx ? startOffset : 0); 
           offset < 1000; 
           offset += 50) {
        
        const tracks = await searchTracks(query, 50, offset);
        await sleep(RATE_LIMIT_MS);
        
        if (tracks.length === 0) break; // No more results
        
        for (const track of tracks) {
          const trackData = formatTrackData(track);
          if (trackData && trackData.spotify.spotify_id) {
            songs.set(trackData.spotify.spotify_id, trackData);
          }
        }
        
        // Progress update every 500 tracks checked
        if ((offset + 50) % 500 === 0) {
          console.log(`  ✓ ${genre} ${year} [${offset + 50}]: ${songs.size.toLocaleString()} songs`);
        }
        
        // Save checkpoint every 5000 new songs
        if (songs.size % 5000 === 0) {
          saveCheckpoint({
            phase: 2,
            phase2: { lastGenreIdx: g, lastYearIdx: y, lastOffset: offset },
            songsCount: songs.size
          });
        }
        
        // Check if we hit target
        if (songs.size >= TARGET_SONGS) {
          console.log(`\n🎉 TARGET REACHED: ${songs.size.toLocaleString()} songs!\n`);
          return songs;
        }
      }
    }
    
    console.log(`✅ Genre "${genre}" complete: ${songs.size.toLocaleString()} total songs`);
    
    // Check if we hit target
    if (songs.size >= TARGET_SONGS) {
      console.log(`\n🎉 TARGET REACHED: ${songs.size.toLocaleString()} songs!\n`);
      return songs;
    }
  }
  
  console.log(`\n✅ Phase 2 complete: ${songs.size.toLocaleString()} total songs\n`);
  return songs;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('🎵 SPOTIFY MUSIC FETCHER - 500K TARGET\n');
  console.log(`Target: ${TARGET_SONGS.toLocaleString()} songs`);
  console.log(`Output: ${OUTPUT_FILE}\n`);
  
  const startTime = Date.now();
  
  // Check for checkpoint
  const checkpoint = loadCheckpoint();
  const songs = new Map();
  
  if (checkpoint) {
    console.log(`📂 Checkpoint found: ${checkpoint.songsCount.toLocaleString()} songs, Phase ${checkpoint.phase}`);
    console.log('   Resume from checkpoint? (Delete checkpoint-500k.json to start fresh)\n');
  }
  
  // Phase 1: Playlists (fast)
  if (!checkpoint || checkpoint.phase === 1) {
    await phase1Playlists(songs, checkpoint);
  }
  
  // Phase 2: Genre searches (comprehensive)
  if (songs.size < TARGET_SONGS) {
    await phase2Searches(songs, checkpoint);
  }
  
  // Save results
  console.log('💾 Saving results...');
  const results = {
    results: Array.from(songs.values()),
    metadata: {
      total: songs.size,
      fetchedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      durationMins: ((Date.now() - startTime) / 1000 / 60).toFixed(1)
    }
  };
  
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  
  // Clean up checkpoint
  if (fs.existsSync(CHECKPOINT_FILE)) {
    fs.unlinkSync(CHECKPOINT_FILE);
  }
  
  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n🎉 COMPLETE: ${songs.size.toLocaleString()} songs in ${duration} minutes`);
  console.log(`💾 Saved to: ${OUTPUT_FILE}\n`);
}

main().catch(console.error);
