/**
 * Fetch 150k songs from Spotify (target 100k after enrichment)
 * Optimized for speed - focuses on high-quality popular tracks
 */

const fs = require('fs');
const path = require('path');

// Manually parse .env
const envPath = path.join(__dirname, '..', '.env');
const envFile = fs.readFileSync(envPath, 'utf8');
let SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET;
envFile.split(/\r?\n/).forEach(line => {
  line = line.trim();
  if (line.startsWith('SPOTIFY_CLIENT_ID=')) {
    SPOTIFY_CLIENT_ID = line.substring('SPOTIFY_CLIENT_ID='.length);
  }
  if (line.startsWith('SPOTIFY_CLIENT_SECRET=')) {
    SPOTIFY_CLIENT_SECRET = line.substring('SPOTIFY_CLIENT_SECRET='.length);
  }
});

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
  console.error('❌ Missing Spotify credentials');
  process.exit(1);
}

const TARGET = 150000;
const RATE_LIMIT = 100; // ms between requests

// Focused genre list (most popular)
const GENRES = [
  'pop', 'rock', 'hip-hop', 'rap', 'r&b', 'dance', 'electronic', 'edm', 'house',
  'indie', 'alternative', 'country', 'latin', 'reggaeton', 'k-pop', 'metal',
  'punk', 'folk', 'jazz', 'blues', 'soul', 'funk', 'disco', 'techno', 'trance'
];

const YEARS = Array.from({length: 30}, (_, i) => 2025 - i); // 1995-2025

let token = null;
let tokenExpiry = 0;

async function getToken() {
  if (token && Date.now() < tokenExpiry) return token;
  
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')
    },
    body: 'grant_type=client_credentials'
  });
  
  const data = await response.json();
  token = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;
  return token;
}

async function search(query, limit = 50, offset = 0) {
  const token = await getToken();
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}&offset=${offset}`;
  
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.tracks.items;
}

function extractTrack(track) {
  if (!track.id || !track.external_ids?.isrc) return null;
  
  return {
    spotifyId: track.id,
    isrc: track.external_ids.isrc,
    title: track.name,
    artist: track.artists[0]?.name || 'Unknown',
    album: track.album?.name || '',
    releaseDate: track.album?.release_date || '',
    popularity: track.popularity || 0,
    durationMs: track.duration_ms,
    artistId: track.artists[0]?.id
  };
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetch150k() {
  console.log('🎵 Fetching 150k songs from Spotify...\n');
  console.log(`Target: ${TARGET.toLocaleString()}\n`);
  
  const songs = new Map();
  const start = Date.now();
  let queries = 0;
  
  // Strategy: Genre + Year + Pagination
  for (const genre of GENRES) {
    if (songs.size >= TARGET) break;
    
    console.log(`\n📊 Genre: ${genre}`);
    
    for (const year of YEARS) {
      if (songs.size >= TARGET) break;
      
      // Paginate through results (Spotify max 1000 per query)
      for (let offset = 0; offset < 1000; offset += 50) {
        if (songs.size >= TARGET) break;
        
        const query = `genre:"${genre}" year:${year}`;
        
        try {
          await sleep(RATE_LIMIT);
          const tracks = await search(query, 50, offset);
          queries++;
          
          for (const track of tracks) {
            const data = extractTrack(track);
            if (data && !songs.has(data.spotifyId)) {
              songs.set(data.spotifyId, data);
            }
          }
          
          // Break if no more results
          if (tracks.length < 50) break;
          
        } catch (e) {
          console.warn(`  ⚠️  Error: ${e.message}`);
          await sleep(1000); // Backoff on error
        }
      }
      
      // Progress every 5k
      if (songs.size % 5000 < 50) {
        const elapsed = (Date.now() - start) / 1000;
        const rate = songs.size / elapsed;
        const eta = (TARGET - songs.size) / rate / 3600;
        console.log(`  ✓ ${songs.size.toLocaleString()}/${TARGET.toLocaleString()} | ${rate.toFixed(1)}/s | ETA: ${eta.toFixed(1)}h`);
      }
    }
  }
  
  console.log(`\n✅ Collected ${songs.size.toLocaleString()} unique tracks`);
  console.log(`Queries: ${queries.toLocaleString()}`);
  console.log(`Time: ${((Date.now() - start) / 60000).toFixed(1)} minutes\n`);
  
  // Convert to staging format
  const staging = {
    results: Array.from(songs.values()).map(song => ({
      isrc: song.isrc,
      spotify: {
        found: true,
        spotify_id: song.spotifyId,
        isrc: song.isrc,
        raw: {
          id: song.spotifyId,
          name: song.title,
          artists: [{ name: song.artist, id: song.artistId }],
          album: { name: song.album, release_date: song.releaseDate },
          duration_ms: song.durationMs,
          popularity: song.popularity,
          external_ids: { isrc: song.isrc }
        }
      }
    }))
  };
  
  // Save
  const outPath = path.join(__dirname, 'staging-results-150k.json');
  fs.writeFileSync(outPath, JSON.stringify(staging, null, 2));
  console.log(`💾 Saved to: ${outPath}\n`);
  
  return songs.size;
}

fetch150k().catch(console.error);
