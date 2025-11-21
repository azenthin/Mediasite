# Music Database Ingestion Strategy & Progress Log

**Last Updated:** November 19, 2025  
**Current Status:** 🚀 Phase 2 - 1M Song Collection in Progress

---

## Executive Summary

This document outlines the complete music library expansion strategy from 334k to 1M+ songs using Spotify API with safe batch processing.

### Timeline
- **Phase 1 (✅ Complete):** 334k songs from local sources → Vercel Postgres
  - Duration: ~12 minutes
  - Rate: 630 tracks/sec
  - Identifiers: 334k tracks → 608k deduplicated identifiers

- **Phase 2 (🚀 In Progress):** 1M songs collection with regional diversity
  - Target: 1,000,000 unique tracks
  - Batch size: 50,000 songs per checkpoint
  - Expected duration: 1.5-2.5 hours
  - Collection method: Spotify API via `fetch-1m-batch.js`

- **Phase 3 (⏳ Queued):** PostgreSQL import with proven bulk insert logic
  - Expected duration: ~26 minutes for 1M songs
  - Rate: 630 tracks/sec (same as Phase 1)
  - Deduplication: By Spotify ID + ISRC + MusicBrainz ID

---

## Collection Strategy

### Problem Statement
**Goal:** Expand from 334k to 1M songs while ensuring:
- ✅ Data integrity (safe batch processing with checkpoints)
- ✅ Geographic diversity (regional playlists)
- ✅ Genre coverage (100+ genres + categories)
- ✅ No data loss on failure (resumable collection)

### Solution Architecture

#### 1. **Search Query Categories** (~600 total)
Comprehensive multi-method approach:

**A. Playlist Categories (60+ searches)**
- Mainstream: `top hits`, `popular`, `trending`, `viral`, `charts`
- Essential: `best of`, `essential`, `must have`, `legendary`, `classics`
- Mood-based: `chill`, `workout`, `party`, `sad`, `happy`, `sleep`
- Era-based: `80s`, `90s`, `00s`, `2010s`, `2020s`, `throwback`, `oldies`
- Medium-specific: `acoustic`, `unplugged`, `live`, `remix`, `cover`

**B. Regional Playlists (30+ territories)**
```
North America:  USA, Canada
Europe:         UK, Germany, France, Italy, Spain, Netherlands, 
                Sweden, Norway, Denmark, Poland, Russia
Asia:           Japan, Korea, India, Australia, Indonesia, Thailand,
                Singapore, Philippines, China, Vietnam
LATAM:          Mexico, Brazil, Argentina, Chile, Colombia, Peru
MEA:            Saudi Arabia, UAE, Israel, South Africa, Nigeria
```

**C. Genre Coverage (80+ genres with variants)**
- Core genres: pop, rock, hip-hop, rap, r&b, soul, funk, jazz, blues, country
- Electronic: edm, house, techno, trance, dubstep, drum-and-bass, ambient
- Rock sub-genres: metal, punk, grunge, indie, alternative, emo, metalcore
- International: k-pop, j-pop, latin, reggaeton, afrobeat, arabic, indian
- Experimental: lo-fi, vaporwave, synthwave, glitch, breakcore
- Classical/Other: classical, opera, gospel, soundtrack, world music

**D. Year-based Searches (1950-2024)**
- 75-year span for temporal diversity
- Each search targets year + genre combinations

### Collection Flow

```
┌─ fetch-1m-batch.js
│
├─ Load Spotify credentials from .env
├─ Query 600+ search terms via Spotify API
│  ├─ Search playlists (50 per query)
│  ├─ Extract tracks from each playlist
│  ├─ Deduplicate by Spotify ID (in-memory Map)
│  └─ Apply 50ms rate limit per request
│
├─ CHECKPOINT SYSTEM (every 50k songs)
│  ├─ Save: staging-results-1m-batch-[N].json
│  ├─ Save: staging-results-1m-checkpoint.json (resumable state)
│  └─ Log progress to console
│
└─ OUTPUT
   ├─ staging-results-1m-final.json (all unique tracks)
   ├─ staging-results-1m-batch-1.json through batch-20.json
   └─ Ready for turbo-upsert.js import
```

