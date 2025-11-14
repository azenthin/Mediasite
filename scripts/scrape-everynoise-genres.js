/**
 * Scrape Every Noise at Once for Spotify's full genre list
 * This gets the actual 6000+ genres Spotify uses internally
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

function fetchEveryNoise() {
  return new Promise((resolve, reject) => {
    console.log('🌐 Fetching genre list from everynoise.com...\n');
    
    https.get('https://everynoise.com/everynoise1d.cgi?scope=all', (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('✅ Downloaded page\n');
        
        // Extract genres from HTML
        // Format: <div class="genre" style="...">genre-name</div>
        const genreMatches = data.match(/class="genre[^>]*>([^<]+)</g);
        
        if (!genreMatches) {
          console.error('❌ Could not parse genres from page');
          reject(new Error('Parse failed'));
          return;
        }
        
        const genres = genreMatches
          .map(match => match.replace(/class="genre[^>]*>/, '').trim())
          .filter(g => g && g.length > 0)
          .sort();
        
        console.log(`📊 Found ${genres.length} genres from Every Noise at Once\n`);
        
        // Save to file
        const output = {
          meta: {
            source: 'Every Noise at Once (everynoise.com)',
            description: 'Spotify\'s internal genre taxonomy',
            scrapedAt: new Date().toISOString(),
            totalGenres: genres.length,
            note: 'These are the actual genres used by Spotify\'s classification system'
          },
          genres: genres
        };
        
        const outputPath = path.join(__dirname, 'everynoise-spotify-genres.json');
        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
        
        console.log(`💾 Saved to: ${outputPath}\n`);
        console.log(`${'='.repeat(60)}`);
        console.log(`TOTAL SPOTIFY GENRES: ${genres.length}`);
        console.log(`${'='.repeat(60)}\n`);
        
        // Show sample
        console.log('Sample genres (first 50):\n');
        genres.slice(0, 50).forEach((g, i) => {
          if (i % 5 === 0 && i > 0) console.log('');
          process.stdout.write(g.padEnd(20));
          if ((i + 1) % 5 === 0) console.log('');
        });
        
        console.log('\n\n✅ Complete! Use this file for comprehensive music fetching.\n');
        
        resolve(genres);
      });
    }).on('error', (err) => {
      console.error('❌ Error fetching:', err.message);
      reject(err);
    });
  });
}

fetchEveryNoise().catch(console.error);
