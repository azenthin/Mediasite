/**
 * Migrate SQLite database to Vercel Postgres
 * 
 * This script exports all VerifiedTrack data from local SQLite
 * and imports it into the Vercel PostgreSQL database in batches
 * 
 * Usage:
 * 1. Set POSTGRES_URL environment variable with your Vercel database URL
 * 2. Run: node scripts/migrate-to-postgres.js
 */

const { PrismaClient } = require('@prisma/client');

// Source: Local SQLite
const sourcePrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./prisma/dev.db'
    }
  }
});

// Target: Vercel Postgres (from environment variable)
const POSTGRES_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!POSTGRES_URL || POSTGRES_URL.includes('file:')) {
  console.error('❌ Error: POSTGRES_URL environment variable is required');
  console.error('   Set it to your Vercel PostgreSQL connection string');
  console.error('   Example: POSTGRES_URL="postgresql://user:pass@host/db" node scripts/migrate-to-postgres.js');
  process.exit(1);
}

const targetPrisma = new PrismaClient({
  datasources: {
    db: {
      url: POSTGRES_URL
    }
  }
});

const BATCH_SIZE = 500; // Smaller batches for Postgres

async function migrateData() {
  console.log('🚀 Starting SQLite → PostgreSQL Migration\n');
  console.log('📂 Source: SQLite (file:./prisma/dev.db)');
  console.log(`📂 Target: PostgreSQL (${POSTGRES_URL.split('@')[1]?.split('/')[0] || 'hidden'})\n`);

  try {
    // Step 1: Count records in source
    console.log('📊 Step 1: Analyzing source database...');
    const sourceTrackCount = await sourcePrisma.verifiedTrack.count();
    const sourceIdentifierCount = await sourcePrisma.trackIdentifier.count();
    
    console.log(`   ✓ Found ${sourceTrackCount.toLocaleString()} tracks`);
    console.log(`   ✓ Found ${sourceIdentifierCount.toLocaleString()} identifiers\n`);

    if (sourceTrackCount === 0) {
      console.log('⚠️  No tracks found in source database. Nothing to migrate.');
      return;
    }

    // Step 2: Check target database
    console.log('📊 Step 2: Checking target database...');
    const targetTrackCount = await targetPrisma.verifiedTrack.count();
    console.log(`   ℹ️  Target currently has ${targetTrackCount.toLocaleString()} tracks\n`);

    const shouldProceed = targetTrackCount === 0 || 
      await promptUser(`Target database has ${targetTrackCount} tracks. Continue? (y/n): `);
    
    if (!shouldProceed) {
      console.log('❌ Migration cancelled by user');
      return;
    }

    // Step 3: Migrate tracks in batches
    console.log('🔄 Step 3: Migrating tracks...');
    const totalBatches = Math.ceil(sourceTrackCount / BATCH_SIZE);
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
      const skip = batchNum * BATCH_SIZE;
      const startTime = Date.now();

      console.log(`\n📦 Batch ${batchNum + 1}/${totalBatches} (${skip}-${skip + BATCH_SIZE})...`);

      // Fetch batch from source with identifiers
      const tracks = await sourcePrisma.verifiedTrack.findMany({
        skip,
        take: BATCH_SIZE,
        include: {
          identifiers: true
        }
      });

      // Process each track
      for (const track of tracks) {
        try {
          // Upsert track (use ISRC as unique identifier)
          const upsertedTrack = await targetPrisma.verifiedTrack.upsert({
            where: { isrc: track.isrc },
            update: {
              title: track.title,
              artist: track.artist,
              album: track.album,
              releaseDate: track.releaseDate,
              duration: track.duration,
              explicit: track.explicit,
              trackPopularity: track.trackPopularity,
              artistPopularity: track.artistPopularity,
              primaryGenre: track.primaryGenre,
              genres: track.genres,
              mood: track.mood,
              danceability: track.danceability,
              energy: track.energy,
              key: track.key,
              loudness: track.loudness,
              mode: track.mode,
              speechiness: track.speechiness,
              acousticness: track.acousticness,
              instrumentalness: track.instrumentalness,
              liveness: track.liveness,
              valence: track.valence,
              tempo: track.tempo,
              timeSignature: track.timeSignature,
              updatedAt: new Date()
            },
            create: {
              isrc: track.isrc,
              title: track.title,
              artist: track.artist,
              album: track.album,
              releaseDate: track.releaseDate,
              duration: track.duration,
              explicit: track.explicit,
              trackPopularity: track.trackPopularity,
              artistPopularity: track.artistPopularity,
              primaryGenre: track.primaryGenre,
              genres: track.genres,
              mood: track.mood,
              danceability: track.danceability,
              energy: track.energy,
              key: track.key,
              loudness: track.loudness,
              mode: track.mode,
              speechiness: track.speechiness,
              acousticness: track.acousticness,
              instrumentalness: track.instrumentalness,
              liveness: track.liveness,
              valence: track.valence,
              tempo: track.tempo,
              timeSignature: track.timeSignature,
              verifiedAt: track.verifiedAt,
              createdAt: track.createdAt,
              updatedAt: track.updatedAt
            }
          });

          // Upsert identifiers (Spotify, YouTube, etc.)
          for (const identifier of track.identifiers) {
            try {
              await targetPrisma.trackIdentifier.upsert({
                where: {
                  trackId_type: {
                    trackId: upsertedTrack.id,
                    type: identifier.type
                  }
                },
                update: {
                  value: identifier.value
                },
                create: {
                  trackId: upsertedTrack.id,
                  type: identifier.type,
                  value: identifier.value
                }
              });
            } catch (identifierError) {
              // Non-fatal: log but continue
              console.log(`   ⚠️  Failed to migrate identifier for track ${track.isrc}: ${identifierError.message}`);
            }
          }

          migratedCount++;
        } catch (error) {
          if (error.code === 'P2002') {
            // Unique constraint violation - track already exists
            skippedCount++;
          } else {
            console.error(`   ❌ Error migrating track ${track.isrc}:`, error.message);
            errorCount++;
          }
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
    const finalTargetCount = await targetPrisma.verifiedTrack.count();
    const finalIdentifierCount = await targetPrisma.trackIdentifier.count();
    
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
    await sourcePrisma.$disconnect();
    await targetPrisma.$disconnect();
  }
}

// Simple prompt for user confirmation
function promptUser(question) {
  return new Promise((resolve) => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    readline.question(question, (answer) => {
      readline.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

// Run migration
migrateData().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
