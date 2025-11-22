import { Client } from 'pg';
import * as fs from 'fs';

const connectionString = 'postgres://63a0923e268bd27d7f5f3b17890e7b98ccf3d3c1e1e4484ccc23f7929ace9372:sk_mAMjp1g6mtRnL6HcHWNaU@db.prisma.io:5432/?sslmode=require';

async function exportFromProduction() {
  const client = new Client({ connectionString });

  try {
    console.log('🔗 Connecting to production PostgreSQL database...');
    await client.connect();
    console.log('✅ Connected!');

    // Count tracks
    const countResult = await client.query('SELECT COUNT(*) FROM "VerifiedTrack"');
    const count = parseInt(countResult.rows[0].count);
    console.log(`📊 Found ${count} VerifiedTrack records`);

    // Fetch all tracks
    console.log('📥 Fetching all VerifiedTrack records...');
    const tracksResult = await client.query('SELECT * FROM "VerifiedTrack"');
    console.log(`✅ Fetched ${tracksResult.rows.length} tracks`);

    // Fetch all identifiers
    console.log('📥 Fetching all TrackIdentifier records...');
    const identifiersResult = await client.query('SELECT * FROM "TrackIdentifier"');
    console.log(`✅ Fetched ${identifiersResult.rows.length} identifiers`);

    // Save to JSON
    const exportData = {
      exportDate: new Date().toISOString(),
      verifiedTracks: tracksResult.rows,
      trackIdentifiers: identifiersResult.rows,
      stats: {
        totalTracks: tracksResult.rows.length,
        totalIdentifiers: identifiersResult.rows.length
      }
    };

    const outputPath = './scripts/production-export.json';
    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
    console.log(`\n✅ Successfully exported to ${outputPath}`);
    console.log(`📊 Summary: ${tracksResult.rows.length} tracks + ${identifiersResult.rows.length} identifiers`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.end();
  }
}

exportFromProduction();
