/*
 * Lightweight Spotify helper for ingestion scripts.
 * - Uses Client Credentials flow to obtain an access token.
 * - Performs a simple search by artist+title and returns the best-match track with ISRC when available.
 *
 * Environment variables required:
 * - SPOTIFY_CLIENT_ID
 * - SPOTIFY_CLIENT_SECRET
 */

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SEARCH_URL = 'https://api.spotify.com/v1/search';

let cachedToken = null;
let tokenExpiry = 0;

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const txt = await res.text();
    const err = new Error(`HTTP ${res.status} ${res.statusText}: ${txt}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function getSpotifyToken(clientId, clientSecret) {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry - 5000) return cachedToken;
  const body = new URLSearchParams({ grant_type: 'client_credentials' });
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const j = await fetchJson(TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  cachedToken = j.access_token;
  tokenExpiry = Date.now() + (j.expires_in || 3600) * 1000;
  return cachedToken;
}

function scoreCandidate(track, artist, title) {
  // Simple scoring: exact title match + artist string presence + has ISRC bonus
  const t = (track.name || '').toLowerCase().trim();
  const qTitle = (title || '').toLowerCase().trim();
  const qArtist = (artist || '').toLowerCase().trim();
  let score = 0;
  if (t === qTitle) score += 50;
  if (track.artists && track.artists.some(a => (a.name || '').toLowerCase().includes(qArtist))) score += 30;
  if (track.external_ids && track.external_ids.isrc) score += 20;
  // small boost for popularity/album type could be added later
  return score;
}

async function searchSpotify(artist, title, opts = {}) {
  const clientId = opts.clientId || process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = opts.clientSecret || process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET in environment or opts');
  }
  const token = await getSpotifyToken(clientId, clientSecret);
  const q = encodeURIComponent(`${artist} ${title}`);
  const url = `${SEARCH_URL}?q=${q}&type=track&limit=8`;
  const j = await fetchJson(url, { headers: { Authorization: `Bearer ${token}` } });
  const items = (j.tracks && j.tracks.items) || [];
  if (items.length === 0) return { found: false, reason: 'no-match', raw: j };
  // pick best scored candidate
  let best = null;
  let bestScore = -Infinity;
  for (const it of items) {
    const s = scoreCandidate(it, artist, title);
    if (s > bestScore) {
      bestScore = s;
      best = it;
    }
  }
  return {
    found: true,
    spotify_id: best.id,
    isrc: best.external_ids && best.external_ids.isrc,
    title: best.name,
    artists: best.artists,
    duration_ms: best.duration_ms,
    raw: best,
    raw_search: j,
    score: bestScore,
  };
}

module.exports = { searchSpotify, getSpotifyToken };
