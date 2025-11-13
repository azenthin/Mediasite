/**
 * Fetch popular songs from Spotify for ingestion pipeline
 * 
 * This script fetches the most popular/recent tracks from Spotify playlists,
 * ensuring we get songs that:
 * 1. ARE on Spotify (playback URLs available)
 * 2. Have ISRCs (required by ingestion pipeline)
 * 3. Are popular/mainstream (high engagement potential)
 * 
 * Strategy: Query Spotify's featured/popular playlists, extract unique tracks
 * Target: 10,000 songs with guaranteed Spotify + ISRC data
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

const TARGET_SONGS = process.env.TARGET_SONGS ? parseInt(process.env.TARGET_SONGS, 10) : 10000;
const RATE_LIMIT_MS = 100; // Conservative rate limit

/**
 * Get Spotify access token
 */
async function getAccessToken() {
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
  return data.access_token;
}

/**
 * Search Spotify for tracks by query
 */
async function searchTracks(token, query, limit = 50, offset = 0) {
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}&offset=${offset}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    console.warn(`Search failed for "${query}": ${response.status}`);
    return [];
  }
  
  const data = await response.json();
  return data.tracks?.items || [];
}

/**
 * Get tracks from a Spotify playlist
 */
async function getPlaylistTracks(token, playlistId) {
  const url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    console.warn(`Playlist fetch failed: ${response.status}`);
    return [];
  }
  
  const data = await response.json();
  return data.items?.map(item => item.track).filter(Boolean) || [];
}

/**
 * Get featured playlists from Spotify
 */
