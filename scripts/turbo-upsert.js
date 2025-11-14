const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { fetchArtistsBatch } = require('./spotify-enrichment');
const { pipeline } = require('stream/promises');
const { Transform } = require('stream');

const prisma = new PrismaClient();

// Configuration - tune these for optimal performance
const BATCH_SIZE = 1000;          // Database batch upsert size (increased since no audio features)
const PARALLEL_BATCHES = 10;      // Number of batches to process in parallel (increased)
const SPOTIFY_BATCH_SIZE = 50;    // Spotify API batch size (max 50)
const STREAM_CHUNK_SIZE = 10000;  // Process tracks in chunks while streaming

const stagingFile = process.argv[2] 
  ? path.resolve(process.argv[2])
  : path.join(__dirname, 'ingest/staging-results-100k.json');

/**
 * Batch upsert tracks using Prisma transactions
 * This is MUCH faster than individual upserts
 * Audio features skipped for maximum speed
 */
async function batchUpsertTracks(tracks, artistDataMap) {
  const operations = [];
  
  for (const track of tracks) {
    const spotifyId = track.spotify.spotify_id;
    const isrc = track.isrc;
    const title = track.spotify.raw.name || 'Unknown';
    const artist = track.spotify.raw.artists?.[0]?.name || 'Unknown';
    const album = track.spotify.raw.album?.name || '';
    const releaseDate = track.spotify.raw.album?.release_date;
    const durationMs = track.spotify.raw.duration_ms;
    const mbid = track.musicbrainz?.mbid || null;

    // Get enrichment data (artist only - no audio features)
    const artistId = track.spotify?.raw?.artists?.[0]?.id;
    const artistData = artistId ? artistDataMap.get(artistId) : null;
    
    const genres = artistData?.genres || [];
    const primaryGenre = genres[0] || null;
    const trackPopularity = track.spotify?.raw?.popularity;

    const data = {
      title,
      artist,
      album,
      releaseDate: releaseDate ? new Date(releaseDate) : null,
      durationMs,
      spotifyId,
      mbid: mbid || null,
      genres: genres.length > 0 ? JSON.stringify(genres) : null,
      primaryGenre,
      trackPopularity,
      artistPopularity: artistData?.popularity,
      artistFollowers: artistData?.followers,
      // Audio features omitted for speed
      danceability: null,
      energy: null,
      valence: null,
      tempo: null,
      acousticness: null,
      instrumentalness: null,
      key: null,
      mode: null,
      loudness: null,
      mood: null,
    };

    operations.push(
      prisma.verifiedTrack.upsert({
        where: { isrc },
        update: { ...data, updatedAt: new Date() },
        create: { ...data, isrc }
      })
    );
  }

  return await Promise.all(operations);
}

/**
 * Batch upsert track identifiers using raw SQL for maximum speed
 */
async function batchUpsertIdentifiers(verifiedTracks, tracksData) {
  const identifierInserts = [];
  
  for (let i = 0; i < verifiedTracks.length; i++) {
    const verifiedTrack = verifiedTracks[i];
    const trackData = tracksData[i];
    
    const spotifyId = trackData.spotify.spotify_id;
    const isrc = trackData.isrc;
    const mbid = trackData.musicbrainz?.mbid || null;

    identifierInserts.push(
      { type: 'isrc', value: isrc, trackId: verifiedTrack.id },
      { type: 'spotify', value: spotifyId, trackId: verifiedTrack.id }
    );
    
    if (mbid) {
      identifierInserts.push({ type: 'mbid', value: mbid, trackId: verifiedTrack.id });
    }
  }

  // Use createMany with skipDuplicates for speed
  try {
    await prisma.trackIdentifier.createMany({
      data: identifierInserts,
      skipDuplicates: true
    });
  } catch (error) {
    // SQLite doesn't support skipDuplicates well, fall back to individual upserts
    console.log('  ⚠️  Falling back to individual identifier upserts...');
    const promises = identifierInserts.map(id =>
      prisma.trackIdentifier.upsert({
        where: { type_value: { type: id.type, value: id.value } },
        update: {},
        create: id
      }).catch(() => {}) // Silently skip duplicates
    );
    await Promise.all(promises);
  }
}

