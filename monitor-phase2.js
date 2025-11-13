#!/usr/bin/env node

/**
 * Monitor Phase 2 Import Progress
 * Checks database size and song count periodically
 */

const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');

async function checkProgress() {
  try {
    const dbPath = path.resolve(process.cwd(), 'enhanced_music.db');
    
    if (!fs.existsSync(dbPath)) {
      console.log('❌ Database not found yet');
      return;
    }

    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    // Get song count
    const countResult = await db.get(`SELECT COUNT(*) as count FROM songs`);
    const totalSongs = countResult.count;

    // Get database file size
    const stats = fs.statSync(dbPath);
    const dbSize = (stats.size / 1024 / 1024).toFixed(2); // MB

    // Get sample stats
    const withBpm = await db.get(`SELECT COUNT(*) as count FROM songs WHERE bpm IS NOT NULL`);
    const withGenres = await db.get(`SELECT COUNT(*) as count FROM songs WHERE genres IS NOT NULL`);
    const withEnergy = await db.get(`SELECT COUNT(*) as count FROM songs WHERE energy IS NOT NULL`);

    // Get unique artists
    const uniqueArtists = await db.get(`
      SELECT COUNT(DISTINCT artist) as count FROM songs
    `);

    // Get genre coverage
    const genreSample = await db.all(`
      SELECT DISTINCT json_extract(genres, '$[0]') as genre, COUNT(*) as count
      FROM songs
      WHERE genres IS NOT NULL
      GROUP BY json_extract(genres, '$[0]')
      ORDER BY count DESC
      LIMIT 5
    `);

    console.log('\n📊 PHASE 2 IMPORT PROGRESS');
    console.log('='.repeat(70));
    console.log(`\n📈 Database Status:`);
    console.log(`   Songs Imported: ${totalSongs.toLocaleString()}`);
    console.log(`   Database Size: ${dbSize} MB`);
    console.log(`   Target: 40,000 songs`);
    console.log(`   Progress: ${((totalSongs / 40000) * 100).toFixed(1)}%`);

    console.log(`\n🎵 Data Quality:`);
    console.log(`   With BPM: ${withBpm.count.toLocaleString()} (${((withBpm.count / Math.max(totalSongs, 1)) * 100).toFixed(1)}%)`);
    console.log(`   With Genres: ${withGenres.count.toLocaleString()} (${((withGenres.count / Math.max(totalSongs, 1)) * 100).toFixed(1)}%)`);
    console.log(`   With Energy: ${withEnergy.count.toLocaleString()} (${((withEnergy.count / Math.max(totalSongs, 1)) * 100).toFixed(1)}%)`);
    console.log(`   Unique Artists: ${uniqueArtists.count.toLocaleString()}`);

    if (genreSample.length > 0) {
      console.log(`\n🎸 Top Genres:`);
      genreSample.forEach((g, i) => {
        console.log(`   ${i + 1}. ${g.genre || 'Unknown'}: ${g.count.toLocaleString()} songs`);
      });
    }

    console.log(`\n⏱️  Status: ${totalSongs >= 40000 ? '✅ COMPLETE' : '⏳ IN PROGRESS'}`);
    console.log('='.repeat(70) + '\n');

    await db.close();
  } catch (err) {
    console.error('Error checking progress:', err.message);
  }
}

// Check every 30 seconds
console.log('🔍 Starting Phase 2 import monitor...');
console.log('Will check database every 30 seconds\n');

setInterval(() => {
  checkProgress();
}, 30000);

// Initial check
checkProgress();
