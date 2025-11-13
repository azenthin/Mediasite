const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

let clientId = process.env.SPOTIFY_CLIENT_ID;
let clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

// Strip quotes if present
if (clientId?.startsWith('"')) clientId = clientId.slice(1, -1);
if (clientSecret?.startsWith('"')) clientSecret = clientSecret.slice(1, -1);

console.log('Client ID:', clientId?.slice(0, 10) + '...');
console.log('Client Secret:', clientSecret?.slice(0, 10) + '...');

const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

fetch('https://accounts.spotify.com/api/token', {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: 'grant_type=client_credentials',
})
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      console.error('❌ Auth failed:', data);
      return null;
    }

    console.log('✅ Got token:', data.access_token.slice(0, 20) + '...');

    return fetch('https://api.spotify.com/v1/artists/4gzpq5DPGxSnKTe4SA8HAU/top-tracks?market=US', {
      headers: {
        'Authorization': `Bearer ${data.access_token}`,
        'Accept': 'application/json'
      }
    });
  })
  .then(async res => {
    if (!res) return null;
    console.log('Top tracks status:', res.status, res.statusText);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (err) {
      console.error('Non-JSON response:', text.slice(0, 200));
      return null;
    }
  })
  .then(data => {
    if (!data) return;
    console.log('\nRecommendations response:', JSON.stringify(data, null, 2).slice(0, 500));
  })
  .catch(err => console.error('Error:', err.message));
