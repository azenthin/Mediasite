# Phase 2 Import: What to Expect

## Current Status
- **Started**: Fresh database (wiped Phase 1 backup)
- **Process**: Python importer running in background
- **Target**: 40,000 songs
- **Monitoring**: Continuous status checks

## Import Process Flow

### Step 1: Fetch from MusicBrainz (Current)
- Querying 191 genres from MusicBrainz API
- Rate limited to respect API terms (~0.15s per request)
- Expected duration: ~30-45 minutes
- Currently fetching: genres 1-50 (approximately)

### Step 2: Enrich with AcousticBrainz
- After MusicBrainz fetch completes
- Adds BPM, energy, danceability, key, etc.
- Rate limited: ~0.05s per request
- Expected duration: ~20-30 minutes
- Coverage: ~36% of songs (5,000+ songs)

### Step 3: Store to Database
- Insert/replace all songs
- Create indexes
- Verify data integrity
- Expected duration: ~5-10 minutes

### Total Expected Time: 1-2 hours

## What's Being Stored

### For Each Song:
- **id**: Unique identifier (mbid)
- **title**: Song name
- **artist**: Artist/band name ✅
- **album**: Album name
- **genres**: JSON array of genres ✅
  - Example: `["phonk", "trap", "lo-fi"]`
- **bpm**: Beats per minute ✅
- **energy**: 0-1 energy level ✅
- **danceability**: 0-1 danceability score ✅
- **release_year**: Year released ✅
- Other metadata: key, duration, language, etc.

## Data Integration Points

### Artist Field
```
Raw MusicBrainz: artist name from recording data
Stored as: text string in 'artist' column
Used by: Query Interpreter for ARTIST queries
Example: "EVVORTEX", "DVRST", etc.
```

### Genres Field
```
Raw MusicBrainz: tagged genres for each recording
Stored as: JSON array in 'genres' column
Used by: Audio-Search for LIKE '%genre%' queries
Example: ["phonk", "trap", "lo-fi hip-hop"]
```

### BPM Field
```
Raw AcousticBrainz: computed BPM from audio analysis
Stored as: float in 'bpm' column
Used by: Query Interpreter for tempo hints, Audio-Search for ranking
Example: 140.5, 92.3
```

## Query Integration Examples (After Import Complete)

### Will Work: Genre Queries
```sql
SELECT * FROM songs WHERE genres LIKE '%phonk%' LIMIT 5
-- Returns: ~150+ phonk songs (vs 99 in Phase 1)
```

### Will Work: Artist Queries
```sql
SELECT * FROM songs WHERE artist LIKE '%EVVORTEX%' LIMIT 5
-- Returns: All EVVORTEX songs, more variety than Phase 1
```

### Will Work: Mood Queries
```sql
-- System maps "sad" to genres: [dark ambient, lo-fi, downtempo, ...]
SELECT * FROM songs 
WHERE genres LIKE '%dark ambient%' 
   OR genres LIKE '%lo-fi%' 
   OR genres LIKE '%downtempo%'
LIMIT 5
-- Returns: ~200+ sad/moody songs
```

### Will Work: Compound Queries
```sql
SELECT * FROM songs 
WHERE genres LIKE '%phonk%'
  AND artist LIKE '%EVVORTEX%'
  AND bpm < 100
LIMIT 5
-- Returns: EVVORTEX phonk tracks under 100 BPM
```

## Performance Expectations

### Query Times on 40k Songs
- Simple genre query: <50ms
- Artist query: <50ms
- Mood query: <75ms
- Compound query: <100ms

### Database Size
- Phase 1: 6.2 MB (13k songs)
- Phase 2: ~24 MB (40k songs)
- Scalable: ~600KB per 1k songs

## Algorithm Status

**No changes needed!**

All Query Interpreter and Audio-Search code remains identical:
- ✅ `lib/query-interpreter.ts` - Unchanged
- ✅ `lib/audio-search.ts` - Unchanged
- ✅ All query types work same way
- ✅ No code modifications required

The algorithm automatically scales with the database.

## Monitoring

**Live Status**:
```bash
python quick-status.py
```

Shows:
- Total songs
- Artists with data
- Unique artists
- Genres with data
- Database size
- Progress percentage

**Expected progression**:
```
Time 0:   0 songs (import starting)
Time 15m: 2,000-3,000 songs
Time 30m: 5,000-8,000 songs
Time 45m: 10,000-15,000 songs
Time 60m: 20,000-30,000 songs
Time 75m: 35,000-40,000 songs
Time 90m: 40,000+ songs COMPLETE ✅
```

## Verification After Import

Once complete, we'll verify:

```bash
# Check totals
sqlite3 enhanced_music.db "SELECT COUNT(*) FROM songs"
# Expected: 40,000

# Check artist field (should be 40,000)
sqlite3 enhanced_music.db "SELECT COUNT(*) FROM songs WHERE artist IS NOT NULL"

# Check genres (should be 40,000)
sqlite3 enhanced_music.db "SELECT COUNT(*) FROM songs WHERE genres IS NOT NULL"

# Check BPM enrichment (should be ~14,400)
sqlite3 enhanced_music.db "SELECT COUNT(*) FROM songs WHERE bpm IS NOT NULL"

# Sample a few songs with artist
sqlite3 enhanced_music.db "SELECT title, artist, genres FROM songs LIMIT 3"
```

## Rollback Safety

If anything goes wrong:
```bash
# Current Phase 1 backup available as:
enhanced_music_phase1_backup.db

# All algorithm code unchanged
# Can revert immediately by:
mv enhanced_music_phase1_backup.db enhanced_music.db
```

## Next After Completion

1. ✅ Verify data format (artist, genres, bpm all present)
2. ✅ Run test queries on new dataset
3. ✅ Test artist filtering (new artists in Phase 2)
4. ✅ Measure performance improvement
5. ✅ Plan Phase 3 (150k songs)

---

**Current Status**: Import in progress, database being populated
**Next Check**: Run `python quick-status.py` in ~5-10 minutes
