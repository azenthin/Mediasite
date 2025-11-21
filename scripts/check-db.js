const { Client } = require('pg');

const pgClient = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  await pgClient.connect();
  
  const tracks = await pgClient.query('SELECT COUNT(*) FROM "VerifiedTrack"');
  const identifiers = await pgClient.query('SELECT COUNT(*) FROM "TrackIdentifier"');
  
  console.log('✅ Vercel Postgres Status:');
  console.log(`   Tracks: ${parseInt(tracks.rows[0].count).toLocaleString()}`);
  console.log(`   Identifiers: ${parseInt(identifiers.rows[0].count).toLocaleString()}`);
  
  // Check a sample track with identifiers
  const sample = await pgClient.query(`
    SELECT t.title, t.artist, t."primaryGenre", 
           COUNT(i.id) as identifier_count
    FROM "VerifiedTrack" t
    LEFT JOIN "TrackIdentifier" i ON i."trackId" = t.id
    WHERE t."primaryGenre" = 'pop'
    GROUP BY t.id, t.title, t.artist, t."primaryGenre"
    LIMIT 5
  `);
  
  console.log('\n📊 Sample pop tracks:');
  sample.rows.forEach(row => {
    console.log(`   ${row.title} - ${row.artist} (${row.identifier_count} identifiers)`);
  });
  
  await pgClient.end();
}

check().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
