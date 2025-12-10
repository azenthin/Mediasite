/**
 * Backfill country data for existing 334K+ tracks
 * Fetches artist country from Spotify and updates VerifiedTrack
 * 
 * Usage:
 * SPOTIFY_CLIENT_ID=xxx SPOTIFY_CLIENT_SECRET=yyy node scripts/backfill-country.js
 * 
 * Checkpoint support:
 * - Creates checkpoint-country.json to track progress
 * - Resumes from last checkpoint if interrupted
 * - Takes ~5 hours for 334K tracks at 20 req/sec
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Manually parse .env file for Spotify credentials
const envPath = path.join(__dirname, '..', '.env');
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf8');
} catch (err) {
  console.warn('⚠️  Could not read .env file');
}

envContent.split(/\r?\n/).forEach(line => {
  line = line.trim();
  if (line.startsWith('SPOTIFY_CLIENT_ID=')) {
    process.env.SPOTIFY_CLIENT_ID = line.substring('SPOTIFY_CLIENT_ID='.length);
  }
  if (line.startsWith('SPOTIFY_CLIENT_SECRET=')) {
    process.env.SPOTIFY_CLIENT_SECRET = line.substring('SPOTIFY_CLIENT_SECRET='.length);
  }
});

// Configuration
const BATCH_SIZE = 500;           // Tracks to process per batch
const PARALLEL_BATCHES = 2;       // Reduced to 2 for safe rate limiting (was 10)
const SPOTIFY_BATCH_SIZE = 50;    // Artist lookups per API call (Spotify max: 50)
const RATE_LIMIT_MS = 100;        // 100ms between requests = 10 req/sec per batch (well below 14 req/sec limit)
const CHECKPOINT_FILE = path.join(__dirname, 'checkpoint-country.json');

let spotifyToken = null;

/**
 * Get Spotify access token
 */
async function getSpotifyToken() {
  const now = Date.now();
  
  // Return cached token if still valid (with 30s buffer)
  if (spotifyToken && now < tokenExpireTime - 30000) {
    return spotifyToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET required');
  }

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
      },
      body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Spotify auth failed: ${response.status} ${text}`);
    }

    const data = await response.json();
    spotifyToken = data.access_token;
    tokenExpireTime = Date.now() + (data.expires_in || 3600) * 1000;
    return spotifyToken;
  } catch (error) {
    console.error('❌ Token fetch error:', error.message);
    throw error;
  }
}

let tokenExpireTime = 0;

/**
 * Fetch artist data in batch (up to 50 per request)
 */
async function fetchArtistsBatch(artistIds) {
  if (!spotifyToken) {
    spotifyToken = await getSpotifyToken();
  }

  const ids = artistIds.filter(id => id).join(',');
  if (!ids) return {};

  await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));

  const response = await fetch(`https://api.spotify.com/v1/artists?ids=${ids}`, {
    headers: { 'Authorization': `Bearer ${spotifyToken}` }
  });

  if (response.status === 401) {
    spotifyToken = await getSpotifyToken();
    return fetchArtistsBatch(artistIds);
  }

  if (!response.ok) {
    console.warn(`⚠️  Artist fetch failed: ${response.statusText}`);
    return {};
  }

  const data = await response.json();
  const artistMap = {};

  (data.artists || []).forEach(artist => {
    if (artist && artist.id) {
      artistMap[artist.id] = {
        country: artist.country || null,
        popularity: artist.popularity,
        followers: artist.followers?.total
      };
    }
  });

  return artistMap;
}

/**
 * Load checkpoint to resume from last position
 */
function loadCheckpoint() {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
    } catch (err) {
      console.warn('⚠️  Failed to load checkpoint, starting fresh');
    }
  }
  return { processed: 0, updated: 0, failed: 0, lastId: null };
}

/**
 * Save checkpoint
 */
function saveCheckpoint(checkpoint) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
}