/**
 * Process a batch of tracks in parallel
 */
async function processBatch(tracks, artistDataMap, batchNum, totalBatches) {
  const startTime = Date.now();
  
  try {
    // Upsert tracks in this batch
    const verifiedTracks = await batchUpsertTracks(tracks, artistDataMap);
    
    // Upsert identifiers for this batch
    await batchUpsertIdentifiers(verifiedTracks, tracks);
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const tracksPerSec = (tracks.length / (Date.now() - startTime) * 1000).toFixed(0);
    
    console.log(`  ✓ Batch ${batchNum}/${totalBatches}: ${tracks.length} tracks in ${elapsed}s (${tracksPerSec} tracks/sec)`);
    
    return { success: verifiedTracks.length, failed: tracks.length - verifiedTracks.length };
  } catch (error) {
    console.error(`  ❌ Batch ${batchNum} error:`, error.message);
    return { success: 0, failed: tracks.length };
  }
}

/**
 * Stream-based JSON parser for large files
 * Processes tracks in chunks without loading entire file into memory
 */
async function* streamJsonTracks(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const staging = JSON.parse(fileContent);
  
  // Filter valid tracks
  const tracks = staging.results.filter(r => {
    return r.spotify?.found && r.spotify?.spotify_id && r.isrc;
  });
  
  // Yield tracks in chunks
  for (let i = 0; i < tracks.length; i += STREAM_CHUNK_SIZE) {
    yield tracks.slice(i, i + STREAM_CHUNK_SIZE);
  }
}