### Rate Limiting & Performance

**Spotify API Constraints:**
- 50ms minimum between requests
- ~20 requests/second (safe limit)
- Expected collection time: 1-2 hours for ~600 queries

**Query Execution Strategy:**
```
Query Count:  ~600 searches
Rate:         50ms per search (20 req/sec)
Min Time:     ~30 seconds of pure API calls
Real Time:    1.5-2.5 hours (includes:
              - Playlist fetches (100 tracks per playlist)
              - Batch processing & deduplication
              - File I/O & checkpointing)

Safety Margin: 2x for potential API delays
```

### Data Deduplication

**Deduplication Key:** Spotify Track ID (primary)

```javascript
// In-memory Map prevents duplicates during collection
const uniqueTracks = new Map();
uniqueTracks.set(track.spotify_id, trackObject); // Unique by Spotify ID

// Post-collection deduplication in turbo-upsert.js:
// By Spotify ID, ISRC code, and MusicBrainz ID
```

**Expected Ratios:**
- Collected tracks: ~1-1.5M raw results
- After Spotify ID dedup: ~1M unique
- After ISRC/MBID dedup: ~850k-950k final

---

## Phase 1 Results (Completed ✅)

### Migration Statistics
```
Source:          Local SQLite (prisma/prisma/dev.db)
Destination:     Vercel PostgreSQL (db.prisma.io)
Tracks Migrated: 334,643 ✅
Identifiers:     639,000 raw → 608,238 unique
Duration:        ~12 minutes total
Speed:           630 tracks/second
```

### Import Command Used
```powershell
$env:DATABASE_URL="postgres://...@db.prisma.io:5432/?sslmode=require"
node scripts/migrate-to-postgres.js staging-results-500k.json
```

### Verification
```sql
SELECT COUNT(*) FROM "VerifiedTrack"        -- 334,643 rows ✅
SELECT COUNT(*) FROM "Identifier"           -- 608,238 rows ✅
SELECT COUNT(DISTINCT "spotifyId") FROM "Identifier" -- 334,643 unique ✅
```

---

## Phase 2 Progress (In Progress 🚀)

### Collection Status

**Start Time:** November 19, 2025, ~18:42 UTC  
**Target:** 1,000,000 songs  
**Batch Size:** 50,000 checkpoint interval  

**Live Progress (Last Updated: 18:45 UTC):**
- ✅ Running: `node scripts/fetch-1m-batch.js` (Terminal ID: 20f889ef-f430-46d0-96b3-5efbe28ca15c)
- 📊 Current: Query 6/439 | 17,358 tracks collected
- ✅ Rate: ~2,900 tracks/query (averaging from first 6 queries)
- ⏱️ Estimated completion: 50-60 minutes to reach 1M songs
- ✅ Checkpoint system active (will save every 50k)
- ✅ Monitor running: `node scripts/monitor-collection.js` (Terminal ID: 87c99312-f472-45c8-9a81-2b8d85da6d18)
- ✅ Can resume if interrupted

**Files Generated:**
```
ingest/
├── staging-results-1m-batch-1.json     (50k songs)
├── staging-results-1m-batch-2.json     (50k songs)
├── ...
├── staging-results-1m-batch-20.json    (remaining)
├── staging-results-1m-checkpoint.json  (resumable state)
└── staging-results-1m-final.json       (complete collection)
```

---

## Phase 3 (Queued - Ready for Execution ⏳)

### PostgreSQL Import Strategy

**Method:** Bulk insert with proven turbo-upsert logic

```powershell
# After collection completes, run:
$env:DATABASE_URL="postgres://...@db.prisma.io:5432/?sslmode=require"
node scripts/turbo-upsert.js ingest/staging-results-1m-final.json

# Expected output:
# ✅ 1,000,000 tracks inserted
# ✅ ~850k-950k identifiers after deduplication
# ⏱️  Duration: ~26 minutes
# 📊 Speed: 630 tracks/second
```

