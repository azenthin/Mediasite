/**
 * Estimate how long the mega fetch will take
 */

const genreData = require('./all-spotify-genres.json');
const ALL_GENRES = genreData.genres;

console.log(`
${'='.repeat(80)}
📊 MEGA FETCH ESTIMATION
${'='.repeat(80)}

Configuration:
  • Total genres: ${ALL_GENRES.length.toLocaleString()}
  • Target per genre: 1,000 songs
  • Max total: 6,000,000 songs

Strategy:
  1. Direct genre search (up to 1000 results)
  2. Genre + year combinations (75 years × 200 results each)

API Rate Limiting:
  • Rate limit: 50ms per request = 20 req/sec
  • Spotify allows: 20 req/sec sustained

Estimated Requests:
  • Per genre (avg): 20-50 requests
  • Total requests: ${(ALL_GENRES.length * 35).toLocaleString()} requests
  
Estimated Time:
  • At 20 req/sec: ${((ALL_GENRES.length * 35) / 20 / 60).toFixed(0)} minutes (${((ALL_GENRES.length * 35) / 20 / 60 / 60).toFixed(1)} hours)
  • With processing: ${((ALL_GENRES.length * 35) / 20 / 60 * 1.2).toFixed(0)} minutes (${((ALL_GENRES.length * 35) / 20 / 60 / 60 * 1.2).toFixed(1)} hours)

Expected Results:
  • Songs found: 2-4 million (many genres have <1000 songs)
  • Genres with 1000 songs: ~30-40% (mainstream genres)
  • Genres with <100 songs: ~40-50% (niche genres)
  • Genres with 0 songs: ~10-20% (ultra-niche)

Disk Space:
  • Estimated file size: 2-4 GB (JSON format)
  • Database size after import: 5-8 GB (SQLite with indexes)

Checkpointing:
  • Auto-saves every 10 genres
  • Can resume from any point
  • Progress tracking in real-time

${'='.repeat(80)}

Sample Genres (random 20):
`);

const random = [];
for (let i = 0; i < 20; i++) {
  const idx = Math.floor(Math.random() * ALL_GENRES.length);
  random.push(ALL_GENRES[idx]);
}
random.sort();

random.forEach((g, i) => {
  process.stdout.write(`  ${g.padEnd(35)}`);
  if ((i + 1) % 2 === 0) console.log('');
});

console.log(`\n\n💡 Tip: Run in background overnight for best results!\n`);
