#!/usr/bin/env node
/*
Soundcharts sandbox importer (best-effort)
- Uses Soundcharts sandbox credentials (app id: soundcharts, api key: soundcharts)
- Fetches song genres, then attempts to discover a working song search endpoint.
- For each genre, runs a search and fetches metadata for returned songs, filtering release_date >= 2020.
- Writes results to CSV at scripts/output/soundcharts_songs.csv and optionally imports into local enhanced_music.db using sqlite3 if present.

Usage:
  node ./scripts/import-soundcharts.js --limit 50

Notes:
- This script tries multiple candidate endpoints (the Soundcharts docs use a few patterns) and will log helpful diagnostics.
- Requires Node 18+ (global fetch). If sqlite3.exe is on PATH and you pass --import-sqlite, the script will create a minimal songs table and import the CSV.
- Be patient: we throttle modestly between requests to be polite.
*/

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const BASE = process.env.SOUNDCHARTS_BASE || 'https://customer.api.soundcharts.com';
const APP_ID = process.env.SOUNDCHARTS_APP_ID || 'soundcharts';
const API_KEY = process.env.SOUNDCHARTS_API_KEY || 'soundcharts';

const OUTPUT_DIR = path.join(__dirname, 'output');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
const OUT_CSV = path.join(OUTPUT_DIR, 'soundcharts_songs.csv');

const argv = require('minimist')(process.argv.slice(2));
const LIMIT_PER_GENRE = parseInt(argv.limit || argv.l || '50', 10);
const IMPORT_SQLITE = !!argv['import-sqlite'];
const MIN_YEAR = argv['min-year'] ? parseInt(argv['min-year'],10) : (argv['minYear'] ? parseInt(argv['minYear'],10) : 2020);
const MIN_DATE = argv['min-date'] || argv['minDate'] || null;
const NO_FILTER = !!argv['no-filter'];