### Post-Import Verification

```sql
-- Verify 1M songs
SELECT COUNT(*) FROM "VerifiedTrack"
-- Expected: ~1,000,000

-- Check identifiers
SELECT COUNT(*) FROM "Identifier"
-- Expected: ~850,000 - 950,000

-- Verify Spotify coverage
SELECT COUNT(DISTINCT "spotifyId") FROM "Identifier" 
-- Expected: ~1,000,000

-- Genre distribution
SELECT "primaryGenre", COUNT(*) as count
FROM "VerifiedTrack"
GROUP BY "primaryGenre"
ORDER BY count DESC
LIMIT 20
```

---

## Technical Implementation Details

### Folder Structure
```
scripts/
├── fetch-1m-batch.js          ← Phase 2 (Collection)
├── turbo-upsert.js            ← Phase 3 (Import)
├── fetch-500k.js              ← Phase 1 (Reference - 334k used)
├── migrate-to-postgres.js     ← Phase 1 (Reference - proven bulk import)
└── fix-identifiers.js         ← Deduplication utility

ingest/
├── staging-results-1m-batch-*.json    ← Phase 2 output
├── staging-results-1m-checkpoint.json ← Phase 2 resumable state
└── staging-results-1m-final.json      ← Phase 2 final output

lib/
├── music-search.ts            ← Production search queries (raw SQL)
└── database.ts                ← Prisma client config (postgresql)
```

### Key Files & Versions

**fetch-1m-batch.js** (Production)
- Version: 1.0
- Lines: 414
- Features:
  - 600+ search queries (genres, playlists, regional)
  - 50k batch checkpointing
  - In-memory deduplication
  - Rate limiting (50ms/req)
  - Resumable collection
  - Error handling & logging

**turbo-upsert.js** (Proven)
- Status: Same logic as Phase 1 (working)
- Batch size: 2000 tracks per insert
- Speed: 630 tracks/sec
- Deduplication: By Spotify ID, ISRC, MBID
- Will use for 1M import

### Database Schema

**Table: VerifiedTrack**
```sql
id                    BIGINT PRIMARY KEY
title                 VARCHAR
artist                VARCHAR
album                 VARCHAR
primaryGenre          VARCHAR
genres                TEXT
mood                  VARCHAR
trackPopularity       INT
verifiedAt            TIMESTAMP
releaseDate           DATE
durationSeconds       INT
explicit              BOOLEAN
collectionMethod      VARCHAR (Phase 1 | Phase 2 Spotify | Phase 2 MusicBrainz)
```

**Table: Identifier**
```sql
id                    BIGINT PRIMARY KEY
verifiedTrackId       BIGINT FK → VerifiedTrack
type                  VARCHAR (spotify | youtube | isrc | musicbrainz)
value                 VARCHAR
source                VARCHAR
addedAt               TIMESTAMP
```

---

## Risk Mitigation

### Data Loss Prevention

| Risk | Mitigation |
|------|-----------|
| Collection interrupted | Checkpoint every 50k songs, resumable state file |
| Database connection fails | Batch import up to 2k tracks at a time, can retry failed batches |
| Duplicate data | In-memory Map dedup during collection, DB constraint checks during import |
| API rate limit exceeded | 50ms per request limit (20 req/sec), well below Spotify limits |
| Network timeout | Checkpoint file allows complete restart from known position |

### Recovery Procedures

**If collection interrupted:**
```
1. Check ingest/staging-results-1m-checkpoint.json
2. Note totalTracks and nextBatch
3. Run: node scripts/fetch-1m-batch.js
4. Script auto-resumes from checkpoint
5. Continue until 1M reached
```

**If import fails:**
```
1. Verify ingest/staging-results-1m-final.json exists
2. Run: $env:DATABASE_URL="..."; node scripts/turbo-upsert.js ...
3. turbo-upsert handles idempotent upserts
4. Can safely retry without duplicates
```

---

## Success Criteria

