// Quick test of Spotify API credentials
const https = require('https');

const clientId = 'd3b3d04fe43c4e8a84159a5de32b23d1';
const clientSecret = '0fa4cbbf9a164016b558ef9ac34084c2';
const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

const options = {
  hostname: 'accounts.spotify.com',
  path: '/api/token',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': `Basic ${auth}`
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
  });
});

req.on('error', (e) => console.error('Error:', e));
req.write('grant_type=client_credentials');
req.end();
