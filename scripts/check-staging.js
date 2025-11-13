const fs = require('fs');

try {
  const data = JSON.parse(fs.readFileSync('scripts/ingest/staging-db.json', 'utf8'));
  const songs = Object.values(data);
  
  console.log(`\n✅ Total accepted songs in staging: ${songs.length}\n`);
  
  if (songs.length > 0) {
    console.log('📝 Sample songs ready to be added:\n');
    songs.slice(0, 15).forEach((s, idx) => {
      const spotifyId = s.identifiers?.find(id => id.provider === 'SPOTIFY')?.externalId || 'N/A';
      const isrc = s.identifiers?.find(id => id.provider === 'ISRC')?.externalId || 'N/A';
      const mbid = s.identifiers?.find(id => id.provider === 'MUSICBRAINZ')?.externalId || 'N/A';
      
      console.log(`${idx + 1}. "${s.title}" by ${s.artist}`);
      console.log(`   Spotify: ${spotifyId}`);
      console.log(`   ISRC: ${isrc}`);
      console.log(`   MBID: ${mbid}`);
      console.log(`   Score: ${s.canonicalityScore?.toFixed(3) || 'N/A'}\n`);
    });
    
    console.log('\n💡 To add these to the database, run:');
    console.log('   $env:CONFIRM_UPSERT="yes"; npm run ingest:upsert\n');
  } else {
    console.log('⏳ No songs in staging yet. Wait for the ingestion pipeline to accept some songs.\n');
  }
} catch (err) {
  console.error('❌ Error:', err.message);
  if (err.code === 'ENOENT') {
    console.log('\n⏳ Staging file not created yet. The ingestion pipeline needs to run first.\n');
  }
}
