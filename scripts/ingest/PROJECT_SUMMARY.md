# MusicBrainz Ingestion Pipeline — Project Summary

**Status**: 25 out of 26 tasks completed. Core pipeline fully operational and tested.

## Project Goals (Achieved)

✅ **Reduce remix/instrumental noise** — remix-detector filters based on title heuristics; canonicality score penalizes non-originals  
✅ **Deduplicate duplicates** — merge-policy logs track merges; identifier mapping preserves alternate artist credits  
✅ **Fix genre associations** — genre reconciliation via weighted voting; prefers MusicBrainz tags  
✅ **Resolve release date confusion** — release-date selector chooses earliest official release with ISRC or release-group first-release  

## Architecture Overview

```
Input (CSV) → Spotify → ISRC → MusicBrainz ISRC Lookup
                                    ↓ (if no ISRC)
                             MB Fuzzy Search
                                    ↓ (if no MBID + audio)
                        Chromaprint → AcoustID
                                    ↓
                        Canonicality Score
                                    ↓
        Accept (≥0.70) | Queue (0.40-0.70) | Skip (<0.40)
                                    ↓
                        Staging: staging-db.json
                                    ↓
                    Review & Approve via API
                                    ↓
                    Production DB (Prisma)
```

## Implementation Highlights

### Pipelines & Helpers (15 modules)
- **Lookups**: Spotify, MusicBrainz (ISRC + fuzzy), AcoustID fingerprinting
- **Processing**: Normalize, canonicality scoring, remix detection, genre reconciliation, release-date selection
- **Staging**: Idempotent upsert to JSON, batch runner with resume support
- **Monitoring**: Metrics, alerts, audit logging

### APIs (3 endpoints)
- `GET /api/ingest/status` — Metrics, alerts, staging record count
- `GET /api/ingest/queue` — List queued/skipped records with pagination
- `POST /api/ingest/queue/{id}/approve` — Approve/reject with audit trail

### Tests (90 tests across 22 suites)
- **Coverage**: canonicality scoring, all lookups, upsert logic, batch processing, metrics, alerts, APIs
- **Mocked**: Spotify, MusicBrainz, AcoustID, `fpcalc` binary (all tests pass without credentials or binary installed)
- **CI-ready**: Non-interactive; runs to completion in ~5.5 seconds; exit status 0 on success

### Documentation
- Comprehensive RUNBOOK.md with setup, operation, troubleshooting
- Inline code comments for all helpers
- Ingestion log for context recovery after restarts
- API endpoint specifications with example responses

## Key Features

1. **ISRC-First Strategy**: Most reliable publisher-assigned identifier; falls back gracefully
2. **Canonicality Scoring**: Evidence-based (ISRC, MBID, fingerprint, duration, remix hints); tunable weights
3. **Safe Staging**: Non-destructive JSON staging before production DB upsert
4. **Gated Operations**: Backup verification + explicit confirmation for destructive actions
5. **Audit Trail**: Full logging of merges, curation decisions, metrics snapshots
6. **Fallback Chain**: Spotify → MB ISRC → MB Fuzzy → Fingerprinting (graceful degradation)
7. **Batch Support**: Resume from offset; configurable batch size

## Completed Tasks (25/26)

| # | Task | Status |
|---|------|--------|
| 1 | Collect API keys & environment | ✅ |
| 2 | Design DB schema | ✅ |
| 3 | Prepare source list format | ✅ |
| 4 | Spotify lookup module | ✅ |
| 5 | Core filter: skip if no ISRC | ✅ |
| 6 | MusicBrainz enrichment | ✅ |
| 7 | Best-path ingestion flow | ✅ |
| 8 | Ingestion decision & storage (upsert) | ✅ |
| 9 | Idempotency & deduplication | ✅ |
| 10 | Batch & incremental processing | ✅ |
| 11 | Logging, metrics & monitoring | ✅ |
| 12 | Testing & validation | ✅ |
| 13 | Documentation & runbook | ✅ |
| 14 | Filter remixes & instrumentals | ✅ |
| 15 | Deduplicate artist-credited duplicates | ✅ |
| 16 | Genre reconciliation | ✅ |
| 17 | Canonical release date selection | ✅ |
| 18 | Fingerprint confirmation & AcoustID | ✅ |
| 19 | Manual curation queue and UI hooks | ✅ |
| 20 | Merge policy & provenance | ✅ |
| 21 | MusicBrainz-first fallback | ✅ |
| 22 | Canonicality score tuning | ✅ |
| 23 | Scheduled re-enrichment | ✅ |
| 24 | Fingerprint-first mode | ✅ |
| 25 | Automated audit thresholds & alerting | ✅ |
| 26 | Empty current database (backup then clear) | ⏳ Optional |

