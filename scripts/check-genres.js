const fs = require('fs');

const data = JSON.parse(fs.readFileSync('scripts/ingest/staging-results.json', 'utf8'));
const sample = data.results.slice(0, 5);

console.log('Checking genre data in staging-results.json:\n');
sample.forEach((track, i) => {
  console.log(`${i + 1}. "${track.title}" by ${track.artist}`);
  
  const genres = track.spotify?.raw?.artists?.[0]?.genres;
  if (genres && genres.length > 0) {
    console.log(`   Spotify Genres: ${genres.join(', ')}`);
  } else {
    console.log(`   Spotify Genres: None`);
  }
  console.log('');
});
