/**
 * HYBRID STRATEGY: Playlists first (instant), then genre searches (comprehensive)
 * Target: 100k songs in ~30-40 minutes instead of 2-3 hours
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

const TARGET = 100000;
const RATE_LIMIT = 50; // Faster for playlists

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

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

async function getPlaylist(playlistId) {
  const token = await getToken();
  const url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;
  
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!response.ok) return [];
  
  const data = await response.json();
  return data.items.map(item => item.track).filter(Boolean);
}

async function searchPlaylists(query, limit = 50) {
  const token = await getToken();
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=playlist&limit=${limit}`;
  
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!response.ok) return [];
  
  const data = await response.json();
  return data.playlists.items;
}

async function searchTracks(query, limit = 50, offset = 0) {
  const token = await getToken();
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}&offset=${offset}`;
  
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!response.ok) return [];
  
  const data = await response.json();
  return data.tracks.items;
}

async function phase1Playlists(songs) {
  console.log('\n🎵 PHASE 1: Fetching from curated playlists (fast)...\n');
  
  const playlistCategories = [
    'top hits', 'popular', 'trending', 'viral', 'charts',
    'pop', 'rock', 'hip hop', 'edm', 'latin', 'k-pop',
    'country', 'r&b', 'indie', 'metal', 'jazz', 'blues'
  ];
  
  let playlistCount = 0;
  
  for (const category of playlistCategories) {
    if (songs.size >= TARGET * 0.8) break; // Stop at 80% of target
    
    console.log(`  📂 Category: ${category}`);
    
    try {
      await sleep(RATE_LIMIT);
      const playlists = await searchPlaylists(category, 50);
      
      for (const playlist of playlists.slice(0, 20)) { // Top 20 playlists per category
        if (songs.size >= TARGET * 0.8) break;
        
        try {
          await sleep(RATE_LIMIT);
          const tracks = await getPlaylist(playlist.id);
          playlistCount++;
          
          for (const track of tracks) {
            const data = extractTrack(track);
            if (data && !songs.has(data.spotifyId)) {
              songs.set(data.spotifyId, data);
            }
          }
          
          if (songs.size % 5000 < 100) {
            console.log(`    ✓ ${songs.size.toLocaleString()} songs (${playlistCount} playlists)`);
          }
        } catch (e) {
          // Skip failed playlists
        }
      }
    } catch (e) {
      console.warn(`  ⚠️  ${category}: ${e.message}`);
    }
  }
  
  console.log(`\n✅ Phase 1 complete: ${songs.size.toLocaleString()} songs from ${playlistCount} playlists\n`);
}

async function phase2Searches(songs) {
  console.log('🔍 PHASE 2: Genre searches to reach target (comprehensive)...\n');
  
  const genres = ['pop', 'rock', 'hip-hop', 'edm', 'latin', 'country', 'r&b', 'indie', 'metal', 'jazz'];
  const years = [2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015];
  
  for (const genre of genres) {
    if (songs.size >= TARGET) break;
    
    console.log(`  🎸 Genre: ${genre}`);
    
    for (const year of years) {
      if (songs.size >= TARGET) break;
      
      for (let offset = 0; offset < 500; offset += 50) {
        if (songs.size >= TARGET) break;
        
        try {
          await sleep(RATE_LIMIT);
          const tracks = await searchTracks(`genre:"${genre}" year:${year}`, 50, offset);
          
          for (const track of tracks) {
            const data = extractTrack(track);
            if (data && !songs.has(data.spotifyId)) {
              songs.set(data.spotifyId, data);
            }
          }
          
          if (tracks.length < 50) break; // No more results
          
          if (songs.size % 2000 < 50) {
            console.log(`    ✓ ${songs.size.toLocaleString()} songs`);
          }
        } catch (e) {
          break;
        }
      }
    }
  }
  
  console.log(`\n✅ Phase 2 complete: ${songs.size.toLocaleString()} total songs\n`);
}

async function fetchHybrid() {
  console.log('🚀 HYBRID STRATEGY: Playlists → Genre Searches\n');
  console.log(`Target: ${TARGET.toLocaleString()} songs\n`);
  
  const songs = new Map();
  const start = Date.now();
  
  // Phase 1: Playlists (fast)
  await phase1Playlists(songs);
  
  // Phase 2: Genre searches (if needed)
  if (songs.size < TARGET) {
    await phase2Searches(songs);
  }
  
  const elapsed = (Date.now() - start) / 60000;
  console.log(`\n🎉 COMPLETE: ${songs.size.toLocaleString()} songs in ${elapsed.toFixed(1)} minutes\n`);
  
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
  const outPath = path.join(__dirname, 'ingest', 'staging-results-100k.json');
  fs.writeFileSync(outPath, JSON.stringify(staging, null, 2));
  console.log(`💾 Saved to: ${outPath}\n`);
  
  console.log('📊 Next steps:');
  console.log('1. Run: node scripts/actual-upsert-100k.js');
  console.log('2. Enrichment will add genres and popularity');
  console.log('3. Database will have ~100k songs\n');
  
  return songs.size;
}

fetchHybrid().catch(console.error);