/**
 * Process a single batch of tracks
 */
async function processBatch(tracks, batchNum, totalBatches) {
  const batchStart = Date.now();
  let updated = 0;
  let failed = 0;

  // Get track IDs for this batch
  const trackIds = tracks.map(t => t.id);
  
  // Query TrackIdentifier to get Spotify artist IDs
  // Note: We need to get the Spotify ID from TrackIdentifier table
  // The TrackIdentifier table stores Spotify track IDs, but we also need artist IDs
  // For now, we'll fetch artist data directly using Spotify's search/API
  // This is a simplified approach - ideal would be to store artistSpotifyId in VerifiedTrack
  
  // Fetch tracks with their basic info to search for artist on Spotify
  const tracksToUpdate = await prisma.verifiedTrack.findMany({
    where: { 
      id: { in: trackIds },
      artistCountry: null  // Only update tracks that don't have country yet
    },
    select: {
      id: true,
      artist: true,
      title: true
    }
  });

  if (tracksToUpdate.length === 0) {
    return { updated: 0, failed: 0 };
  }

  // Search for each artist on Spotify to get artist details
  const artistMap = {};
  const trackToArtistId = {};

  for (const track of tracksToUpdate) {
    // Try to find artist via search
    if (!spotifyToken) {
      spotifyToken = await getSpotifyToken();
    }

    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));

    try {
      const searchResponse = await fetch(
        `https://api.spotify.com/v1/search?q=artist:${encodeURIComponent(track.artist)}&type=artist&limit=1`,
        { headers: { 'Authorization': `Bearer ${spotifyToken}` } }
      );

      if (searchResponse.status === 401) {
        spotifyToken = await getSpotifyToken();
        // Retry with fresh token
        const retryResponse = await fetch(
          `https://api.spotify.com/v1/search?q=artist:${encodeURIComponent(track.artist)}&type=artist&limit=1`,
          { headers: { 'Authorization': `Bearer ${spotifyToken}` } }
        );
        if (!retryResponse.ok) throw new Error('Search failed');
        const data = await retryResponse.json();
        const artist = data.artists?.items?.[0];
        if (artist) {
          trackToArtistId[track.id] = artist.id;
          artistMap[artist.id] = {
            country: artist.country || null,
            followers: artist.followers?.total
          };
        }
      } else if (searchResponse.ok) {
        const data = await searchResponse.json();
        const artist = data.artists?.items?.[0];
        if (artist) {
          trackToArtistId[track.id] = artist.id;
          artistMap[artist.id] = {
            country: artist.country || null,
            followers: artist.followers?.total
          };
        }
      }
    } catch (err) {
      console.warn(`⚠️  Artist search failed for "${track.artist}": ${err.message}`);
      failed++;
    }
  }

  // Update tracks with country data
  for (const track of tracksToUpdate) {
    const artistId = trackToArtistId[track.id];
    if (!artistId || !artistMap[artistId]) {
      failed++;
      continue;
    }

    try {
      await prisma.verifiedTrack.update({
        where: { id: track.id },
        data: { 
          artistCountry: artistMap[artistId].country || null,
          artistFollowers: artistMap[artistId].followers || null
        }
      });
      updated++;
    } catch (err) {
      console.error(`Failed to update track ${track.id}:`, err.message);
      failed++;
    }
  }

  return { updated, failed };
}

/**
 * Main backfill process with parallel batch processing
 */
