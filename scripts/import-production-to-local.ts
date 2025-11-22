import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

// Create local SQLite client
const localPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./prisma/dev.db'
    }
  }
});

async function importToLocal() {
  try {
    console.log('📂 Reading production export file...');
    const data = JSON.parse(fs.readFileSync('./scripts/production-export.json', 'utf-8'));
    const { verifiedTracks, trackIdentifiers } = data;

    console.log(`\n📊 Import data:`);
    console.log(`   - Tracks: ${verifiedTracks.length}`);
    console.log(`   - Identifiers: ${trackIdentifiers.length}`);

    // Import tracks in batches (insert directly with raw SQL for speed)
    console.log('\n📥 Importing VerifiedTracks...');
    const trackBatchSize = 1000;
    let successfulTracks = 0;
    
    for (let i = 0; i < verifiedTracks.length; i += trackBatchSize) {
      const batch = verifiedTracks.slice(i, i + trackBatchSize);
      
      // Insert each track, skipping duplicates
      for (const track of batch) {
        try {
          await localPrisma.verifiedTrack.create({
            data: track
          });
          successfulTracks++;
        } catch (err: any) {
          // Skip duplicates (unique constraint on isrc)
          if (err.code !== 'P2002') throw err;
        }
      }

      const progress = Math.min(i + trackBatchSize, verifiedTracks.length);
      console.log(`  ✅ Processed ${progress}/${verifiedTracks.length} tracks (${successfulTracks} inserted)`);
    }

    // Import identifiers in batches
    console.log('\n📥 Importing TrackIdentifiers...');
    const identBatchSize = 5000;
    let successfulIdents = 0;
    
    for (let i = 0; i < trackIdentifiers.length; i += identBatchSize) {
      const batch = trackIdentifiers.slice(i, i + identBatchSize);
      
      // Insert each identifier, skipping duplicates
      for (const ident of batch) {
        try {
          await localPrisma.trackIdentifier.create({
            data: ident
          });
          successfulIdents++;
        } catch (err: any) {
          // Skip duplicates (unique constraint on type, value)
          if (err.code !== 'P2002') throw err;
        }
      }

      const progress = Math.min(i + identBatchSize, trackIdentifiers.length);
      console.log(`  ✅ Processed ${progress}/${trackIdentifiers.length} identifiers (${successfulIdents} inserted)`);
    }

    console.log('\n✅ Import complete!');
    
    // Verify counts
    const trackCount = await localPrisma.verifiedTrack.count();
    const identCount = await localPrisma.trackIdentifier.count();
    console.log(`\n📊 Final counts:`);
    console.log(`   - VerifiedTracks: ${trackCount}`);
    console.log(`   - TrackIdentifiers: ${identCount}`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await localPrisma.$disconnect();
  }
}

importToLocal();
