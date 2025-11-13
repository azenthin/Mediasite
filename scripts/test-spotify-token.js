const fs = require('fs');
const path = require('path');

// Manually parse .env file
const envPath = path.join(__dirname, '..', '.env');
console.log('Reading .env from:', envPath);
const envFile = fs.readFileSync(envPath, 'utf8');
console.log('.env content length:', envFile.length);

let SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET;
envFile.split(/\r?\n/).forEach((line, idx) => {
  line = line.trim();
  if (line.includes('SPOTIFY')) {
    console.log(`Line ${idx}:`, line);
  }
  if (line.startsWith('SPOTIFY_CLIENT_ID=')) {
    SPOTIFY_CLIENT_ID = line.substring('SPOTIFY_CLIENT_ID='.length);
    console.log('Found CLIENT_ID:', SPOTIFY_CLIENT_ID);
  }
  if (line.startsWith('SPOTIFY_CLIENT_SECRET=')) {
    SPOTIFY_CLIENT_SECRET = line.substring('SPOTIFY_CLIENT_SECRET='.length);
    console.log('Found CLIENT_SECRET:', SPOTIFY_CLIENT_SECRET);
  }
});

console.log('Testing Spotify credentials...');
console.log('CLIENT_ID:', SPOTIFY_CLIENT_ID ? `${SPOTIFY_CLIENT_ID.substring(0, 8)}...` : 'MISSING');
console.log('CLIENT_SECRET:', SPOTIFY_CLIENT_SECRET ? `${SPOTIFY_CLIENT_SECRET.substring(0, 8)}...` : 'MISSING');

async function testToken() {
  try {
    const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + auth
      },
      body: 'grant_type=client_credentials'
    });

    const data = await response.json();
    
    if (response.ok && data.access_token) {
      console.log('✅ Token generation SUCCESS');
      console.log('Token:', data.access_token.substring(0, 20) + '...');
      console.log('Expires in:', data.expires_in, 'seconds');
    } else {
      console.log('❌ Token generation FAILED');
      console.log('Status:', response.status);
      console.log('Response:', data);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testToken();