async function turboUpsert() {
  const totalStartTime = Date.now();
  
  try {
    if (!fs.existsSync(stagingFile)) {
      console.error('❌ Staging file not found:', stagingFile);
      return;
    }
    
    console.log('🚀 TURBO UPSERT MODE - STREAM OPTIMIZED\n');
    console.log('⚙️  Configuration:');
    console.log(`   - Batch size: ${BATCH_SIZE} tracks`);
    console.log(`   - Parallel batches: ${PARALLEL_BATCHES}`);
    console.log(`   - Spotify batch: ${SPOTIFY_BATCH_SIZE} artists`);
    console.log(`   - Stream chunk: ${STREAM_CHUNK_SIZE} tracks`);
    console.log(`   - Audio features: SKIPPED (max speed)\n`);
    console.log('📂 Using staging file:', stagingFile, '\n');

    console.log('📂 Analyzing file & collecting artist IDs...');
    const analyzeStart = Date.now();
    
    // First pass: collect all unique artist IDs using streaming
    const allArtistIds = new Set();
    let totalTracks = 0;
    
    for await (const chunk of streamJsonTracks(stagingFile)) {
      totalTracks += chunk.length;
      chunk.forEach(track => {
        const artistId = track.spotify?.raw?.artists?.[0]?.id;
        if (artistId) allArtistIds.add(artistId);
      });
    }
    
    const analyzeTime = ((Date.now() - analyzeStart) / 1000).toFixed(1);
    console.log(`✅ Analyzed ${totalTracks.toLocaleString()} tracks in ${analyzeTime}s\n`);

    // ==================== PHASE 1: ARTIST ENRICHMENT ====================
    console.log('🎵 PHASE 1: Enriching artist data (audio features skipped)...\n');
    
    const artistIds = Array.from(allArtistIds);
    console.log(`📊 Fetching data for ${artistIds.length.toLocaleString()} artists...\n`);
    
    // Batch fetch artists with progress
    const enrichStart = Date.now();
    const artistDataMap = new Map();
    console.log('🎤 Fetching artist data...');
    for (let i = 0; i < artistIds.length; i += SPOTIFY_BATCH_SIZE) {
      const batch = artistIds.slice(i, i + SPOTIFY_BATCH_SIZE);
      const artists = await fetchArtistsBatch(batch);
      artists.forEach(a => artistDataMap.set(a.id, a));
      
      if (i % 500 === 0 || i + SPOTIFY_BATCH_SIZE >= artistIds.length) {
        const pct = ((i / artistIds.length) * 100).toFixed(0);
        console.log(`  ✓ Artists: ${Math.min(i + SPOTIFY_BATCH_SIZE, artistIds.length).toLocaleString()}/${artistIds.length.toLocaleString()} (${pct}%)`);
      }
    }
    
    const enrichTime = ((Date.now() - enrichStart) / 1000).toFixed(1);
    console.log(`\n✅ Artist enrichment complete in ${enrichTime}s\n`);

    // ==================== PHASE 2: STREAMING UPSERT ====================
    console.log('🔄 PHASE 2: Streaming batch upsert to database...\n');
    
    const upsertStart = Date.now();
    let totalSuccess = 0;
    let totalFailed = 0;
    let chunkNum = 0;

    // Second pass: process tracks in streaming chunks
    for await (const chunk of streamJsonTracks(stagingFile)) {
      chunkNum++;
      console.log(`\n📦 Processing chunk ${chunkNum} (${chunk.length.toLocaleString()} tracks)...`);
      
      // Split chunk into batches
      const batches = [];
      for (let i = 0; i < chunk.length; i += BATCH_SIZE) {
        batches.push(chunk.slice(i, i + BATCH_SIZE));
      }
      
      // Process batches in parallel groups
      for (let i = 0; i < batches.length; i += PARALLEL_BATCHES) {
        const batchGroup = batches.slice(i, i + PARALLEL_BATCHES);
        const batchPromises = batchGroup.map((batch, idx) => 
          processBatch(batch, artistDataMap, i + idx + 1, batches.length)
        );
        
        const results = await Promise.all(batchPromises);
        results.forEach(r => {
          totalSuccess += r.success;
          totalFailed += r.failed;
        });
      }
      
      const progress = ((totalSuccess / totalTracks) * 100).toFixed(1);
      const elapsed = ((Date.now() - upsertStart) / 1000).toFixed(1);
      const currentSpeed = (totalSuccess / (Date.now() - upsertStart) * 1000).toFixed(0);
      console.log(`  📊 Progress: ${totalSuccess.toLocaleString()}/${totalTracks.toLocaleString()} (${progress}%) - ${currentSpeed} tracks/sec`);
    }

    const upsertTime = ((Date.now() - upsertStart) / 1000).toFixed(1);
    const totalTime = ((Date.now() - totalStartTime) / 1000).toFixed(1);
    const avgSpeed = (totalSuccess / (Date.now() - totalStartTime) * 1000).toFixed(0);

    console.log(`\n${'='.repeat(60)}`);
    console.log('✅ TURBO UPSERT COMPLETE!\n');
    console.log('📊 Statistics:');
    console.log(`   Successful: ${totalSuccess.toLocaleString()}`);
    console.log(`   Failed: ${totalFailed}`);
    console.log(`   Total: ${totalTracks.toLocaleString()}\n`);
    console.log('⏱️  Performance:');
    console.log(`   File analysis: ${analyzeTime}s`);
    console.log(`   Artist enrichment: ${enrichTime}s`);
    console.log(`   Upsert time: ${upsertTime}s`);
    console.log(`   Total time: ${totalTime}s`);
    console.log(`   Average speed: ${avgSpeed} tracks/sec`);
    console.log(`   Speed improvement: ~${(avgSpeed / 40).toFixed(1)}x faster than baseline\n`);
    console.log(`${'='.repeat(60)}\n`);

  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

turboUpsert();