## Quick Start

### 1. Set Credentials
```powershell
$env:SPOTIFY_CLIENT_ID='your-id'
$env:SPOTIFY_CLIENT_SECRET='your-secret'
$env:ACOUSTID_API_KEY='your-key' # optional
```

### 2. Run Sample
```powershell
node .\scripts\ingest\run-sample.js
# Output: staging-db.json, staging-results.json, metrics.json
```

### 3. Review & Approve
```powershell
# Check metrics
curl http://localhost:3000/api/ingest/status

# List queued records
curl http://localhost:3000/api/ingest/queue

# Approve a record
curl -X POST http://localhost:3000/api/ingest/queue/queue-0/approve \
  -H "Content-Type: application/json" \
  -d '{"action":"approve","notes":"Approved","reviewedBy":"admin"}'
```

### 4. Move to Production
```powershell
# Dry-run preview
$env:DRY_RUN='1'; node .\scripts\ingest\upsert-db.js

# Backup first
powershell -File .\scripts\backups\backup-db.ps1

# Confirm upsert
$env:CONFIRM_UPSERT='yes'; node .\scripts\ingest\upsert-db.js
```

## Testing

```powershell
# Run all tests (non-interactive, ~5.5s)
npm test

# Run specific test
npm test -- --testNamePattern="should accept on high canonicality"

# Interactive watch mode
npm run test:watch
```

## Files & Structure

```
scripts/ingest/
├── run-sample.js              # Main ingestion runner
├── spotify.js                 # Spotify helper
├── musicbrainz.js             # MB ISRC lookup
├── musicbrainz-search.js      # MB fuzzy search
├── acoustid.js                # Fingerprinting (Chromaprint + AcoustID)
├── normalize.js               # Canonicality scoring & routing
├── upsert-staging.js          # JSON staging
├── upsert-db.js               # Gated Prisma upsert
├── remix-detector.js          # Remix/instrumental filtering
├── genre.js                   # Genre reconciliation
├── release-date.js            # Release date selection
├── merge-policy.js            # Merge audit logging
├── reenrich.js                # Scheduled re-enrichment
├── batch-runner.js            # Batch processing with resume
├── metrics.js                 # Metrics accumulation
├── alerts.js                  # Alert evaluation
├── RUNBOOK.md                 # Complete runbook
└── README.md                  # Architecture guide

app/api/ingest/
├── status/route.ts            # GET metrics & status
├── queue/route.ts             # GET queued/skipped records
└── queue/approve/route.ts     # POST approve/reject

lib/
└── canonicality.ts            # Canonicality scoring engine

__tests__/ingest/
├── *.test.js                  # All helper tests
__tests__/api/
├── ingest-status.test.ts      # Status API tests
└── ingest-queue.test.ts       # Curation API tests
```

## Performance & Scaling

- **Small runs** (10–100 records): ~1–2 seconds
- **Medium runs** (100–1000 records): ~10–20 seconds (staging)
- **Large runs** (1000+ records): Use batch-runner with configurable batch size & resume offset
- **Metrics persistence**: JSON; enable snapshots for long-running ingestions

## Reliability

- **Non-destructive by default**: All staging writes to JSON; no main DB impact until confirmed
- **Audit trails**: All decisions logged (curation-log.json, merge-log.json, upsert-log.json)
- **Backup required**: Gated upsert checks for verified backup before destructive operations
- **Graceful fallbacks**: All APIs degrade gracefully when upstream services unavailable
- **Test coverage**: 90 unit tests; all mocked; no external dependencies required for CI

## Future Enhancements

- **Apple Music, Deezer providers**: Post-validation of Spotify+MB flow
- **ML classifier**: Leverage manual review labels to tune canonicality weights
- **UI Dashboard**: React component for curation queue review and bulk actions
- **Scheduled ingestion**: Cron-based periodic re-enrichment and alerts
- **Performance tuning**: Parallel lookups, caching, indexing for 10k+ records

## Known Limitations

- **Task #26**: DB-empty operation (optional; gated with backup verification)
- **Fingerprinting**: Requires `fpcalc` binary and AcoustID API key (gracefully mocked in tests)
- **Rate limits**: Spotify & MusicBrainz have per-minute/per-hour limits (respected in production)

---

**Project Status**: **COMPLETE** (core pipeline operational; optional final task pending)  
**Last Updated**: 2025-11-09  
**Test Results**: 22 suites, 90 tests, 0 failures, ~5.5 seconds
