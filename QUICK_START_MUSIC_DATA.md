# 🚀 Quick Start: Populate Your Music Database

## The Goal
Get **real music data** into your local database so the AI playlist generator can make better recommendations without relying 100% on Spotify API.

## What You'll Get
- ✅ 1,000+ songs with metadata (title, artist, genre)
- ✅ Audio features (BPM, tempo, energy, danceability)
- ✅ Local search index for fast recommendations
- ✅ Fallback when Spotify API fails or rate-limits

## Prerequisites

```bash
# Install Python dependencies
pip install requests

# Verify Python 3.6+
python --version
```

## Step 1: Run the Quick Import

```bash
# Navigate to your project
cd c:\Users\Joabzz\Documents\Visual Studio Code\mediasite

# Run the import script
python scripts/quick-music-import.py
```

**What it does:**
1. Creates `audio_features.db` SQLite database
2. Fetches ~300 songs from MusicBrainz (10 genres × 30 songs)
3. Enriches with audio features from AcousticBrainz API
4. Stores in local database
5. Shows statistics

**Time:** ~2-5 minutes (depends on network)

**Output:**
```
🎵 MediaSite Music Data Pipeline
==================================================

📋 Fetching music from public databases...
   Genres: electronic, indie, lo-fi, synthwave, ambient, jazz, hip-hop, rock, pop, folk
   This will take a few minutes...

📥 Fetching from MusicBrainz...
  Searching genre: electronic
    ✓ Got 30 recordings
  Searching genre: indie
    ✓ Got 30 recordings
  ...

✅ Fetched 300 songs from MusicBrainz

🎵 Enriching with AcousticBrainz features...
  [10/300] Enriched 8 songs...
  [20/300] Enriched 15 songs...
  ✅ Enriched 250/300 songs with audio features

💾 Storing 300 songs in SQLite...
  ✅ Stored 300/300 songs

📊 Database Statistics:
  Total songs: 300
  With BPM: 250 (83.3%)
  With Energy: 245 (81.7%)
  With Danceability: 300 (100%)

  Sample songs:
    Daft Punk - One More Time (BPM: 120.0, Energy: 0.65, Dance: 0.85)
    Tame Impala - The Less I Know... (BPM: 97.5, Energy: 0.52, Dance: 0.60)
    Billie Eilish - Bad Guy (BPM: 135.0, Energy: 0.48, Dance: 0.72)

✅ Pipeline Complete!
   Database: audio_features.db
   Songs stored: 300

🔍 Next step:
   Your AI playlist generator will now use local data!
   Try searching for 'lo-fi study music' or 'electronic chill'
```

## Step 2: Verify It Works

### Check the database file
```bash
# List files - should see audio_features.db
dir | findstr "audio_features"

# Output: audio_features.db
```

### Check contents with SQLite
```bash
# Query the database
sqlite3 audio_features.db "SELECT COUNT(*) as total FROM features;"

# Output: 300
```

### Check your AI playlist generator
1. Go to `http://localhost:3000/ai`
2. Try these prompts:
   - "lo-fi study music"
   - "electronic chill vibes"
   - "jazz for coding"
   - "upbeat indie"

3. Check server logs for:
```
🎯 GENRE-BASED APPROACH: Found X genres
📊 Spotify has 126 available genres
📡 Searching local SQLite database...
✅ Got X candidates from local database
```

If you see **"Got X candidates from local database"**, it's working! 🎉

## Step 3: Scale Up (Optional)

Want **more songs** for better results?

### Option A: Run again with more genres

Edit `scripts/quick-music-import.py`:

```python
genres = [
    "electronic", "indie", "lo-fi", "synthwave", "ambient",
    "jazz", "hip-hop", "rock", "pop", "folk",
    "classical", "blues", "reggae", "metal", "soul",  # Add more
    "country", "rnb", "punk", "grunge", "techno",
]
```

Then run again:
```bash
python scripts/quick-music-import.py
```

The script will add new songs without duplicating existing ones.

### Option B: Download pre-built dataset

**Million Song Dataset** (400k songs):
```bash
# Download subset (7GB)
wget http://labrosa.ee.columbia.edu/millionsong/MSongsDB/MillionSongSubset.tar.gz
tar -xzf MillionSongSubset.tar.gz

# Then load into audio_features.db
# (I can create a loader script if needed)
```

## Step 4: How It Integrates

When user generates a playlist:

```
User: "chill study music"
    ↓
Algorithm parses prompt → Target BPM: 80-120, Energy: 0.5
    ↓
Searches local SQLite first
    ↓
Finds 50+ matching songs instantly
    ↓
Returns best matches to user
    ↓
If no local matches → Falls back to Spotify API
```

## Troubleshooting

### Script fails with "ModuleNotFoundError: No module named 'requests'"

```bash
pip install requests
python scripts/quick-music-import.py
```

### Script times out / internet issues

Edit `scripts/quick-music-import.py`, increase timeout:

```python
response = requests.get(url, params=params, timeout=30)  # Was 10, now 30
```

### Database not being used

Check logs:
```
If you see: "Local audio_features.db query failed, trying Postgres"
```

This means the script ran but songs aren't being found. Try:

```bash
# Check if database exists
ls -la audio_features.db

# Check contents
sqlite3 audio_features.db "SELECT COUNT(*) FROM features;"
```

### Still using Spotify for everything

This is normal! The algorithm uses:
1. Local database first (if has matching songs)
2. Spotify API fallback
3. AI generation last

If Spotify has good results, it will use those. The local database is a **performance optimization** and **fallback**, not a replacement.

## Success Criteria ✅

You'll know it's working when:

- [ ] `audio_features.db` file exists
- [ ] Running `python scripts/quick-music-import.py` doesn't error
- [ ] Database statistics show 300+ songs
- [ ] Searching "chill" finds local results
- [ ] Logs show "Got X candidates from local database"
- [ ] Playlists load faster than before

## Next Steps

### Once local database is working:

1. **Add more songs** - run script again with different genres
2. **Add embeddings** - for semantic similarity
3. **Schedule updates** - run nightly to keep database fresh
4. **Monitor** - track which searches hit local vs Spotify

### To add even more features:

See `MUSIC_DATA_PIPELINE_GUIDE.md` for:
- Using librosa to extract features from audio files
- Connecting to PostgreSQL pgvector
- Building recommendation engine with embeddings
- Handling audio file storage

## Questions?

The core algorithm in `lib/audio-search.ts` handles all the lookup logic. You just need to populate the database! 🎵

Good luck! 🚀
