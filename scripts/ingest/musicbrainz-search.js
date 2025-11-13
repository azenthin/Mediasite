// MusicBrainz fuzzy search by artist+title (fallback path)
const MB_URL = 'https://musicbrainz.org/ws/2/recording';

async function searchByArtistTitle(artist, title, opts = {}) {
  if (!artist && !title) return { found: false, reason: 'no-query' };
  const q = encodeURIComponent(`${title} AND artist:${artist}`);
  const url = `${MB_URL}?query=${q}&fmt=json&limit=5`;
  const res = await fetch(url, { headers: { 'User-Agent': opts.userAgent || 'mediasite-ingest/1.0' } });
  if (!res.ok) return { found: false, reason: 'http-error', status: res.status };
  const j = await res.json();
  const recs = j.recordings || [];
  if (recs.length === 0) return { found: false, reason: 'no-match' };
  const r = recs[0];
  return { found: true, mbid: r.id, title: r.title, artists: (r['artist-credit']||[]).map(a=>a.name||a.artist?.name), raw: r };
}

module.exports = { searchByArtistTitle };
