/**
 * Migrate SQLite database to Vercel Postgres
 * 
 * This script exports all VerifiedTrack data from local SQLite
 * and imports it into the Vercel PostgreSQL database in batches
 * 
 * Usage:
 * 1. Set POSTGRES_URL environment variable with your Vercel database URL
 * 2. Run: POSTGRES_URL="postgresql://..." node scripts/migrate-to-postgres.js
 */

const sqlite3 = require('sqlite3').verbose();
const { Client } = require('pg');
const path = require('path');

// Source: Local SQLite (in prisma/prisma subdirectory)
const sqliteDbPath = path.join(process.cwd(), 'prisma', 'prisma', 'dev.db');

// Target: Vercel Postgres (from environment variable)
const POSTGRES_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!POSTGRES_URL || POSTGRES_URL.includes('file:')) {
  console.error('❌ Error: POSTGRES_URL environment variable is required');
  console.error('   Set it to your Vercel PostgreSQL connection string');
  console.error('   Example: POSTGRES_URL="postgresql://user:pass@host/db" node scripts/migrate-to-postgres.js');
  process.exit(1);
}

const pgClient = new Client({
  connectionString: POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const BATCH_SIZE = 2000; // Optimized for bulk insert (2000 tracks × 29 params = ~58k params, under Postgres 65k limit)

async function migrateData() {
  console.log('🚀 Starting SQLite → PostgreSQL Migration\n');
  console.log('📂 Source: SQLite (file:./prisma/dev.db)');
  console.log(`📂 Target: PostgreSQL (${POSTGRES_URL.split('@')[1]?.split('/')[0] || 'hidden'})\n`);

  // Connect to SQLite
  const sqliteDb = new sqlite3.Database(sqliteDbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error('❌ Failed to connect to SQLite:', err.message);
      process.exit(1);
    }
  });

  // Promisify SQLite operations
  const sqliteAll = (query, params = []) => {
    return new Promise((resolve, reject) => {
      sqliteDb.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  };

  const sqliteGet = (query, params = []) => {
    return new Promise((resolve, reject) => {
      sqliteDb.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  };

  try {
    // Connect to Postgres
    console.log('🔌 Connecting to PostgreSQL...');
    await pgClient.connect();
    console.log('   ✓ Connected\n');

    // Step 1: Count records in source
    console.log('📊 Step 1: Analyzing source database...');
    const trackCountResult = await sqliteGet('SELECT COUNT(*) as count FROM VerifiedTrack');
    const sourceTrackCount = trackCountResult.count;
    const identifierCountResult = await sqliteGet('SELECT COUNT(*) as count FROM TrackIdentifier');
    const sourceIdentifierCount = identifierCountResult.count;
    
    console.log(`   ✓ Found ${sourceTrackCount.toLocaleString()} tracks`);
    console.log(`   ✓ Found ${sourceIdentifierCount.toLocaleString()} identifiers\n`);

    if (sourceTrackCount === 0) {
      console.log('⚠️  No tracks found in source database. Nothing to migrate.');
      return;
    }

    // Step 2: Check target database
    console.log('📊 Step 2: Checking target database...');
    const targetResult = await pgClient.query('SELECT COUNT(*) as count FROM "VerifiedTrack"');
    const targetTrackCount = parseInt(targetResult.rows[0].count);
    console.log(`   ℹ️  Target currently has ${targetTrackCount.toLocaleString()} tracks\n`);

    // Step 3: Migrate tracks in batches
    console.log('🔄 Step 3: Migrating tracks...');
    const totalBatches = Math.ceil(sourceTrackCount / BATCH_SIZE);
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
      const offset = batchNum * BATCH_SIZE;
      const startTime = Date.now();

      console.log(`\n📦 Batch ${batchNum + 1}/${totalBatches} (${offset}-${offset + BATCH_SIZE})...`);

      // Fetch batch from SQLite
      const tracks = await sqliteAll(`
        SELECT * FROM VerifiedTrack 
        ORDER BY createdAt 
        LIMIT ? OFFSET ?
      `, [BATCH_SIZE, offset]);

      if (tracks.length === 0) continue;

      // Build bulk insert for tracks
      const trackValues = [];
      const trackParams = [];
      let paramIndex = 1;

      for (const track of tracks) {
        // Map SQLite columns to Postgres columns
        const duration = track.durationMs ? Math.round(track.durationMs / 1000) : null;
        const explicit = false;
        const releaseDate = track.releaseDate ? new Date(parseInt(track.releaseDate)).toISOString() : null;
        const verifiedAt = track.verifiedAt ? new Date(parseInt(track.verifiedAt)).toISOString() : new Date().toISOString();
        const createdAt = track.createdAt ? new Date(parseInt(track.createdAt)).toISOString() : new Date().toISOString();
        const updatedAt = new Date().toISOString();

        const placeholders = [];
        for (let i = 0; i < 29; i++) {
          placeholders.push(`$${paramIndex++}`);
        }
        trackValues.push(`(${placeholders.join(', ')})`);

        // Push all parameters individually
        trackParams.push(track.id);
        trackParams.push(track.internalUuid);
        trackParams.push(track.isrc);
        trackParams.push(track.title);
        trackParams.push(track.artist);
        trackParams.push(track.album);
        trackParams.push(releaseDate);
        trackParams.push(duration);
        trackParams.push(explicit);
        trackParams.push(track.trackPopularity);
        trackParams.push(track.artistPopularity);
        trackParams.push(track.primaryGenre);
        trackParams.push(track.genres);
        trackParams.push(track.mood);
        trackParams.push(track.danceability);
        trackParams.push(track.energy);
        trackParams.push(track.key);
        trackParams.push(track.loudness);
        trackParams.push(track.mode);
        trackParams.push(null); // speechiness
        trackParams.push(track.acousticness);
        trackParams.push(track.instrumentalness);
        trackParams.push(null); // liveness
        trackParams.push(track.valence);
        trackParams.push(track.tempo);
        trackParams.push(null); // timeSignature
        trackParams.push(verifiedAt);
        trackParams.push(createdAt);
        trackParams.push(updatedAt);
      }

      // Bulk insert tracks
      try {
        await pgClient.query(`
          INSERT INTO "VerifiedTrack" (
            id, "internalUuid", isrc, title, artist, album, "releaseDate", duration, explicit,
            "trackPopularity", "artistPopularity", "primaryGenre", genres, mood,
            danceability, energy, key, loudness, mode, speechiness, acousticness,
            instrumentalness, liveness, valence, tempo, "timeSignature",
            "verifiedAt", "createdAt", "updatedAt"
          ) VALUES ${trackValues.join(', ')}
          ON CONFLICT (isrc) DO UPDATE SET
            title = EXCLUDED.title,
            artist = EXCLUDED.artist,
            album = EXCLUDED.album,
            "updatedAt" = EXCLUDED."updatedAt"
        `, trackParams);
        migratedCount += tracks.length;
      } catch (error) {
        console.error(`   ❌ Batch insert error: ${error.message}`);
        errorCount += tracks.length;
      }

      // Fetch ALL identifiers for this batch at once (much faster than individual queries)
      const trackIds = tracks.map(t => t.id);
      const placeholders = trackIds.map((_, i) => `?`).join(',');
      const allIdentifiersRaw = await sqliteAll(`SELECT * FROM TrackIdentifier WHERE trackId IN (${placeholders})`, trackIds);
      
      // Convert timestamps
      const allIdentifiers = allIdentifiersRaw.map(identifier => ({
        id: identifier.id,
        trackId: identifier.trackId,
        type: identifier.type,
        value: identifier.value,
        createdAt: identifier.createdAt ? new Date(parseInt(identifier.createdAt)).toISOString() : new Date().toISOString()
      }));

      if (allIdentifiers.length > 0) {
        const identValues = [];
        const identParams = [];
        let identIndex = 1;

        for (const ident of allIdentifiers) {
          identValues.push(`($${identIndex++}, $${identIndex++}, $${identIndex++}, $${identIndex++}, $${identIndex++})`);
          identParams.push(ident.id);
          identParams.push(ident.trackId);
          identParams.push(ident.type);
          identParams.push(ident.value);
          identParams.push(ident.createdAt);
        }

        try {
          await pgClient.query(`
            INSERT INTO "TrackIdentifier" (id, "trackId", type, value, "createdAt")
            VALUES ${identValues.join(', ')}
            ON CONFLICT ("trackId", type) DO UPDATE SET value = EXCLUDED.value
          `, identParams);
        } catch (error) {
          console.error(`   ⚠️  Identifier batch insert error: ${error.message}`);
        }
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = (tracks.length / (elapsed || 1)).toFixed(0);
      const progress = ((batchNum + 1) / totalBatches * 100).toFixed(1);
      
      console.log(`   ✓ Batch complete: ${tracks.length} processed in ${elapsed}s (${rate} tracks/sec)`);
      console.log(`   📊 Progress: ${progress}% | Migrated: ${migratedCount} | Skipped: ${skippedCount} | Errors: ${errorCount}`);
    }

    // Step 4: Final verification
    console.log('\n📊 Step 4: Verifying migration...');
    const finalResult = await pgClient.query('SELECT COUNT(*) as count FROM "VerifiedTrack"');
    const finalTargetCount = parseInt(finalResult.rows[0].count);
    const finalIdentResult = await pgClient.query('SELECT COUNT(*) as count FROM "TrackIdentifier"');
    const finalIdentifierCount = parseInt(finalIdentResult.rows[0].count);
    
    console.log(`   ✓ Target now has ${finalTargetCount.toLocaleString()} tracks`);
    console.log(`   ✓ Target now has ${finalIdentifierCount.toLocaleString()} identifiers\n`);

    console.log('✅ Migration Complete!\n');
    console.log('📊 Summary:');
    console.log(`   • Migrated: ${migratedCount.toLocaleString()} tracks`);
    console.log(`   • Skipped (duplicates): ${skippedCount.toLocaleString()}`);
    console.log(`   • Errors: ${errorCount.toLocaleString()}`);
    console.log(`   • Source total: ${sourceTrackCount.toLocaleString()}`);
    console.log(`   • Target total: ${finalTargetCount.toLocaleString()}\n`);

    if (errorCount > 0) {
      console.log('⚠️  Some tracks failed to migrate. Check the logs above for details.\n');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    sqliteDb.close();
    await pgClient.end();
  }
}

// Run migration
migrateData().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
