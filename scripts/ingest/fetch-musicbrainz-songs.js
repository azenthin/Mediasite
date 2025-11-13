/**
 * Fetch songs from MusicBrainz for ingestion pipeline
 * 
 * This script queries MusicBrainz for popular recordings with ISRCs,
 * prepares them in the format expected by the ingestion pipeline,
 * and saves to a CSV file ready for processing.
 * 
 * MusicBrainz rate limit: 1 request per second
 * Target: 10,000 songs with ISRCs for high-quality ingestion
 */

const fs = require('fs');
const path = require('path');

const MB_API = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'MediasiteIngestion/1.0 (https://github.com/azenthin/mediasite)';
const RATE_LIMIT_MS = 1000; // 1 request per second
const BATCH_SIZE = 100; // Fetch 100 recordings per request
const TARGET_SONGS = 10000;

/**
 * Sleep helper for rate limiting
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch recordings from MusicBrainz with pagination
 * Focus on recordings with ISRCs (higher quality for ingestion)
 */
async function fetchRecordings(offset = 0, limit = BATCH_SIZE) {
  const url = `${MB_API}/recording?query=isrc:*%20AND%20status:official&limit=${limit}&offset=${offset}&fmt=json`;
  
  console.log(`Fetching recordings ${offset} to ${offset + limit}...`);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`MusicBrainz API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Get ISRC for a recording from MusicBrainz
 */
async function getRecordingDetails(mbid) {
  const url = `${MB_API}/recording/${mbid}?inc=isrcs+artist-credits+releases&fmt=json`;
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    console.warn(`Failed to fetch details for ${mbid}: ${response.status}`);
    return null;
  }

  const data = await response.json();
  return data;
}

/**
 * Extract artist name from MusicBrainz artist-credit
 */
function extractArtistName(artistCredit) {
  if (!artistCredit || !Array.isArray(artistCredit)) {
    return 'Unknown Artist';
  }
  return artistCredit.map(ac => ac.name || ac.artist?.name || 'Unknown').join(', ');
}

/**
 * Main function to fetch and prepare songs
 */
async function fetchSongs() {
  console.log('=== MusicBrainz Song Fetcher ===\n');
  console.log(`Target: ${TARGET_SONGS} songs with ISRCs`);
  console.log(`Rate limit: ${RATE_LIMIT_MS}ms between requests\n`);

  const songs = [];
  const seen = new Set(); // Deduplicate by MBID
  let offset = 0;
  let totalFetched = 0;
  let consecutiveErrors = 0;

  const startTime = Date.now();

  while (songs.length < TARGET_SONGS && consecutiveErrors < 5) {
    try {
      // Fetch batch of recordings
      const data = await fetchRecordings(offset, BATCH_SIZE);
      
      if (!data.recordings || data.recordings.length === 0) {
        console.log('No more recordings available');
        break;
      }

      console.log(`Got ${data.recordings.length} recordings from MusicBrainz`);
      
      // Process each recording
      for (const recording of data.recordings) {
        if (songs.length >= TARGET_SONGS) break;
        if (seen.has(recording.id)) continue;
        
        seen.add(recording.id);
        
        // Extract basic info
        const title = recording.title || 'Unknown Title';
        const artist = extractArtistName(recording['artist-credit']);
        const mbid = recording.id;
        
        // Get ISRCs from the response (some are included in search results)
        let isrcs = recording.isrcs || [];
        
        // If no ISRC in search results, fetch details (rate limited)
        if (isrcs.length === 0 && songs.length < TARGET_SONGS) {
          await sleep(RATE_LIMIT_MS);
          const details = await getRecordingDetails(mbid);
          if (details && details.isrcs) {
            isrcs = details.isrcs;
          }
        }
        
        // Skip if no ISRC (we want high-quality data for ingestion)
        if (isrcs.length === 0) {
          continue;
        }
        
        const isrc = isrcs[0]; // Use first ISRC
        
        songs.push({
          artist,
          title,
          isrc,
          mbid,
          provider: 'musicbrainz'
        });
        
        totalFetched++;
        
        if (songs.length % 100 === 0) {
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = songs.length / elapsed;
          const remaining = TARGET_SONGS - songs.length;
          const eta = remaining / rate;
          
          console.log(`Progress: ${songs.length}/${TARGET_SONGS} songs (${rate.toFixed(2)}/sec, ETA: ${(eta / 60).toFixed(1)}m)`);
        }
      }
      
      offset += BATCH_SIZE;
      consecutiveErrors = 0;
      
      // Rate limit between batches
      await sleep(RATE_LIMIT_MS);
      
    } catch (error) {
      console.error(`Error fetching batch at offset ${offset}:`, error.message);
      consecutiveErrors++;
      await sleep(RATE_LIMIT_MS * 5); // Longer wait on error
    }
  }

  console.log(`\nFetch complete: ${songs.length} songs collected`);
  
  // Save to CSV
  const outputPath = path.join(__dirname, 'sources', 'musicbrainz-10k.csv');
  const outputDir = path.dirname(outputPath);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Create CSV content
  const csvHeader = 'Artist,Title,ISRC,MBID,Provider\n';
  const csvRows = songs.map(song => {
    const escapeCsv = (str) => `"${String(str).replace(/"/g, '""')}"`;
    return [
      escapeCsv(song.artist),
      escapeCsv(song.title),
      escapeCsv(song.isrc),
      escapeCsv(song.mbid),
      escapeCsv(song.provider)
    ].join(',');
  }).join('\n');
  
  const csvContent = csvHeader + csvRows;
  fs.writeFileSync(outputPath, csvContent, 'utf8');
  
  console.log(`\nSaved to: ${outputPath}`);
  console.log(`File size: ${(csvContent.length / 1024).toFixed(2)} KB`);
  
  // Save metadata
  const metadataPath = path.join(__dirname, 'sources', 'musicbrainz-10k.meta.json');
  const metadata = {
    fetchedAt: new Date().toISOString(),
    totalSongs: songs.length,
    uniqueArtists: new Set(songs.map(s => s.artist)).size,
    source: 'MusicBrainz',
    rateLimit: `${RATE_LIMIT_MS}ms`,
    durationSeconds: (Date.now() - startTime) / 1000,
    nextSteps: [
      'Review CSV for quality',
      'Run: npm run ingest:sample -- --source=musicbrainz-10k.csv',
      'Check staging output for canonicality scores',
      'Run: npm run ingest:upsert (requires CONFIRM_UPSERT=yes)'
    ]
  };
  
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
  console.log(`Metadata saved to: ${metadataPath}\n`);
  
  // Print sample
  console.log('=== Sample (first 5 songs) ===');
  songs.slice(0, 5).forEach((song, i) => {
    console.log(`${i + 1}. ${song.artist} - ${song.title}`);
    console.log(`   ISRC: ${song.isrc}, MBID: ${song.mbid}`);
  });
  
  console.log('\n=== Next Steps ===');
  console.log('1. Review CSV: scripts/ingest/sources/musicbrainz-10k.csv');
  console.log('2. Run ingestion: npm run ingest:sample -- --source=musicbrainz-10k.csv');
  console.log('3. Review staging: scripts/ingest/staging/*.json');
  console.log('4. Upsert to DB: CONFIRM_UPSERT=yes npm run ingest:upsert');
  console.log('5. Check metrics: curl http://localhost:3000/api/ingest/status');
  
  return songs;
}

// Run if executed directly
if (require.main === module) {
  fetchSongs().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { fetchSongs };
