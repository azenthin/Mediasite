/**
 * Copy country data from local SQLite to Vercel Postgres
 * Fast direct copy without API calls
 */

const sqlite3 = require('sqlite3').verbose();
const pg = require('pg');

async function main() {
  try {
    console.log('🚀 Starting country data copy from SQLite to Postgres...\n');

    // Connect to SQLite
    const db = new sqlite3.Database('prisma/prisma/dev.db');
    console.log('✅ Connected to SQLite');

    // Connect to Postgres
    const pgClient = new pg.Client({
      connectionString: process.env.DATABASE_URL || 'postgres://63a0923e268bd27d7f5f3b17890e7b98ccf3d3c1e1e4484ccc23f7929ace9372:sk_mAMjp1g6mtRnL6HcHWNaU@db.prisma.io:5432/?sslmode=require',
      ssl: { rejectUnauthorized: false },
    });
    await pgClient.connect();
    console.log('✅ Connected to Postgres\n');

    // Get all tracks with country from SQLite
    console.log('📊 Fetching tracks with country from SQLite...');
    const tracks = await new Promise((resolve, reject) => {
      db.all(
        `SELECT id, country FROM VerifiedTrack WHERE country IS NOT NULL ORDER BY id`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    console.log(`✅ Found ${tracks.length} tracks with country data\n`);

    if (tracks.length === 0) {
      console.log('⚠️  No country data found in SQLite');
      await pgClient.end();
      db.close();
      return;
    }

    // Batch update in Postgres
    console.log('📥 Updating Postgres...');
    const batchSize = 1000;
    let updated = 0;

    for (let i = 0; i < tracks.length; i += batchSize) {
      const batch = tracks.slice(i, i + batchSize);
      
      // Build bulk update
      const values = batch.map((t, idx) => `($${idx * 2 + 1}, $${idx * 2 + 2})`).join(',');
      const params = batch.flatMap(t => [t.country, t.id]);
      
      await pgClient.query(
        `UPDATE "VerifiedTrack" AS t SET country = c.country
         FROM (VALUES ${values}) AS c(country, id) 
         WHERE t.id = c.id`,
        params
      );

      updated += batch.length;
      const progress = Math.round((updated / tracks.length) * 100);
      console.log(`   ✅ ${updated}/${tracks.length} tracks updated (${progress}%)`);
    }

    // Verify
    const result = await pgClient.query(
      `SELECT COUNT(*) as total, COUNT(country) as with_country, COUNT(DISTINCT country) as unique_countries FROM "VerifiedTrack"`
    );
    const stats = result.rows[0];

    console.log('\n📈 Final Statistics:');
    console.log(`   Total tracks: ${stats.total}`);
    console.log(`   Tracks with country: ${stats.with_country}`);
    console.log(`   Unique countries: ${stats.unique_countries}`);

    await pgClient.end();
    db.close();
    
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
