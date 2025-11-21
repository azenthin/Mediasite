/**
 * Fix missing identifiers in Vercel Postgres
 * Migrates TrackIdentifier data that failed during bulk insert
 */

const sqlite3 = require('sqlite3').verbose();
const { Client } = require('pg');
const path = require('path');

const sqliteDbPath = path.join(process.cwd(), 'prisma', 'prisma', 'dev.db');
const POSTGRES_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!POSTGRES_URL) {
  console.error('❌ POSTGRES_URL required');
  process.exit(1);
}

const pgClient = new Client({
  connectionString: POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const BATCH_SIZE = 10000;

async function migrateIdentifiers() {
  console.log('🚀 Fixing TrackIdentifier migration\n');

  const sqliteDb = new sqlite3.Database(sqliteDbPath, sqlite3.OPEN_READONLY);

  const sqliteAll = (query, params = []) => {
    return new Promise((resolve, reject) => {
      sqliteDb.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  };

  try {
    await pgClient.connect();
    console.log('✓ Connected to databases\n');

    // Get all identifiers from SQLite
    console.log('📊 Analyzing source data...');
    const allIdentifiers = await sqliteAll('SELECT * FROM TrackIdentifier ORDER BY createdAt');
    console.log(`   Found ${allIdentifiers.length.toLocaleString()} identifiers in SQLite`);
    
    // Deduplicate by (trackId, type) - keep first occurrence
    const uniqueMap = new Map();
    for (const ident of allIdentifiers) {
      const key = `${ident.trackId}:${ident.type}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, ident);
      }
    }
    const uniqueIdentifiers = Array.from(uniqueMap.values());
    console.log(`   Deduplicated to ${uniqueIdentifiers.length.toLocaleString()} unique identifiers\n`);

    // Delete existing identifiers to avoid conflicts
    console.log('🗑️  Clearing existing identifiers...');
    await pgClient.query('DELETE FROM "TrackIdentifier"');
    console.log('   ✓ Cleared\n');

    // Insert in batches
    const totalBatches = Math.ceil(uniqueIdentifiers.length / BATCH_SIZE);
    let inserted = 0;

    for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
      const start = batchNum * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, uniqueIdentifiers.length);
      const batch = uniqueIdentifiers.slice(start, end);

      console.log(`📦 Batch ${batchNum + 1}/${totalBatches} (${start}-${end})...`);

      const values = [];
      const params = [];
      let paramIndex = 1;

      for (const ident of batch) {
        const createdAt = ident.createdAt ? new Date(parseInt(ident.createdAt)).toISOString() : new Date().toISOString();
        values.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
        params.push(ident.id);
        params.push(ident.trackId);
        params.push(ident.type);
        params.push(ident.value);
        params.push(createdAt);
      }

      try {
        await pgClient.query(`
          INSERT INTO "TrackIdentifier" (id, "trackId", type, value, "createdAt")
          VALUES ${values.join(', ')}
          ON CONFLICT (id) DO NOTHING
        `, params);
        inserted += batch.length;
        console.log(`   ✓ Inserted ${inserted.toLocaleString()} / ${uniqueIdentifiers.length.toLocaleString()}`);
      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
      }
    }

    // Verify
    const result = await pgClient.query('SELECT COUNT(*) FROM "TrackIdentifier"');
    console.log(`\n✅ Complete! ${parseInt(result.rows[0].count).toLocaleString()} identifiers in Postgres`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    sqliteDb.close();
    await pgClient.end();
  }
}

migrateIdentifiers().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
