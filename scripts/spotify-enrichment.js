/**
 * Spotify Enrichment Helper
 * Fetches artist genres and audio features from Spotify API
 */

const fs = require('fs');
const path = require('path');

// Manually parse .env file (dotenv can fail with encoding issues)
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

let cachedToken = null;
let tokenExpiry = 0;

/**
 * Get Spotify access token (cached)
 */
async function getSpotifyToken() {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')
    },
    body: 'grant_type=client_credentials'
  });

  const data = await response.json();
  
  if (!response.ok || !data.access_token) {
    console.error('❌ Spotify token fetch failed:', response.status, data);
    console.error('CLIENT_ID:', SPOTIFY_CLIENT_ID ? 'present' : 'missing');
    console.error('CLIENT_SECRET:', SPOTIFY_CLIENT_SECRET ? 'present' : 'missing');
    return null;
  }
  
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Refresh 1min early
  
  return cachedToken;
}

/**
 * Fetch artist genres and popularity from Spotify
 */
async function fetchArtistData(artistId) {
  if (!artistId) return null;

  try {
    const token = await getSpotifyToken();
    const response = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      console.warn(`Artist API failed for ${artistId}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return {
      genres: data.genres || [],
      popularity: data.popularity,
      followers: data.followers?.total
    };
  } catch (error) {
    console.error(`Error fetching artist ${artistId}:`, error.message);
    return null;
  }
}

/**
 * Fetch audio features from Spotify
 */
async function fetchAudioFeatures(spotifyId) {
  if (!spotifyId) return null;

  try {
    const token = await getSpotifyToken();
    const response = await fetch(`https://api.spotify.com/v1/audio-features/${spotifyId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      console.warn(`Audio features API failed for ${spotifyId}: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching audio features ${spotifyId}:`, error.message);
    return null;
  }
}

/**
 * Batch fetch artist data (up to 50 at once)
 */
async function fetchArtistsBatch(artistIds) {
  if (!artistIds || artistIds.length === 0) return [];

  try {
    const token = await getSpotifyToken();
    const ids = artistIds.slice(0, 50).join(',');
    const response = await fetch(`https://api.spotify.com/v1/artists?ids=${ids}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      console.warn(`Artists batch API failed: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.artists.map(artist => ({
      id: artist.id,
      genres: artist.genres || [],
      popularity: artist.popularity,
      followers: artist.followers?.total
    }));
  } catch (error) {
    console.error(`Error fetching artists batch:`, error.message);
    return [];
  }
}

/**
 * Batch fetch audio features (up to 100 at once)
 */
async function fetchAudioFeaturesBatch(spotifyIds) {
  if (!spotifyIds || spotifyIds.length === 0) return [];

  try {
    const token = await getSpotifyToken();
    const ids = spotifyIds.slice(0, 100).join(',');
    const response = await fetch(`https://api.spotify.com/v1/audio-features?ids=${ids}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      console.warn(`Audio features batch API failed: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.audio_features.filter(f => f !== null);
  } catch (error) {
    console.error(`Error fetching audio features batch:`, error.message);
    return [];
  }
}

/**
 * Compute mood from audio features
 */
function computeMood(features) {
  if (!features) return null;
  
  const { valence, energy, danceability } = features;
  
  if (valence > 0.6 && energy > 0.6) return 'energetic';
  if (valence > 0.6 && energy < 0.5) return 'happy';
  if (valence < 0.4 && energy > 0.6) return 'intense';
  if (valence < 0.4 && energy < 0.5) return 'sad';
  if (danceability > 0.5) return 'chill';
  
  return 'neutral';
}

module.exports = {
  fetchArtistData,
  fetchAudioFeatures,
  fetchArtistsBatch,
  fetchAudioFeaturesBatch,
  computeMood
};
