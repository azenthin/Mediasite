/**
 * Fetch songs from MusicBrainz for ingestion pipeline
 * 
 * This script queries MusicBrainz for popular recordings with ISRCs,
 * prepares them in the format expected by the ingestion pipeline,
 * and saves to a CSV file ready for processing.
 * 
 * MusicBrainz rate limit: 1 request per second
 * Target: 10,000 songs with ISRCs for high-quality ingestion
 */

const fs = require('fs');
const path = require('path');

// Load .env file
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const MB_API = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'MediasiteIngestion/1.0 (https://github.com/azenthin/mediasite)';
const RATE_LIMIT_MS = 1000; // 1 request per second
const BATCH_SIZE = 100; // Fetch 100 recordings per request
const TARGET_SONGS = 10000;

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
  console.warn('WARNING: SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET not set. Spotify enrichment will be skipped.');
}

const SPOTIFY_RATE_LIMIT = 100; // 100ms between Spotify requests

/**
 * Sleep helper for rate limiting
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch recordings from MusicBrainz with pagination
 * Focus on recordings with ISRCs (higher quality for ingestion)
 */
async function fetchRecordings(offset = 0, limit = BATCH_SIZE) {
  const url = `${MB_API}/recording?query=isrc:*%20AND%20status:official&limit=${limit}&offset=${offset}&fmt=json`;
  
  console.log(`Fetching recordings ${offset} to ${offset + limit}...`);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`MusicBrainz API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Get ISRC for a recording from MusicBrainz
 */
async function getRecordingDetails(mbid) {
  const url = `${MB_API}/recording/${mbid}?inc=isrcs+artist-credits+releases&fmt=json`;
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    console.warn(`Failed to fetch details for ${mbid}: ${response.status}`);
    return null;
  }

  const data = await response.json();
  return data;
}

/**
 * Extract artist name from MusicBrainz artist-credit
 */
function extractArtistName(artistCredit) {
  if (!artistCredit || !Array.isArray(artistCredit)) {
    return 'Unknown Artist';
  }
  return artistCredit.map(ac => ac.name || ac.artist?.name || 'Unknown').join(', ');
}

/**
 * Get Spotify access token
 */
async function getSpotifyToken() {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    return null;
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
    console.warn(`Spotify auth failed: ${response.status}`);
    return null;
  }
  
  const data = await response.json();
  return data.access_token;
}

/**
 * Search Spotify by ISRC and enrich with Spotify data
 */
async function enrichWithSpotify(token, isrc, artist, title) {
  if (!token) return null;
  
  try {
    // Search by ISRC first (most accurate)
    const url = `https://api.spotify.com/v1/search?q=isrc:${isrc}&type=track&limit=1`;
    
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const track = data.tracks?.items?.[0];
    
    if (!track) return null;
    
    // Get artist details for genres
    let artistGenres = [];
    if (track.artists?.[0]?.id) {
      await sleep(SPOTIFY_RATE_LIMIT);
      const artistResponse = await fetch(`https://api.spotify.com/v1/artists/${track.artists[0].id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (artistResponse.ok) {
        const artistData = await artistResponse.json();
        artistGenres = artistData.genres || [];
      }
    }
    
    return {
      spotifyId: track.id,
      spotifyUrl: track.external_urls?.spotify,
      previewUrl: track.preview_url,
      popularity: track.popularity || 0,
      albumName: track.album?.name,
      albumId: track.album?.id,
      releaseDate: track.album?.release_date,
      durationMs: track.duration_ms,
      explicit: track.explicit || false,
      trackNumber: track.track_number,
      discNumber: track.disc_number,
      albumImages: track.album?.images?.map(img => img.url) || [],
      artistId: track.artists?.[0]?.id,
      artistGenres: artistGenres,
      uri: track.uri,
      isPlayable: track.is_playable !== false
    };
  } catch (error) {
    console.warn(`Spotify enrichment failed for ${isrc}: ${error.message}`);
    return null;
  }
}

/**
 * Main function to fetch and prepare songs
 */
async function fetchSongs() {
  console.log('=== MusicBrainz Song Fetcher with Spotify Enrichment ===\n');
  console.log(`Target: ${TARGET_SONGS} songs with ISRCs`);
  console.log(`Rate limit: ${RATE_LIMIT_MS}ms between MusicBrainz requests\n`);

  // Get Spotify token for enrichment
  const spotifyToken = await getSpotifyToken();
  if (spotifyToken) {
    console.log('✓ Spotify authenticated - enrichment enabled\n');
  } else {
    console.log('⚠ Spotify not configured - enrichment disabled\n');
  }

  const songs = [];
  const seen = new Set(); // Deduplicate by MBID
  let offset = 0;
  let totalFetched = 0;
  let consecutiveErrors = 0;
  let spotifyEnriched = 0;

  const startTime = Date.now();

  while (songs.length < TARGET_SONGS && consecutiveErrors < 5) {
    try {
      // Fetch batch of recordings
      const data = await fetchRecordings(offset, BATCH_SIZE);
      
      if (!data.recordings || data.recordings.length === 0) {
        console.log('No more recordings available');
        break;
      }

      console.log(`Got ${data.recordings.length} recordings from MusicBrainz`);
      
      // Process each recording
      for (const recording of data.recordings) {
        if (songs.length >= TARGET_SONGS) break;
        if (seen.has(recording.id)) continue;
        
        seen.add(recording.id);
        
        // Extract basic info
        const title = recording.title || 'Unknown Title';
        const artist = extractArtistName(recording['artist-credit']);
        const mbid = recording.id;
        
        // Get ISRCs from the response (some are included in search results)
        let isrcs = recording.isrcs || [];
        
        // If no ISRC in search results, fetch details (rate limited)
        if (isrcs.length === 0 && songs.length < TARGET_SONGS) {
          await sleep(RATE_LIMIT_MS);
          const details = await getRecordingDetails(mbid);
          if (details && details.isrcs) {
            isrcs = details.isrcs;
          }
        }
        
        // Skip if no ISRC found
        if (isrcs.length === 0) continue;
        
        const isrc = isrcs[0]; // Use first ISRC
        
        // Try to enrich with Spotify data
        let spotifyData = null;
        if (spotifyToken) {
          await sleep(SPOTIFY_RATE_LIMIT);
          spotifyData = await enrichWithSpotify(spotifyToken, isrc, artist, title);
          if (spotifyData) spotifyEnriched++;
        }
        
        const songData = {
          artist,
          title,
          isrc,
          mbid,
          provider: 'musicbrainz',
          ...(spotifyData && {
            spotifyId: spotifyData.spotifyId,
            spotifyUrl: spotifyData.spotifyUrl,
            previewUrl: spotifyData.previewUrl,
            popularity: spotifyData.popularity,
            albumName: spotifyData.albumName,
            albumId: spotifyData.albumId,
            releaseDate: spotifyData.releaseDate,
            durationMs: spotifyData.durationMs,
            explicit: spotifyData.explicit,
            trackNumber: spotifyData.trackNumber,
            discNumber: spotifyData.discNumber,
            albumImages: spotifyData.albumImages.join('|'),
            artistId: spotifyData.artistId,
            artistGenres: spotifyData.artistGenres.join(','),
            uri: spotifyData.uri,
            isPlayable: spotifyData.isPlayable
          })
        };
        
        songs.push(songData);
        
        if (songs.length % 100 === 0) {
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = songs.length / elapsed;
          const remaining = TARGET_SONGS - songs.length;
          const eta = remaining / rate;
          
          console.log(`Progress: ${songs.length}/${TARGET_SONGS} songs (${rate.toFixed(2)}/sec, ETA: ${(eta / 60).toFixed(1)}m)`);
        }
      }
      
      offset += BATCH_SIZE;
      consecutiveErrors = 0;
      
      // Rate limit between batches
      await sleep(RATE_LIMIT_MS);
      
    } catch (error) {
      console.error(`Error fetching batch at offset ${offset}:`, error.message);
      consecutiveErrors++;
      await sleep(RATE_LIMIT_MS * 5); // Longer wait on error
    }
  }

  console.log(`\nFetch complete: ${songs.length} songs collected`);
  
  // Save to CSV
  const outputPath = path.join(__dirname, 'sources', 'musicbrainz-10k.csv');
  const outputDir = path.dirname(outputPath);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  // Create CSV content with all fields
  const csvHeader = 'Artist,Title,ISRC,MBID,Provider,SpotifyId,SpotifyUrl,PreviewUrl,Popularity,AlbumName,AlbumId,ReleaseDate,DurationMs,Explicit,TrackNumber,DiscNumber,AlbumImages,ArtistId,ArtistGenres,Uri,IsPlayable\n';
  const csvRows = songs.map(song => {
    const escapeCsv = (str) => str ? `"${String(str).replace(/"/g, '""')}"` : '""';
    return [
      escapeCsv(song.artist),
      escapeCsv(song.title),
      escapeCsv(song.isrc),
      escapeCsv(song.mbid),
      escapeCsv(song.provider),
      escapeCsv(song.spotifyId || ''),
      escapeCsv(song.spotifyUrl || ''),
      escapeCsv(song.previewUrl || ''),
      song.popularity || '',
      escapeCsv(song.albumName || ''),
      escapeCsv(song.albumId || ''),
      escapeCsv(song.releaseDate || ''),
      song.durationMs || '',
      song.explicit ? 'true' : 'false',
      song.trackNumber || '',
      song.discNumber || '',
      escapeCsv(song.albumImages || ''),
  const metadata = {
    fetchedAt: new Date().toISOString(),
    totalSongs: songs.length,
    uniqueArtists: new Set(songs.map(s => s.artist)).size,
    source: 'MusicBrainz',
    spotifyEnriched: spotifyEnriched,
    enrichmentRate: `${(spotifyEnriched/songs.length*100).toFixed(1)}%`,
    rateLimit: `${RATE_LIMIT_MS}ms`,
    durationSeconds: (Date.now() - startTime) / 1000,
    avgPopularity: songs.filter(s => s.popularity).length > 0 
      ? (songs.reduce((sum, s) => sum + (s.popularity || 0), 0) / songs.filter(s => s.popularity).length).toFixed(1)
      : 'N/A',
  
  const csvContent = csvHeader + csvRows;
  fs.writeFileSync(outputPath, csvContent, 'utf8');
  
  console.log(`\nSaved to: ${outputPath}`);
  console.log(`File size: ${(csvContent.length / 1024).toFixed(2)} KB`);
  
  console.log('=== Sample (first 5 songs) ===');
  songs.slice(0, 5).forEach((song, i) => {
    console.log(`${i + 1}. ${song.artist} - ${song.title}`);
    console.log(`   ISRC: ${song.isrc}, MBID: ${song.mbid}`);
    if (song.spotifyId) {
      console.log(`   Spotify: ${song.spotifyId}, Pop: ${song.popularity}, Genres: ${song.artistGenres || 'N/A'}`);
    }
  });otalSongs: songs.length,
    uniqueArtists: new Set(songs.map(s => s.artist)).size,
    source: 'MusicBrainz',
    rateLimit: `${RATE_LIMIT_MS}ms`,
    durationSeconds: (Date.now() - startTime) / 1000,
    nextSteps: [
      'Review CSV for quality',
      'Run: npm run ingest:sample -- --source=musicbrainz-10k.csv',
      'Check staging output for canonicality scores',
      'Run: npm run ingest:upsert (requires CONFIRM_UPSERT=yes)'
    ]
  };
  
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
  console.log(`Metadata saved to: ${metadataPath}\n`);
  
  // Print sample
  console.log('=== Sample (first 5 songs) ===');
  songs.slice(0, 5).forEach((song, i) => {
    console.log(`${i + 1}. ${song.artist} - ${song.title}`);
    console.log(`   ISRC: ${song.isrc}, MBID: ${song.mbid}`);
  });
  
  console.log('\n=== Next Steps ===');
  console.log('1. Review CSV: scripts/ingest/sources/musicbrainz-10k.csv');
  console.log('2. Run ingestion: npm run ingest:sample -- --source=musicbrainz-10k.csv');
  console.log('3. Review staging: scripts/ingest/staging/*.json');
  console.log('4. Upsert to DB: CONFIRM_UPSERT=yes npm run ingest:upsert');
  console.log('5. Check metrics: curl http://localhost:3000/api/ingest/status');
  
  return songs;
}

// Run if executed directly
if (require.main === module) {
  fetchSongs().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { fetchSongs };
