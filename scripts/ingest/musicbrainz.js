/*
 * Minimal MusicBrainz helper for ingestion scripts.
 * - Lookup by ISRC using the MusicBrainz WS/2 API and normalize the first recording hit.
 * - Respects polite User-Agent header as MusicBrainz requests it.
 */

const MB_ISRC_URL = 'https://musicbrainz.org/ws/2/recording';

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

async function lookupByISRC(isrc, opts = {}) {
  if (!isrc) return { found: false, reason: 'no-isrc' };
  const url = `${MB_ISRC_URL}?query=isrc:${encodeURIComponent(isrc)}&fmt=json&limit=5`;
  const agent = opts.userAgent || process.env.INGEST_USER_AGENT || 'mediasite-ingest/1.0 (contact: dev@example.com)';
  const j = await fetchJson(url, { headers: { 'User-Agent': agent } });
  const recs = j.recordings || [];
  if (recs.length === 0) return { found: false, reason: 'no-mbid', raw: j };
  const r = recs[0];
  const artists = (r['artist-credit'] || []).map(ac => (ac.name || ac.artist?.name) || '').filter(Boolean);
  const releases = (r.releases || []).map(rel => ({ id: rel.id, title: rel.title, date: rel.date }));
  return {
    found: true,
    mbid: r.id,
    title: r.title,
    artists,
    duration: r.length,
    releases,
    raw: r,
    raw_search: j,
  };
}

module.exports = { lookupByISRC };
