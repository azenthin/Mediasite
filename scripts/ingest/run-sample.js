#!/usr/bin/env node
/*
  Safe one-shot ingestion runner for development and staging.
  - Reads CSV file with columns: Artist, Title, [ISRC], [MBID], [Provider], [audioFile]
  - For each row: calls `searchSpotify` -> `lookupByISRC` -> MusicBrainz enrichment.
  - Fallback: if no ISRC, tries MusicBrainz fuzzy search or fingerprint (AcoustID) if audio file provided.
  - Writes results to `scripts/ingest/staging-results.json` for inspection.
  - Upserts to `scripts/ingest/staging-db.json` (non-destructive staging).

  Usage: node run-sample.js [--source=filename.csv] [--limit=100]
  
  Important: this script is deliberately non-destructive and writes to staging JSON only.
  Use with SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, and optionally ACOUSTID_API_KEY in env.
*/

const fs = require('fs');
const path = require('path');

const { searchSpotify } = require('./spotify');
const { lookupByISRC } = require('./musicbrainz');
const { fuzzySearchMB } = require('./musicbrainz-search');
const { lookupByFingerprint, computeFingerprint } = require('./acoustid');
const { normalize } = require('./normalize');
const { upsert } = require('./upsert-staging');
const metrics = require('./metrics');

function readCSV(file) {
  if (!fs.existsSync(file)) {
    console.warn(`CSV file not found: ${file}`);
    return [];
  }
  const txt = fs.readFileSync(file, 'utf8');
  const lines = txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const [header, ...rows] = lines;
  if (!header) return [];
  
  // Parse CSV properly handling quoted values
  const cols = header.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
  return rows.map(r => {
    // Simple CSV parser (handles quoted values with commas)
    const regex = /("(?:[^"\\]|\\.)*"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g;
    const parts = r.match(regex) || [];
    const obj = {};
    cols.forEach((c, i) => {
      const val = (parts[i] || '').trim().replace(/^"|"$/g, '');
      obj[c] = val;
    });
    return obj;
  });
}

// Parse command-line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = { source: null, limit: null };
  
  args.forEach(arg => {
    if (arg.startsWith('--source=')) {
      options.source = arg.split('=')[1];
    } else if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1], 10);
    }
  });
  
  return options;
}