function headers() {
  return {
    'x-app-id': APP_ID,
    'x-api-key': API_KEY,
    'Accept': 'application/json',
    'User-Agent': 'mediasite-soundcharts-importer/1.0 (+contact)'
  };
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    const err = new Error(`HTTP ${res.status} ${res.statusText} for ${url} - ${txt}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function tryGetGenres() {
  const candidatePaths = [
    '/api/v2/song/genres',
    '/api/v2/genres/song',
    '/api/v2/referential/genres/song',
    '/api/v2/referential/genres',
    '/api/v2/ref/genres/song',
    '/api/v2/genre/song',
    '/api/v2/referential/song/genres',
    '/api/v2/artist/genres'
  ];

  for (const p of candidatePaths) {
    const url = `${BASE}${p}`;
    console.log('Trying genre endpoint:', url);
    try {
      const j = await fetchJson(url);
      const items = j.items || j.object?.items || j.genres || j;
      if (Array.isArray(items) && items.length > 0) {
        console.log('Found genres at', url, 'count=', items.length);
        return items;
      }
      // sometimes the payload is a map/object of genres
      if (j && typeof j === 'object' && Object.keys(j).length > 0) {
        const arr = Array.isArray(j) ? j : Object.values(j);
        if (arr.length > 0) {
          console.log('Found genres (object) at', url);
          return arr;
        }
      }
    } catch (err) {
      console.log('Endpoint failed:', url, err.message);
      // try next
    }
  }

  console.error('Failed to fetch song genres from any known endpoints');
  return [];
}

const CANDIDATE_SEARCH_PATHS = [
  '/api/v2/search/song',
  '/api/v2/song/search',
  '/api/v2/song',
  '/api/v2/search',
  '/api/v2/search/songs',
  '/api/v2/search',
  '/api/v2/song',
  '/api/v2/v1/song/search',
  '/api/v2/v1/search/song',
  '/api/v2/songs',
  '/api/v2/song/list',
  '/api/v2/sandbox/songs',
  '/api/v1/sandbox/songs',
  '/sandbox/songs',
  '/api/v2/referential/songs',
  '/api/v2/reference/songs'
];

async function discoverSearchPath() {
  console.log('Discovering search endpoint...');
  for (const p of CANDIDATE_SEARCH_PATHS) {
    const testUrl = `${BASE}${p}?q=pop&limit=1`;
    try {
      const res = await fetch(testUrl, { headers: headers(), method: 'GET' });
      if (res.ok) {
        console.log('Using search path:', p);
        return p;
      } else {
        // some endpoints might require 'query' param instead of q
        const testUrl2 = `${BASE}${p}?query=pop&limit=1`;
        const res2 = await fetch(testUrl2, { headers: headers(), method: 'GET' });
        if (res2.ok) {
          console.log('Using search path (query param):', p);
          return p + '?query='; // marker
        }
      }
    } catch (err) {
      // ignore and try next
    }
  }
  console.warn('No discovered search endpoint responded OK. You may need to adjust search path manually. Defaulting to /api/v2/search/song with q param.');
  return '/api/v2/search/song';
}

function csvEscape(s) {
  if (s === null || s === undefined) return '';
  s = String(s);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async function main() {
  console.log('Soundcharts importer — starting');
  const genres = await tryGetGenres();
  console.log('Found', genres.length, 'genres');
  // prefer genre names array — genres may be objects with { id, uuid, name, slug }
  const genreNames = genres.map(g => {
    if (!g) return null;
    if (typeof g === 'string') return g;
    return (g.name || g.label || g.slug || g.uuid || g.id || JSON.stringify(g));
  }).filter(Boolean).slice(0, 50);
  console.log('Using genre names/sample:', genreNames.slice(0,5));

  const searchPath = await discoverSearchPath();

  // prepare CSV
  const header = ['song_id','title','artist','genres','release_date','release_year','duration_ms','isrc','source'].join(',') + '\n';
  fs.writeFileSync(OUT_CSV, header, 'utf8');

  function passesFilter(release_date, release_year) {
    if (NO_FILTER) return true;
    if (MIN_DATE) {
      if (release_date) {
        const rd = new Date(release_date);
        if (isNaN(rd.getTime())) return false;
        return rd >= new Date(MIN_DATE);
      }
      return !(release_year && release_year < MIN_YEAR);
    }
    if (release_year) return release_year >= MIN_YEAR;
    if (release_date) {
      const rd = new Date(release_date);
      if (isNaN(rd.getTime())) return false;
      return rd.getFullYear() >= MIN_YEAR;
    }
    return false;
  }

  let total = 0;
  for (const g of genreNames) {
    console.log(`Searching genre: ${g}`);
    // craft search URL variations
    const candidates = [];
    // if genre is a JSON-like string describing root+subgenres, try root and each subgenre separately
    let searchTerms = [g];
    try {
      if (typeof g === 'string' && g.trim().startsWith('{')) {
        const parsed = JSON.parse(g);
        const root = parsed.root || parsed.name || parsed.label;
        const subs = parsed.sub || parsed.subgenres || [];
        searchTerms = [];
        if (root) searchTerms.push(root);
        if (Array.isArray(subs)) searchTerms.push(...subs.slice(0, 8));
      }
    } catch (e) {
      // not JSON, keep as-is
    }

    // build candidate URLs for each search term
    for (const term of searchTerms) {
      const encoded = encodeURIComponent(term);
      candidates.push(`${BASE}${searchPath}?q=${encoded}&limit=${LIMIT_PER_GENRE}`);
      candidates.push(`${BASE}${searchPath}?query=${encoded}&limit=${LIMIT_PER_GENRE}`);
      candidates.push(`${BASE}/api/v2/song?genre=${encoded}&limit=${LIMIT_PER_GENRE}`);
      candidates.push(`${BASE}/api/v2/referential/song?genre=${encoded}&limit=${LIMIT_PER_GENRE}`);
      candidates.push(`${BASE}/api/v2/search/song?q=${encoded}&limit=${LIMIT_PER_GENRE}`);
      candidates.push(`${BASE}/api/v2/search/song?query=${encoded}&limit=${LIMIT_PER_GENRE}`);
      // extra common patterns
      candidates.push(`${BASE}/api/v2/sandbox/songs?genre=${encoded}&limit=${LIMIT_PER_GENRE}`);
      candidates.push(`${BASE}/api/v1/sandbox/songs?genre=${encoded}&limit=${LIMIT_PER_GENRE}`);
      candidates.push(`${BASE}/sandbox/songs?genre=${encoded}&limit=${LIMIT_PER_GENRE}`);
      candidates.push(`${BASE}/api/v2/referential/songs?genre=${encoded}&limit=${LIMIT_PER_GENRE}`);
    }
    
    // if the genre value was a JSON object with an id/uuid, try ID-based endpoints
    try {
      const maybe = (typeof g === 'string' && g.trim().startsWith('{')) ? JSON.parse(g) : null;
      const gid = maybe && (maybe.id || maybe.uuid || maybe.guid);
      if (gid) {
        const encId = encodeURIComponent(gid);
        candidates.push(`${BASE}/api/v2/genres/${encId}/songs?limit=${LIMIT_PER_GENRE}`);
        candidates.push(`${BASE}/api/v2/genre/${encId}/songs?limit=${LIMIT_PER_GENRE}`);
        candidates.push(`${BASE}/api/v2/referential/genres/${encId}/songs?limit=${LIMIT_PER_GENRE}`);
        candidates.push(`${BASE}/api/v2/referential/song?genre_id=${encId}&limit=${LIMIT_PER_GENRE}`);
        candidates.push(`${BASE}/api/v2/song?genre_uuid=${encId}&limit=${LIMIT_PER_GENRE}`);
        candidates.push(`${BASE}/api/v2/referential/song?genre_uuid=${encId}&limit=${LIMIT_PER_GENRE}`);
      }
    } catch (e) {
      // ignore parse errors
    }
    let results = null;
    for (const url of candidates) {
      try {
        const res = await fetch(url, { headers: headers() });
        if (!res.ok) {
          // skip
          continue;
        }
        const j = await res.json();
        // try to find items array
        results = j.items || j.object?.items || j.songs || j.data || j;
        if (Array.isArray(results)) break;
      } catch (err) {
        // ignore
      }
    }

    if (!results || !Array.isArray(results) || results.length === 0) {
      console.log(`No results for genre ${g} (tried ${candidates.length} candidate URLs)`);
      // be polite
      await sleep(200);
      continue;
    }

    for (const item of results) {
      // normalize: try fields
      const songId = item.song_id || item.uuid || item.id || item.sid || item.songUuid || item.track_id || item.track_uuid || item.trackId;
      const title = item.title || item.name || item.song_title || item.track || '';
      const artist = (item.artist && (item.artist.name || item.artist)) || item.artists?.map(a=>a.name).join(', ') || item.primary_artist || '';
      const genresField = (item.genres && Array.isArray(item.genres) ? item.genres.join('|') : item.genres) || g;
      const release_date = item.release_date || item.first_release_date || item.release_date_utc || item.year || '';
      let release_year = '';
      if (release_date) {
        const m = release_date.toString().match(/(\d{4})/);
        if (m) release_year = parseInt(m[1],10);
      }
  if (!passesFilter(release_date, release_year)) continue; // skip old
      const duration_ms = item.duration_ms || item.duration || (item.length ? Math.floor(item.length*1000) : '');
      const isrc = (item.isrcs && item.isrcs[0]) || item.isrc || '';
      const src = 'soundcharts-sandbox';

      const row = [songId, title, artist, genresField, release_date, release_year, duration_ms, isrc, src].map(csvEscape).join(',') + '\n';
      fs.appendFileSync(OUT_CSV, row, 'utf8');
      total++;
    }

    console.log(`Wrote ${results.length} items for genre ${g} (total ${total})`);
    // throttle
    await sleep(300);
  }

  console.log('Done. Wrote', total, 'rows to', OUT_CSV);
  // If we found nothing, provide a documented fallback path:
  if (total === 0) {
    console.warn('\nNo songs were discovered from the sandbox search endpoints.\nTrying fallback dataset sources:\n - local file: scripts/sandbox-dataset.json\n - environment URL: SOUNDCHARTS_FALLBACK_URL\n');
    const localFallback = path.join(__dirname, 'sandbox-dataset.json');
    let fallbackRows = 0;
    if (fs.existsSync(localFallback)) {
      console.log('Found local fallback dataset at', localFallback);
      try {
        const data = JSON.parse(fs.readFileSync(localFallback, 'utf8'));
        if (Array.isArray(data)) {
          for (const item of data) {
            const songId = item.song_id || item.id || item.uuid || '';
            const title = item.title || item.name || '';
            const artist = item.artist || item.artists || '';
            const genresField = item.genres || '';
            const release_date = item.release_date || item.year || '';
            const m = release_date && release_date.toString().match(/(\d{4})/);
            const release_year = m ? parseInt(m[1],10) : (item.release_year || '');
            if (!passesFilter(release_date, release_year)) continue;
            const duration_ms = item.duration_ms || item.duration || '';
            const isrc = item.isrc || '';
            const src = item.source || 'soundcharts-fallback';
            const row = [songId, title, artist, genresField, release_date, release_year, duration_ms, isrc, src].map(csvEscape).join(',') + '\n';
            fs.appendFileSync(OUT_CSV, row, 'utf8');
            fallbackRows++;
          }
        }
      } catch (err) {
        console.error('Failed to parse local fallback JSON:', err.message);
      }
    }

    if (fallbackRows === 0 && process.env.SOUNDCHARTS_FALLBACK_URL) {
      try {
        console.log('Fetching fallback dataset from', process.env.SOUNDCHARTS_FALLBACK_URL);
        const data = await fetchJson(process.env.SOUNDCHARTS_FALLBACK_URL);
        if (Array.isArray(data)) {
          for (const item of data) {
            const songId = item.song_id || item.id || item.uuid || '';
            const title = item.title || item.name || '';
            const artist = item.artist || item.artists || '';
            const genresField = item.genres || '';
            const release_date = item.release_date || item.year || '';
            const m = release_date && release_date.toString().match(/(\d{4})/);
            const release_year = m ? parseInt(m[1],10) : (item.release_year || '');
            if (!passesFilter(release_date, release_year)) continue;
            const duration_ms = item.duration_ms || item.duration || '';
            const isrc = item.isrc || '';
            const src = item.source || 'soundcharts-fallback-remote';
            const row = [songId, title, artist, genresField, release_date, release_year, duration_ms, isrc, src].map(csvEscape).join(',') + '\n';
            fs.appendFileSync(OUT_CSV, row, 'utf8');
            fallbackRows++;
          }
        }
      } catch (err) {
        console.error('Failed to fetch remote fallback dataset:', err.message);
      }
    }

    if (fallbackRows > 0) {
      console.log('Fallback wrote', fallbackRows, 'rows to', OUT_CSV);
    } else {
      console.warn('No fallback rows were written. To proceed, either provide a local JSON file at scripts/sandbox-dataset.json or set SOUNDCHARTS_FALLBACK_URL to a public JSON array of songs.');
    }
  }
  if (IMPORT_SQLITE) {
    // try to import into enhanced_music.db using sqlite3 CLI
    try {
      const dbPath = path.join(process.cwd(), 'enhanced_music.db');
      // create DB and table
      const createSql = `CREATE TABLE IF NOT EXISTS songs (id TEXT PRIMARY KEY, title TEXT, artist TEXT, genres TEXT, release_date TEXT, release_year INTEGER, duration_ms INTEGER, isrc TEXT, source TEXT);`;
      execSync(`sqlite3 "${dbPath}" "${createSql.replace(/"/g,'\\"')}"`);
      // convert CSV to insert statements using sqlite3 .import
      // sqlite3 requires that the table columns match CSV order; we will use a temp table import approach
      const tmpSql = `DROP TABLE IF EXISTS import_sounds_temp; CREATE TABLE import_sounds_temp(song_id TEXT, title TEXT, artist TEXT, genres TEXT, release_date TEXT, release_year INTEGER, duration_ms INTEGER, isrc TEXT, source TEXT);`;
      execSync(`sqlite3 "${dbPath}" "${tmpSql.replace(/"/g,'\\"')}"`);
      execSync(`sqlite3 -separator "," "${dbPath}" ".import ${OUT_CSV} import_sounds_temp"`);
      // move rows into songs (upsert)
      const upsert = `INSERT OR REPLACE INTO songs(id,title,artist,genres,release_date,release_year,duration_ms,isrc,source) SELECT song_id,title,artist,genres,release_date,release_year,duration_ms,isrc,source FROM import_sounds_temp; DROP TABLE import_sounds_temp;`;
      execSync(`sqlite3 "${dbPath}" "${upsert.replace(/"/g,'\\"')}"`);
      console.log('Imported CSV into', dbPath);
    } catch (err) {
      console.error('Failed to import into SQLite:', err.message);
    }
  }

})();
