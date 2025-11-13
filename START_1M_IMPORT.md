# 🎵 Start 1 Million Song Import

## Quick Start

```bash
cd scripts
python enhanced-music-importer.py
```

## What This Does

Imports **1,000,000 songs** from MusicBrainz across 31 genres, enriches with audio features from AcousticBrainz.

### Configuration
- **Genres**: 31 (pop, rock, hip-hop, electronic, house, techno, dubstep, ambient, indie, alternative, metal, jazz, blues, folk, country, reggae, r&b, soul, funk, disco, trap, phonk, hardstyle, drum and bass, jungle, grime, synthwave, vaporwave, lo-fi, indie rock, experimental, psychedelic, trance)
- **Per genre**: ~32,258 songs
- **Total**: ~1,000,000 songs
- **Threading**: ✅ Enabled (10 concurrent workers)
- **Estimated time**: **1-2 hours**

## Process

1. **📥 Fetch from MusicBrainz** (10-15 min)
   - Download metadata, artist, genres, release year per song
   - 10 concurrent threads querying different genres
   - Rate-limited to 1 request/second per thread

2. **🎵 Enrich with AcousticBrainz** (45-90 min)
   - Fetch audio features: BPM, key, energy, danceability
   - 20 concurrent threads (distributed rate limiting)
   - Average ~1-2 songs/second

3. **💾 Store to SQLite** (5-10 min)
   - Insert into songs table with all features
   - Create indexes on searchable fields

4. **✅ Verify** (1 min)
   - Print statistics and sample songs

## Advanced Options

```bash
# Disable threading (slower, more stable)
python enhanced-music-importer.py --no-thread

# Use custom worker count
python enhanced-music-importer.py --workers 20
```

## Expected Output

```
🎵 Enhanced Music Database Importer v2.0
======================================================================

📋 Import Configuration:
  Genres: 31
  Target total: 1,000,000 songs
  Per genre: ~32,258 songs
  Threading: ✅ Enabled (10 workers)
  Estimated time: 1-2 hours

📥 Importing from MusicBrainz...
   Genres: pop, rock, hip-hop, electronic, house... (31 total)
   Songs per genre: 32258
   Total target: 1,000,000 songs
   Threading: ✅ Enabled

  ⏳ Fetching pop...
  ⏳ Fetching rock...
  ⏳ Fetching hip-hop...
  ...
  ✅ pop: 32258 songs
  ✅ rock: 29842 songs
  ...
✅ Fetched 987,654 songs from MusicBrainz (errors: 2,346)

🎵 Enriching with AcousticBrainz features...
   Songs to enrich: 987,654
   Threading: ✅ Enabled
  [50000/987654] Enriched 28,934 songs...
  [100000/987654] Enriched 52,891 songs...
  ...
✅ Enriched 856,234/987,654 songs with audio features

💾 Storing 987,654 songs...
  [0/987654] Stored 0 songs...
  [1000/987654] Stored 1000 songs...
  ...
✅ Stored 987,654/987,654 songs

📊 Import Statistics:
  Total songs: 987,654
  With BPM: 856,234 (86.7%)
  With Energy: 856,234 (86.7%)
  With Genres: 987,654 (100.0%)
  With Popularity: 987,654 (100.0%)

  Sample songs:
    • The Weeknd - Blinding Lights | BPM: 87.34 | Energy: 0.72 | Genres: ['pop']
    • Billie Eilish - bad guy | BPM: 145.23 | Energy: 0.64 | Genres: ['pop']
    • Post Malone - Congratulations | BPM: 92.45 | Energy: 0.65 | Genres: ['pop']

✅ Import Complete!
   Database: enhanced_music.db
   Total songs: 987,654
   Total time: 1.2 hours
   Average: 822,545 songs/hour
   Ready for multi-field searching!
   Database size: 487.2 MB
```

## Next Steps

After import completes:

1. **Integrate into audio-search.ts**
   - Update `lib/audio-search.ts` to use new database
   - Integrate QueryAnalyzer for query type detection
   - Integrate MusicScorer for context-aware ranking

2. **Test the algorithm**
   - Test artist queries: "phonk artist"
   - Test genre queries: "hardstyle"
   - Test mood queries: "chill"
   - Test feature queries: "120 bpm"

3. **Monitor performance**
   - Query time: Should be <100ms for all queries
   - Coverage: Should find results for all niche genres
   - Accuracy: Test with playlists

## Troubleshooting

**Import stuck?**
- Normal - AcousticBrainz enrichment can be slow
- Check system resources (CPU, RAM, disk space)
- Estimated remaining time can be calculated from progress

**Errors during import?**
- Some songs may fail to enrich (no AcousticBrainz data)
- This is normal - we still store the song with partial data
- Final count may be slightly less than target (usually 95-98% success)

**Want to stop?**
- Press Ctrl+C
- Database can be resumed (just run again)
- Already imported songs won't be re-imported (UNIQUE constraint on MBID)

## Storage

- **Database file**: `enhanced_music.db`
- **Expected size**: ~400-500 MB for 1M songs
- **Index overhead**: ~50-100 MB (indexes on genres, artist, title, bpm, energy, popularity)
- **Total**: ~500 MB with indexes

This is MUCH smaller than storing audio files (which would be 100GB+) and still provides powerful search capabilities.