async function backfillCountry() {
  const startTime = Date.now();
  const checkpoint = loadCheckpoint();

  try {
    console.log('🌍 BACKFILL COUNTRY DATA\n');
    console.log('⚙️  Configuration:');
    console.log(`   - Batch size: ${BATCH_SIZE} tracks`);
    console.log(`   - Parallel batches: ${PARALLEL_BATCHES} (${PARALLEL_BATCHES}x speedup)`);
    console.log(`   - Artist batch: ${SPOTIFY_BATCH_SIZE} artists`);
    console.log(`   - Rate limit: ${RATE_LIMIT_MS}ms between requests per batch\n`);

    // Get total count
    console.log('📊 Analyzing database...');
    const total = await prisma.verifiedTrack.count();
    console.log(`   ✓ Total tracks: ${total.toLocaleString()}\n`);

    // Count already-filled tracks
    const filled = await prisma.verifiedTrack.count({
      where: { artistCountry: { not: null } }
    });
    console.log(`   ✓ Already filled: ${filled.toLocaleString()}`);
    console.log(`   ✓ Remaining: ${(total - filled).toLocaleString()}\n`);

    let processed = checkpoint.processed;
    let updated = checkpoint.updated;
    let failed = checkpoint.failed;
    let batchNum = 0;

    // Process in parallel batches
    while (processed < total) {
      batchNum++;

      // Fetch PARALLEL_BATCHES number of track batches
      const batchPromises = [];
      const trackBatches = [];

      for (let i = 0; i < PARALLEL_BATCHES; i++) {
        if (processed + (i * BATCH_SIZE) >= total) break;

        const promise = prisma.verifiedTrack.findMany({
          where: { artistCountry: null },
          select: { id: true, artist: true },
          skip: processed + (i * BATCH_SIZE),
          take: BATCH_SIZE,
          orderBy: { createdAt: 'asc' }
        });

        batchPromises.push(promise);
      }

      const results = await Promise.all(batchPromises);

      // Check if we got any tracks
      let totalTracks = 0;
      results.forEach(r => totalTracks += r.length);

      if (totalTracks === 0) break;

      console.log(`\n📦 Batch group ${batchNum}: Processing ${totalTracks} tracks in ${results.length} parallel batches...`);
      const groupStart = Date.now();

      // Process each batch in parallel
      const batchResults = await Promise.all(
        results.map((tracks, idx) => processBatch(tracks, batchNum * PARALLEL_BATCHES + idx + 1, 'n/a'))
      );

      // Aggregate results
      batchResults.forEach(result => {
        updated += result.updated;
        failed += result.failed;
      });

      processed += totalTracks;

      const elapsed = ((Date.now() - groupStart) / 1000).toFixed(1);
      const rate = (totalTracks / (elapsed || 1)).toFixed(0);
      const progress = ((processed / total) * 100).toFixed(1);
      const timeLeft = ((total - processed) / (processed / ((Date.now() - startTime) / 1000))).toFixed(0);

      console.log(`   📊 Progress: ${progress}% | Updated: ${updated.toLocaleString()} | Failed: ${failed} | Rate: ${rate} tracks/sec`);
      console.log(`   ⏱️  Time left: ~${timeLeft}s`);

      // Save checkpoint
      checkpoint.processed = processed;
      checkpoint.updated = updated;
      checkpoint.failed = failed;
      saveCheckpoint(checkpoint);
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    const avgRate = (processed / (Date.now() - startTime) * 1000).toFixed(0);

    console.log(`\n${'='.repeat(60)}`);
    console.log('✅ BACKFILL COMPLETE!\n');
    console.log('📊 Statistics:');
    console.log(`   Updated: ${updated.toLocaleString()}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Processed: ${processed.toLocaleString()}\n`);
    console.log('⏱️  Performance:');
    console.log(`   Total time: ${totalTime}s (~${(totalTime / 60).toFixed(1)} minutes)`);
    console.log(`   Average rate: ${avgRate} tracks/sec (${PARALLEL_BATCHES}x parallel)`);
    console.log(`   Estimated speedup: ~${PARALLEL_BATCHES}x faster than sequential`);
    console.log(`${'='.repeat(60)}\n`);

    // Clean up checkpoint
    fs.unlinkSync(CHECKPOINT_FILE);

  } catch (error) {
    console.error('Fatal error:', error);
    saveCheckpoint(checkpoint);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

backfillCountry();
