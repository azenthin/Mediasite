# Integration Complete: Ingestion Pipeline → AI Playlist Endpoint

**Date:** 2025-11-09  
**Change Summary:** Replaced old Spotify/YouTube search methods with verified tracks from ingestion pipeline

---

## What Changed

### Removed (Deprecated)
The following functions and APIs have been **disabled** in `lib/music-search.ts`:

1. **Old Spotify Search Flow:**
   - `getSpotifyToken()` — Spotify OAuth token acquisition
   - `getAvailableGenres()` — Genre seed list from Spotify
   - `GENRE_MAPPINGS` — Hardcoded genre aliases
   - `stringSimilarity()` — Fuzzy genre matching
   - `findSimilarGenres()` — Similarity-based genre resolution
   - Genre-based recommendations via Spotify API

2. **YouTube Integration:**
   - `searchYouTube()` — YouTube video search with ISRC support
   - YouTube URL enrichment

3. **Fallback Search Functions:**
   - `searchSpotify()` — Direct Spotify track search
   - `searchBoth()` — Combined Spotify + YouTube search
   - `verifySongs()` — AI song verification via Spotify/YouTube

### Added (New)

**Primary Source:** `queryVerifiedTracks(prompt: string, limit: number)` — queries `VerifiedTrack` table

- Searches by artist, title, or album name
- Returns canonicality-verified tracks from ingestion pipeline
- Includes Spotify and YouTube identifiers from `TrackIdentifier` relations
- Applies freshness sorting (2015+ songs prioritized, newest first)
- Falls back to local database cache if no ingestion results found

---

## API Endpoint Behavior

### GET `/api/ai/playlist` (New Priority Order)

```
1. Query VerifiedTrack table (ingestion pipeline) ← PRIMARY
   ↓
2. Fall back to local database cache (enhanced_music.db) ← SECONDARY
   ↓
3. Empty result (no Spotify search fallback)
```

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/ai/playlist \
  -H "Content-Type: application/json" \
  -d '{"prompt": "pop"}'
```

**Example Response (when VerifiedTrack data available):**
```json
{
  "success": true,
  "type": "playlist",
  "message": "Explore the vibe of pop!",
  "playlist": [
    {
      "title": "Song Title",
      "artist": "Artist Name",
      "year": 2023,
      "spotifyUrl": "https://open.spotify.com/track/...",
      "youtubeUrl": "https://www.youtube.com/watch?v=...",
      "verified": true,
      "source": "ingestion-pipeline"
    },
    ...
  ]
}
```

---

## VerifiedTrack Schema

The ingestion pipeline stores canonical tracks in the `VerifiedTrack` Prisma model:

```prisma
model VerifiedTrack {
  id           String   @id @default(cuid())
  internalUuid String   @unique @default(uuid())
  title        String
  artist       String
  album        String?
  isrc         String?  @unique    // International Standard Recording Code
  mbid         String?  @unique    // MusicBrainz ID
  spotifyId    String?  @unique
  acoustid     String?
  durationMs   Int?
  releaseDate  DateTime?
  rawProvider  String?  // JSON string with provider data
  verifiedAt   DateTime @default(now())
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  identifiers  TrackIdentifier[]  // Links to Spotify/YouTube/etc IDs
}

model TrackIdentifier {
  id         String   @id @default(cuid())
  type       String   // 'isrc' | 'mbid' | 'spotify' | 'acoustid' | 'youtube'
  value      String
  trackId    String
  track      VerifiedTrack @relation(fields: [trackId], references: [id])
  createdAt  DateTime @default(now())

  @@index([type, value])
  @@unique([type, value])
}
```

---

## Migration Path

### How to Populate VerifiedTrack

1. **Run ingestion pipeline:**
   ```bash
   npm run ingest:sample   # Processes sample CSV → staging
   npm run ingest:upsert   # Moves staging → VerifiedTrack table (DB)
   ```

2. **Verify data:**
   ```bash
   # Check metrics
   curl http://localhost:3000/api/ingest/status
   
   # Check queued/skipped records
   curl http://localhost:3000/api/ingest/queue
   ```

3. **Test AI playlist with real data:**
   ```bash
   curl -X POST http://localhost:3000/api/ai/playlist \
     -H "Content-Type: application/json" \
     -d '{"prompt": "pop"}'
   ```

### Fallback Behavior

If `VerifiedTrack` table is empty:
- Endpoint tries local `enhanced_music.db` cache
- If that's also empty: returns `[]` (no results)
- **Note:** No external API calls are made (old Spotify fallback removed)

---

## Benefits

✅ **Single Source of Truth:** All recommendations come from canonicality-scored ingestion results  
✅ **No Rate Limits:** Removed Spotify API dependencies (no token requests, genre seeds)  
✅ **Offline-Ready:** Uses local database cache as backup  
✅ **Consistent Quality:** Only serves tracks that passed ingestion canonicality filters  
✅ **Audit Trail:** Every recommendation can be traced to its ingestion source  
✅ **No API Failures:** Removed 404/429 errors from Spotify genre API  

---

## Testing

To verify the integration works:

```bash
# 1. Build and test
npm run build       # Should pass without errors
npm run test        # All tests should pass

# 2. Start dev server
npm run dev

# 3. Test AI playlist endpoint
# Without data in VerifiedTrack:
curl -X POST http://localhost:3000/api/api/playlist \
  -d '{"prompt": "rock"}' -H "Content-Type: application/json"
# → Returns: { success: true, type: "playlist", playlist: [] }

# 4. After populating VerifiedTrack via ingestion:
# Same curl should return verified tracks
```

---

## Files Modified

- `lib/music-search.ts` — Replaced Spotify/YouTube methods with `queryVerifiedTracks()`
- `app/api/ai/playlist/route.ts` — Uses new primary source (no changes needed)
- `app/api/ingest/queue/route.ts` — Type annotation fixes
- `app/api/ingest/queue/approve/route.ts` — Type annotation fixes
- `prisma/schema.prisma` — No changes (models already exist)

---

## Notes

- Old Spotify functions marked `@deprecated` and return null/empty
- No breaking changes to API contracts; only internal implementation changed
- Backward compatible: `getSpotifyRecommendations()` signature unchanged
- Requires ingestion pipeline data to be populated for recommendations to work
- Build passes all compilation checks and type validation

---

**Status:** ✅ Task #26 Complete  
**Next:** Task #27 (optional: Empty DB backup/clear)
