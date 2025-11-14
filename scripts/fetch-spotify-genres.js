/**
 * Fetch all available genre seeds from Spotify API
 * This creates a comprehensive list for targeted music fetching
 */

const fs = require('fs');
const path = require('path');

// Manually parse .env file
const envPath = path.join(__dirname, '..', '.env');
const envFile = fs.readFileSync(envPath, 'utf8');

let SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET;
envFile.split(/\r?\n/).forEach(line => {
  line = line.trim();
  if (line.startsWith('SPOTIFY_CLIENT_ID=')) {
    SPOTIFY_CLIENT_ID = line.substring('SPOTIFY_CLIENT_ID='.length);
  }
  if (line.startsWith('SPOTIFY_CLIENT_SECRET=')) {
    SPOTIFY_CLIENT_SECRET = line.substring('SPOTIFY_CLIENT_SECRET='.length);
  }
});

async function getSpotifyToken() {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')
    },
    body: 'grant_type=client_credentials'
  });

  const data = await response.json();
  return data.access_token;
}

async function fetchSpotifyGenres() {
  try {
    console.log('🎵 Fetching available genre seeds from Spotify...\n');
    
    const token = await getSpotifyToken();
    console.log('✓ Got access token');
    
    const response = await fetch('https://api.spotify.com/v1/recommendations/available-genre-seeds', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✓ Response status:', response.status);
    const text = await response.text();
    console.log('✓ Response preview:', text.substring(0, 200));
    
    const data = JSON.parse(text);
    const genres = data.genres;
    
    console.log(`✅ Found ${genres.length} official Spotify genre seeds\n`);
    
    // Sort alphabetically
    genres.sort();
    
    // Save to file
    const outputPath = path.join(__dirname, 'spotify-genre-seeds.json');
    fs.writeFileSync(outputPath, JSON.stringify(genres, null, 2));
    console.log(`💾 Saved to: ${outputPath}\n`);
    
    // Print grouped by first letter for readability
    console.log('📊 Genre Seeds by Category:\n');
    
    let currentLetter = '';
    let count = 0;
    let line = '';
    
    genres.forEach((genre, idx) => {
      const firstLetter = genre[0].toUpperCase();
      
      if (firstLetter !== currentLetter) {
        if (line) console.log(line);
        currentLetter = firstLetter;
        count = 0;
        line = `\n[${currentLetter}] `;
      }
      
      line += genre;
      count++;
      
      if (count < 5 && idx < genres.length - 1 && genres[idx + 1][0].toUpperCase() === currentLetter) {
        line += ', ';
      }
    });
    
    if (line) console.log(line);
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Total: ${genres.length} genre seeds`);
    console.log(`${'='.repeat(60)}\n`);
    
    // Also create expanded list with variations (for fetch-500k.js style usage)
    const expandedGenres = [
      ...genres,
      // Add common variations and sub-genres not in official list
      'breakcore', 'shoegaze', 'math-rock', 'midwest-emo',
      'bedroom-pop', 'vapor-soul', 'cloud-rap', 'plugg',
      'rage', 'hyperpop', 'drill', 'uk-drill', 'ny-drill',
      'afro-swing', 'afro-fusion', 'amapiano', 'gqom',
      'baile-funk', 'funk-carioca', 'corridos-tumbados',
      'regional-mexican', 'banda', 'norteno', 'duranguense',
      'trap-latino', 'dembow', 'moombahton',
      'phonk', 'memphis-rap', 'cloud-phonk', 'drift-phonk',
      'drum-and-bass', 'jungle', 'uk-garage', 'grime',
      'psytrance', 'hardstyle', 'happy-hardcore', 'gabber',
      'vaporwave', 'synthwave', 'retrowave', 'chillwave',
      'lo-fi-hip-hop', 'boom-bap', 'trap-soul', 'alt-r-n-b'
    ];
    
    // Remove duplicates and sort
    const uniqueExpanded = [...new Set(expandedGenres)].sort();
    
    const expandedPath = path.join(__dirname, 'expanded-genre-list.json');
    fs.writeFileSync(expandedPath, JSON.stringify(uniqueExpanded, null, 2));
    console.log(`📝 Expanded list with variations (${uniqueExpanded.length} genres): ${expandedPath}\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fetchSpotifyGenres();
