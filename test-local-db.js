#!/usr/bin/env node
/**
 * Quick test to verify the local audio_features.db is accessible and working
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'audio_features.db');

console.log(`🔍 Testing local database: ${dbPath}\n`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Failed to connect to database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to audio_features.db');
});

// Test 1: Count total songs
db.get('SELECT COUNT(*) as count FROM features', (err, row) => {
  if (err) {
    console.error('❌ Error counting songs:', err);
    db.close();
    process.exit(1);
  }
  console.log(`📊 Total songs in database: ${row.count}`);
});

// Test 2: Get songs in BPM range (80-120, typical for chill music)
db.all(
  `SELECT title, artist, bpm, energy, danceability FROM features 
   WHERE bpm BETWEEN 80 AND 120 
   ORDER BY ABS(bpm - 100) ASC 
   LIMIT 5`,
  (err, rows) => {
    if (err) {
      console.error('❌ Error querying by BPM:', err);
      db.close();
      process.exit(1);
    }
    console.log(`\n🎵 Sample songs (BPM 80-120, sorted by closeness to 100):`);
    rows.forEach((row, i) => {
      console.log(
        `  ${i + 1}. ${row.artist || 'Unknown'} - ${row.title || 'Unknown'}` +
        ` [BPM: ${row.bpm}, Energy: ${row.energy?.toFixed(2) || 'N/A'}, Dance: ${row.danceability?.toFixed(2) || 'N/A'}]`
      );
    });
  }
);

// Test 3: Check how many songs have audio features
db.get(
  `SELECT 
    COUNT(CASE WHEN bpm IS NOT NULL THEN 1 END) as with_bpm,
    COUNT(CASE WHEN energy IS NOT NULL THEN 1 END) as with_energy,
    COUNT(CASE WHEN danceability IS NOT NULL THEN 1 END) as with_danceability
   FROM features`,
  (err, row) => {
    if (err) {
      console.error('❌ Error checking features:', err);
      db.close();
      process.exit(1);
    }
    console.log(`\n📈 Audio features coverage:`);
    console.log(`  - With BPM: ${row.with_bpm}`);
    console.log(`  - With Energy: ${row.with_energy}`);
    console.log(`  - With Danceability: ${row.with_danceability}`);
    
    db.close();
    console.log(`\n✅ Database test completed successfully!\n`);
  }
);
