import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

async function exportFromProduction() {
  // Create a Prisma client pointing to production database
  const prodPrisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgres://63a0923e268bd27d7f5f3b17890e7b98ccf3d3c1e1e4484ccc23f7929ace9372:sk_mAMjp1g6mtRnL6HcHWNaU@db.prisma.io:5432/?sslmode=require'
      }
    }
  });

  try {
    console.log('🔗 Connecting to production PostgreSQL database...');
    
    // Count tracks
    const count = await prodPrisma.verifiedTrack.count();
    console.log(`✅ Connected! Found ${count} VerifiedTrack records`);

    // Fetch all tracks in batches to avoid memory issues
    console.log('📥 Fetching tracks in batches (10,000 at a time)...');
    
    const batchSize = 10000;
    let offset = 0;
    const allTracks = [];

    while (offset < count) {
      const batch = await prodPrisma.verifiedTrack.findMany({
        skip: offset,
        take: batchSize,
        select: {
          id: true,
          internalUuid: true,
          isrc: true,
          title: true,
          artist: true,
          album: true,
          releaseDate: true,
          duration: true,
          explicit: true,
          trackPopularity: true,
          artistPopularity: true,
          primaryGenre: true,
          genres: true,
          mood: true,
          danceability: true,
          energy: true,
          key: true,
          loudness: true,
          mode: true,
          speechiness: true,
          acousticness: true,
          instrumentalness: true,
          liveness: true,
          valence: true,
          tempo: true,
          timeSignature: true,
          verifiedAt: true,
          createdAt: true,
          updatedAt: true,
        }
      });

      allTracks.push(...batch);
      console.log(`  ✅ Fetched ${allTracks.length}/${count} tracks`);
      offset += batchSize;
    }

    // Fetch identifiers too
    console.log('📥 Fetching TrackIdentifiers...');
    const identifiers = await prodPrisma.trackIdentifier.findMany({
      take: 1000000  // Fetch up to 1M identifiers
    });
    console.log(`✅ Fetched ${identifiers.length} identifiers`);

    // Save to JSON file
    const exportData = {
      exportDate: new Date().toISOString(),
      verifiedTracks: allTracks,
      trackIdentifiers: identifiers,
      stats: {
        totalTracks: allTracks.length,
        totalIdentifiers: identifiers.length
      }
    };

    const outputPath = './scripts/production-export.json';
    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
    console.log(`✅ Exported to ${outputPath}`);
    console.log(`📊 Total: ${allTracks.length} tracks, ${identifiers.length} identifiers`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prodPrisma.$disconnect();
  }
}

exportFromProduction();