async function processSample() {
  console.log('=== Ingestion Pipeline Runner ===\n');
  
  const opts = parseArgs();
  
  // Determine source file
  let sourceFile;
  if (opts.source) {
    // Check if it's a relative path or absolute
    if (path.isAbsolute(opts.source)) {
      sourceFile = opts.source;
    } else {
      // Try sources/ directory first, then relative to script
      const sourcesPath = path.join(__dirname, 'sources', opts.source);
      if (fs.existsSync(sourcesPath)) {
        sourceFile = sourcesPath;
      } else {
        sourceFile = path.join(__dirname, opts.source);
      }
    }
  } else {
    sourceFile = path.join(__dirname, 'sample-source.csv');
  }
  
  console.log(`Source: ${sourceFile}`);
  
  const out = path.join(__dirname, 'staging-results.json');
  const rows = readCSV(sourceFile);
  
  if (!rows.length) {
    console.warn(`No rows to process in ${sourceFile}`);
    fs.writeFileSync(out, JSON.stringify({ warning: 'no-rows', results: [] }, null, 2));
    return;
  }
  
  // Apply limit if specified
  const totalRows = rows.length;
  const processRows = opts.limit ? rows.slice(0, opts.limit) : rows;
  
  console.log(`Total songs in CSV: ${totalRows}`);
  console.log(`Processing: ${processRows.length} songs`);
  if (opts.limit && opts.limit < totalRows) {
    console.log(`(Limited to first ${opts.limit} songs for testing)\n`);
  } else {
    console.log('');
  }

  const results = [];
  const startTime = Date.now();
  let processedCount = 0;
  
  for (const r of processRows) {
    const artist = r.Artist || '';
    const title = r.Title || '';
    const isrc = r.ISRC || '';
    const mbid = r.MBID || '';
    const audioFile = r.audioFile || '';

    const rec = { artist, title, isrc, mbid, audioFile, spotify: null, musicbrainz: null, acoustid: null, notes: [] };

    try {
      let sp = null;
      let mb = null;

      // If we already have MBID from MusicBrainz fetch, use it
      if (mbid) {
        mb = { mbid, source: 'provided', found: true };
        rec.musicbrainz = mb;
        rec.notes.push('mbid-provided');
      }

      // Step 1: Try Spotify search (to get Spotify ID for playback)
      if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
        sp = await searchSpotify(artist, title);
        rec.spotify = sp;
        if (sp && sp.found && sp.isrc) {
          // Step 2: ISRC lookup on MusicBrainz (if we don't have MBID yet)
          if (!mb || !mb.mbid) {
            mb = await lookupByISRC(sp.isrc);
            rec.musicbrainz = mb;
          }
        } else {
          rec.notes.push('spotify: no-isrc');
        }
      } else {
        rec.notes.push('no-spotify-creds');
      }

      // Step 3: If no MBID yet, try MusicBrainz fuzzy search
      if (!mb || !mb.mbid) {
        try {
          const fuzzy = await fuzzySearchMB(artist, title);
          if (fuzzy && fuzzy.mbid) {
            mb = fuzzy;
            rec.musicbrainz = mb;
            rec.notes.push('mb-fuzzy-match');
          }
        } catch (e) {
          rec.notes.push('mb-fuzzy-error:' + String(e));
        }
      }

      // Step 4: If no MBID yet and audio file provided, try fingerprint (AcoustID)
      if ((!mb || !mb.mbid) && audioFile && fs.existsSync(audioFile)) {
        try {
          const fp = await computeFingerprint(audioFile);
          if (fp.fingerprint) {
            const duration = fp.duration;
            const acoustidResult = await lookupByFingerprint(fp.fingerprint, duration);
            rec.acoustid = acoustidResult;
            if (acoustidResult.found && acoustidResult.mbids && acoustidResult.mbids.length > 0) {
              // Use first MBID from AcoustID
              mb = { mbid: acoustidResult.mbids[0], source: 'acoustid', confidence: acoustidResult.confidence };
              rec.musicbrainz = mb;
              rec.notes.push('acoustid-match');
            } else {
              rec.notes.push('acoustid-no-match');
            }
          } else {
            rec.notes.push('fingerprint-error:' + (fp.error || 'unknown'));
          }
        } catch (e) {
          rec.notes.push('fingerprint-error:' + String(e));
        }
      } else if (!audioFile) {
        rec.notes.push('no-audio-file');
      }
    } catch (err) {
      rec.notes.push('error:' + String(err));
    }

    // Normalize and upsert to staging
    const canonical = normalize({ spotify: rec.spotify, musicbrainz: rec.musicbrainz });
    try {
      upsert(canonical);
      metrics.incProcessed();
      if (canonical.accept) metrics.incAccepted();
      else if (canonical.queue) metrics.incQueued();
      else metrics.incSkipped(canonical.skipReason || 'low-confidence');
    } catch (e) {
      metrics.incError();
      rec.notes.push('upsert-error:' + String(e));
    }

    results.push(Object.assign(rec, { canonical }));
    processedCount++;
    
    // Progress reporting every 100 songs
    if (processedCount % 100 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = processedCount / elapsed;
      const remaining = processRows.length - processedCount;
      const eta = remaining / rate;
      const m = metrics.get();
      
      console.log(`Progress: ${processedCount}/${processRows.length} songs (${rate.toFixed(2)}/sec, ETA: ${(eta / 60).toFixed(1)}m)`);
      console.log(`  Accepted: ${m.accepted}, Queued: ${m.queued}, Skipped: ${m.skipped}, Errors: ${m.errors}`);
    }
  }

  fs.writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
  console.log(`\n=== Processing Complete ===`);
  console.log(`Processed ${results.length} songs in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log(`Results saved to: ${out}`);
  
  // Print final metrics summary
  const m = metrics.get();
  console.log('\n=== Final Metrics ===');
  console.log(`  Processed: ${m.processed}`);
  console.log(`  Accepted: ${m.accepted} (${((m.accepted / m.processed) * 100).toFixed(1)}%)`);
  console.log(`  Queued: ${m.queued} (${((m.queued / m.processed) * 100).toFixed(1)}%)`);
  console.log(`  Skipped: ${m.skipped} (${((m.skipped / m.processed) * 100).toFixed(1)}%)`);
  console.log(`  Errors: ${m.errors}`);
  
  if (m.byReason && Object.keys(m.byReason).length > 0) {
    console.log('\n=== Skip Reasons ===');
    Object.entries(m.byReason).forEach(([reason, count]) => {
      console.log(`  ${reason}: ${count}`);
    });
  }
  
  console.log('\n=== Next Steps ===');
  console.log('1. Review staging results: scripts/ingest/staging-results.json');
  console.log('2. Review staging database: scripts/ingest/staging-db.json');
  console.log('3. Check quality scores and skip reasons');
  console.log('4. If satisfied, upsert to production: $env:CONFIRM_UPSERT="yes"; npm run ingest:upsert');
}

if (require.main === module) {
  processSample().catch(err => {
    console.error('Error running sample:', err);
    process.exit(1);
  });
}