### Phase 1 ✅ COMPLETE
- [x] 334,643 tracks migrated to Postgres
- [x] 608,238 identifiers deduplicated
- [x] All metadata fields preserved
- [x] Spotify links working in production
- [x] Search queries returning results

### Phase 2 🚀 IN PROGRESS
- [ ] Collect 1,000,000 unique tracks from Spotify
- [ ] 50k batch checkpoints saved
- [ ] Regional diversity achieved (30+ countries)
- [ ] Genre coverage complete (80+ genres)
- [ ] staging-results-1m-final.json generated

### Phase 3 ⏳ QUEUED
- [ ] 1M songs imported to VerifiedTrack table
- [ ] ~850k-950k identifiers in Identifier table
- [ ] All metadata searchable via raw SQL
- [ ] Production queries returning results
- [ ] Performance metrics verified (< 100ms per search)

---

## Performance Benchmarks

### Phase 1 (334k songs) ✅
- Collection: N/A (local import)
- Import: 9 minutes
- Speed: 630 tracks/sec
- Identifiers: 608k unique

### Phase 2 (1M songs) 🚀
- Collection: ~1.5-2.5 hours (600 queries × batching)
- Import: ~26 minutes (1M ÷ 630 tracks/sec)
- Speed: ~630 tracks/sec (same as Phase 1)
- Expected identifiers: ~850k-950k unique

### Phase 3+ (Future scaling)
- 2M songs: ~52 minutes import
- 5M songs: ~2.2 hours import
- Linear scaling: 630 tracks/sec constant

---

## Monitoring & Logging

### Console Output (fetch-1m-batch.js)
```
🎵 1 MILLION SONGS COLLECTION - BATCH MODE

Target: 1,000,000 songs
Batch size: 50,000 songs per checkpoint
Expected batches: 20

📊 Total search queries: 600
⏱️  Estimated time: ~40 hours
🚀 Starting collection...

[1/600] Searching playlists... (12,345 tracks)
[2/600] Searching playlists... (23,456 tracks)
...
💾 Batch #1 saved: 50,000 total tracks
💾 Batch #2 saved: 100,000 total tracks
...

✅ COLLECTION COMPLETE
📊 Total unique tracks: 1,000,000
⏱️  Time elapsed: 2.1h
📈 Speed: 7,936 tracks/minute
📁 Final file saved: ingest/staging-results-1m-final.json
```

### Checkpoint File Format
```json
{
  "tracks": [...],
  "collectedAt": "2025-11-19T15:45:32.123Z",
  "nextBatch": 5,
  "totalTracks": 250000,
  "searchQueriesProcessed": 300
}
```

---

## Next Steps (Action Items)

1. ✅ **Phase 2 Execution:** Collection running via `fetch-1m-batch.js`
   - Monitor: Check `ingest/` folder for batch files
   - Resume capability: If interrupted, re-run same command
   - Time: 1.5-2.5 hours until completion

2. ⏳ **Phase 3 Ready:** Once `staging-results-1m-final.json` exists
   ```powershell
   $env:DATABASE_URL="postgres://...@db.prisma.io:5432/?sslmode=require"
   node scripts/turbo-upsert.js ingest/staging-results-1m-final.json
   ```

3. ⏳ **Verification:** Run SQL queries to confirm
   - COUNT tracks: Should be ~1M
   - COUNT identifiers: Should be ~850k-950k
   - Search performance: Should be <100ms

4. ⏳ **Production Test:** Verify AI playlists with expanded library
   - More diverse suggestions
   - Better regional coverage
   - Deeper genre matching

---

## References & Related Documents

- **MIGRATION_COMPLETE.md** - Phase 1 detailed results & fixes
- **scripts/fetch-1m-batch.js** - Phase 2 collection script (current)
- **scripts/turbo-upsert.js** - Phase 3 import script
- **prisma/schema.prisma** - Database schema (postgresql provider)
- **lib/music-search.ts** - Production search implementation (raw SQL)

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-19 15:45 UTC  
**Status:** Phase 2 collection running 🚀