async function getFeaturedPlaylists(token, limit = 20) {
  const url = `https://api.spotify.com/v1/browse/featured-playlists?limit=${limit}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    console.warn(`Featured playlists fetch failed: ${response.status}`);
    return [];
  }
  
  const data = await response.json();
  return data.playlists?.items || [];
}

/**
 * Extract clean track data
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
 * Main fetch function
 */
async function fetchSpotifyPopular() {
  console.log('=== Spotify Popular Songs Fetcher ===\n');
  console.log(`Target: ${TARGET_SONGS} songs`);
  console.log(`Rate limit: ${RATE_LIMIT_MS}ms between requests\n`);
  
  const token = await getAccessToken();
  console.log('✓ Spotify authenticated\n');
  
  const songs = new Map(); // Use Map to dedupe by Spotify ID
  const startTime = Date.now();
  
  // Strategy 1: Featured playlists (most popular/curated content)
  console.log('Fetching featured playlists...');
  const playlists = await getFeaturedPlaylists(token, 50);
  console.log(`Found ${playlists.length} featured playlists\n`);
  
  for (const playlist of playlists) {
    if (songs.size >= TARGET_SONGS) break;
    
    console.log(`Fetching: ${playlist.name} (${playlist.tracks?.total || 0} tracks)`);
    await sleep(RATE_LIMIT_MS);
    
    const tracks = await getPlaylistTracks(token, playlist.id);
    
    for (const track of tracks) {
      if (songs.size >= TARGET_SONGS) break;
      
      const data = extractTrackData(track);
      if (data && data.isrc && !songs.has(data.spotifyId)) {
        songs.set(data.spotifyId, data);
      }
    }
    
    if (songs.size % 500 === 0 || songs.size >= TARGET_SONGS) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = songs.size / elapsed;
      console.log(`  Progress: ${songs.size}/${TARGET_SONGS} songs (${rate.toFixed(1)}/sec)`);
    }
  }
  
  // Strategy 2: Genre-based searches (if we need more)
  if (songs.size < TARGET_SONGS) {
    console.log(`\nNeed ${TARGET_SONGS - songs.size} more songs, searching by genre...\n`);
    
    const genres = [
      'pop', 'rock', 'hip-hop', 'electronic', 'indie', 'r&b',
      'country', 'jazz', 'classical', 'latin', 'metal', 'folk',
      'blues', 'reggae', 'dance', 'soul', 'punk', 'funk'
    ];
    
    for (const genre of genres) {
      if (songs.size >= TARGET_SONGS) break;
      
      console.log(`Searching: ${genre}`);
      await sleep(RATE_LIMIT_MS);
      
      // Search for recent popular tracks in this genre
      const query = `genre:${genre} year:2020-2024`;
      const tracks = await searchTracks(token, query, 50, 0);
      
      for (const track of tracks) {
        if (songs.size >= TARGET_SONGS) break;
        
        const data = extractTrackData(track);
        if (data && data.isrc && !songs.has(data.spotifyId)) {
          songs.set(data.spotifyId, data);
        }
      }
      
      if (songs.size % 500 === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = songs.size / elapsed;
        console.log(`  Progress: ${songs.size}/${TARGET_SONGS} songs (${rate.toFixed(1)}/sec)`);
      }
    }
  }
  
  // Strategy 3: Top artist tracks (if we still need more)
  if (songs.size < TARGET_SONGS) {
    console.log(`\nNeed ${TARGET_SONGS - songs.size} more songs, searching popular artists...\n`);
    
    const popularArtists = [
      'Taylor Swift', 'Drake', 'Bad Bunny', 'The Weeknd', 'Ed Sheeran',
      'Ariana Grande', 'Justin Bieber', 'Billie Eilish', 'Post Malone',
      'Dua Lipa', 'Travis Scott', 'Olivia Rodrigo', 'Harry Styles'
    ];
    
    for (const artist of popularArtists) {
      if (songs.size >= TARGET_SONGS) break;
      
      console.log(`Searching: ${artist}`);
      await sleep(RATE_LIMIT_MS);
      
      const tracks = await searchTracks(token, artist, 50, 0);
      
      for (const track of tracks) {
        if (songs.size >= TARGET_SONGS) break;
        
        const data = extractTrackData(track);
        if (data && data.isrc && !songs.has(data.spotifyId)) {
          songs.set(data.spotifyId, data);
        }
      }
    }
  }
  
  const songsArray = Array.from(songs.values());
  
  console.log(`\n=== Fetch Complete ===`);
  console.log(`Collected: ${songsArray.length} unique songs`);
  console.log(`Duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log(`All songs have ISRCs: ✓`);
  console.log(`All songs have Spotify IDs: ✓\n`);
  
  // Save to CSV
  const outputPath = path.join(__dirname, 'sources', 'spotify-popular-10k.csv');
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
  
  console.log(`Saved to: ${outputPath}`);
  console.log(`File size: ${(csvContent.length / 1024).toFixed(2)} KB\n`);
  
  // Save metadata
  const metadataPath = path.join(__dirname, 'sources', 'spotify-popular-10k.meta.json');
  const metadata = {
    fetchedAt: new Date().toISOString(),
    totalSongs: songsArray.length,
    uniqueArtists: new Set(songsArray.map(s => s.artist)).size,
    source: 'Spotify',
    avgPopularity: (songsArray.reduce((sum, s) => sum + s.popularity, 0) / songsArray.length).toFixed(1),
    withISRC: songsArray.filter(s => s.isrc).length,
    nextSteps: [
      'All songs are guaranteed to be on Spotify',
      'Run: npm run ingest:sample -- --source=spotify-popular-10k.csv',
      'Pipeline will enrich with MusicBrainz data (MBID, genres, canonical dates)',
      'High acceptance rate expected (Spotify ID + ISRC present)'
    ]
  };
  
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
  
  // Print sample
  console.log('=== Sample (first 5 songs) ===');
  songsArray.slice(0, 5).forEach((song, i) => {
    console.log(`${i + 1}. ${song.artist} - ${song.title}`);
    console.log(`   ISRC: ${song.isrc}, Spotify: ${song.spotifyId}, Pop: ${song.popularity}`);
  });
  
  console.log('\n=== Next Steps ===');
  console.log('1. Run ingestion: npm run ingest:sample -- --source=spotify-popular-10k.csv');
  console.log('2. Pipeline will enrich with MusicBrainz (MBID, genres, canonical dates)');
  console.log('3. High acceptance rate expected (all songs have Spotify ID + ISRC)');
  console.log('4. Upsert to DB: $env:CONFIRM_UPSERT="yes"; npm run ingest:upsert');
  
  return songsArray;
}

// Run if executed directly
if (require.main === module) {
  fetchSpotifyPopular().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { fetchSpotifyPopular };
