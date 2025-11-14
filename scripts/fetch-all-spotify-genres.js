/**
 * Fetch Every Noise genre list (text format)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

console.log('🌐 Fetching Spotify genre list from Every Noise at Once...\n');

https.get('https://everynoise.com/genrewordlist.txt', (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    const genres = data
      .split('\n')
      .map(g => g.trim())
      .filter(g => g && g.length > 0)
      .sort();
    
    console.log(`✅ Found ${genres.length} genres from Spotify's taxonomy\n`);
    
    // Save to file
    const output = {
      meta: {
        source: 'Every Noise at Once (everynoise.com)',
        description: 'Complete Spotify genre taxonomy',
        fetchedAt: new Date().toISOString(),
        totalGenres: genres.length,
        note: 'These are all genres used in Spotify\'s internal classification system'
      },
      genres: genres
    };
    
    const outputPath = path.join(__dirname, 'spotify-all-genres.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    
    console.log(`💾 Saved to: ${outputPath}\n`);
    console.log(`${'='.repeat(70)}`);
    console.log(`TOTAL SPOTIFY GENRES: ${genres.length.toLocaleString()}`);
    console.log(`${'='.repeat(70)}\n`);
    
    // Show samples from different parts
    console.log('Sample genres:\n');
    console.log('First 20:');
    genres.slice(0, 20).forEach((g, i) => {
      process.stdout.write(g.padEnd(25));
      if ((i + 1) % 3 === 0) console.log('');
    });
    
    console.log('\n\nMiddle 20:');
    const mid = Math.floor(genres.length / 2);
    genres.slice(mid, mid + 20).forEach((g, i) => {
      process.stdout.write(g.padEnd(25));
      if ((i + 1) % 3 === 0) console.log('');
    });
    
    console.log('\n\nLast 20:');
    genres.slice(-20).forEach((g, i) => {
      process.stdout.write(g.padEnd(25));
      if ((i + 1) % 3 === 0) console.log('');
    });
    
    console.log('\n\n✅ Complete! This is Spotify\'s full genre taxonomy.\n');
  });
}).on('error', (err) => {
  console.error('❌ Error:', err.message);
});
