const { Client } = require('pg');
const { randomUUID } = require('crypto');

const POSTGRES_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!POSTGRES_URL) {
  console.error('❌ POSTGRES_URL or DATABASE_URL is required.');
  process.exit(1);
}

const client = new Client({
  connectionString: POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

const BATCH_SIZE = 1000;

async function addSpotifyIdentifiers() {
  await client.connect();
  console.log('🔍 Finding verified tracks with Spotify IDs but missing identifiers...');

  const { rows: missing } = await client.query(`
    SELECT t.id AS "trackId", t."spotifyId"
    FROM "VerifiedTrack" t
    LEFT JOIN "TrackIdentifier" i ON i."trackId" = t.id AND i.type = 'spotify'
    WHERE t."spotifyId" IS NOT NULL
      AND i.id IS NULL
  `);

  if (missing.length === 0) {
    console.log('✅ All tracks already have Spotify identifiers.');
    await client.end();
    return;
  }

  console.log(`👍 ${missing.length.toLocaleString()} tracks need Spotify identifiers.`);

  let inserted = 0;
  const total = missing.length;

  for (let start = 0; start < total; start += BATCH_SIZE) {
    const chunk = missing.slice(start, start + BATCH_SIZE);
    const values = [];
    const params = [];
    let index = 1;

    for (const row of chunk) {
      const createdAt = new Date().toISOString();
      values.push(`($${index++}, $${index++}, $${index++}, $${index++}, $${index++})`);
      params.push(randomUUID());
      params.push(row.trackId);
      params.push('spotify');
      params.push(row.spotifyId);
      params.push(createdAt);
    }

    const sql = `
      INSERT INTO "TrackIdentifier" (id, "trackId", type, value, "createdAt")
      VALUES ${values.join(', ')}
      ON CONFLICT (type, value) DO NOTHING
    `;

    await client.query(sql, params);
    inserted += chunk.length;
    console.log(`   ▸ Processed ${Math.min(start + chunk.length, total).toLocaleString()} / ${total.toLocaleString()}`);
  }

  const { rows: counts } = await client.query(`
    SELECT COUNT(*)::int AS count
    FROM "TrackIdentifier"
    WHERE type = 'spotify'
  `);

  console.log(`\n✅ Finished. Spotify identifiers: ${counts[0].count.toLocaleString()}`);
  await client.end();
}

addSpotifyIdentifiers().catch(error => {
  console.error('❌ Failed to add Spotify identifiers:', error);
  process.exit(1);
});
