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

// Configuration
const BATCH_SIZE = 500;           // Tracks to process per batch
const SPOTIFY_BATCH_SIZE = 50;    // Artist lookups per API call (Spotify max: 50)
const RATE_LIMIT_MS = 50;         // 50ms between requests = 20 req/sec
const CHECKPOINT_FILE = path.join(__dirname, 'checkpoint-country.json');

let spotifyToken = null;

/**
 * Get Spotify access token
 */
async function getSpotifyToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET required');
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    throw new Error(`Spotify auth failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}

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
 * Main backfill process
 */
async function backfillCountry() {
  const startTime = Date.now();
  const checkpoint = loadCheckpoint();

  try {
    console.log('🌍 BACKFILL COUNTRY DATA\n');
    console.log('⚙️  Configuration:');
    console.log(`   - Batch size: ${BATCH_SIZE} tracks`);
    console.log(`   - Artist batch: ${SPOTIFY_BATCH_SIZE} artists`);
    console.log(`   - Rate limit: ${RATE_LIMIT_MS}ms between requests (20 req/sec)\n`);

    // Get total count
    console.log('📊 Analyzing database...');
    const total = await prisma.verifiedTrack.count();
    console.log(`   ✓ Total tracks: ${total.toLocaleString()}\n`);

    // Count already-filled tracks
    const filled = await prisma.verifiedTrack.count({
      where: { country: { not: null } }
    });
    console.log(`   ✓ Already filled: ${filled.toLocaleString()}`);
    console.log(`   ✓ Remaining: ${(total - filled).toLocaleString()}\n`);

    let processed = checkpoint.processed;
    let updated = checkpoint.updated;
    let failed = checkpoint.failed;
    let batchCount = 0;

    // Process in batches
    while (processed < total) {
      batchCount++;
      const batchStart = Date.now();

      // Fetch batch of tracks without country
      const tracks = await prisma.verifiedTrack.findMany({
        where: { country: null },
        select: { id: 'true', artist: true },
        skip: processed,
        take: BATCH_SIZE,
        orderBy: { createdAt: 'asc' }
      });

      if (tracks.length === 0) break;

      // Get unique artist IDs from tracks (need to refetch to get spotify raw data)
      const trackIds = tracks.map(t => t.id);
      const tracksWithArtistId = await prisma.verifiedTrack.findMany({
        where: { id: { in: trackIds } },
        select: {
          id: true,
          rawProvider: true
        }
      });

      // Extract artist IDs from raw provider data
      const artistIds = [];
      const trackIdToArtistId = {};

      tracksWithArtistId.forEach(track => {
        try {
          if (track.rawProvider) {
            const raw = JSON.parse(track.rawProvider);
            const artistId = raw.spotify?.raw?.artists?.[0]?.id;
            if (artistId) {
              artistIds.push(artistId);
              trackIdToArtistId[track.id] = artistId;
            }
          }
        } catch (err) {
          // Skip tracks with invalid JSON
        }
      });

      if (artistIds.length === 0) {
        processed += tracks.length;
        continue;
      }

      // Fetch artist data in batches of 50
      console.log(`\n📦 Batch ${batchCount}: Processing ${tracks.length} tracks...`);
      const artistMap = {};

      for (let i = 0; i < artistIds.length; i += SPOTIFY_BATCH_SIZE) {
        const batch = artistIds.slice(i, i + SPOTIFY_BATCH_SIZE);
        const batchData = await fetchArtistsBatch(batch);
        Object.assign(artistMap, batchData);

        const progress = Math.min(i + SPOTIFY_BATCH_SIZE, artistIds.length);
        console.log(`   ✓ Fetched ${progress}/${artistIds.length} artists`);
      }

      // Update tracks with country data
      for (const track of tracksWithArtistId) {
        const artistId = trackIdToArtistId[track.id];
        if (!artistId || !artistMap[artistId]) {
          failed++;
          continue;
        }

        try {
          await prisma.verifiedTrack.update({
            where: { id: track.id },
            data: { country: artistMap[artistId].country || null }
          });
          updated++;
        } catch (err) {
          console.warn(`   ⚠️  Failed to update track ${track.id}`);
          failed++;
        }
      }

      processed += tracks.length;

      const elapsed = ((Date.now() - batchStart) / 1000).toFixed(1);
      const rate = (tracks.length / (elapsed || 1)).toFixed(0);
      const progress = ((processed / total) * 100).toFixed(1);
      const timeLeft = ((total - processed) / (processed / ((Date.now() - startTime) / 1000))).toFixed(0);

      console.log(`   📊 Progress: ${progress}% | Updated: ${updated} | Failed: ${failed} | Rate: ${rate} tracks/sec`);
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
    console.log(`   Total time: ${totalTime}s`);
    console.log(`   Average rate: ${avgRate} tracks/sec`);
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
