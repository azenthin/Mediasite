# 🎵 Music Data Pipeline: Download → Extract Features → Store → Search

## Problem Statement

You want to:
1. **Download public music data** (metadata + audio files) from public databases
2. **Extract audio features** (tempo, BPM, energy, danceability, etc.)
3. **Store in local database** (SQLite `audio_features.db`)
4. **Use for algorithm-based searches** in your AI playlist generator

Currently: The algorithm **exists** (`lib/audio-search.ts`) but **no data pipeline to populate it**.

---

## Solution Architecture

### Step 1: Data Sources

Choose one or more public music databases:

| Source | Format | Access | Cost | Features |
|--------|--------|--------|------|----------|
| **FreeDB** | CDDB/XML | API | Free | Genre, artist, track metadata |
| **MusicBrainz** | JSON/RDF | Open API | Free | Complete database, CC licensed |
| **AcousticBrainz** | JSON | API | Free | Audio features extracted by AcousticBrainz |
| **Million Song Dataset** | H5 (HDF5) | Download | Free | 1M songs, audio features |
| **Spotify API** | JSON | OAuth | Free | 30-second previews, full metadata |
| **YouTube Audio Library** | MP3/M4A | Download | Free | Royalty-free music |

**Recommended Combo:**
1. **MusicBrainz** for metadata (artists, genres, etc.)
2. **AcousticBrainz** for pre-extracted audio features (saves processing!)
3. **Spotify API** for availability/links

---

## Step 2: Extract Audio Features

If using raw audio files, extract features:

**Tools available:**
- `librosa` (Python) - Industry standard
- `essentia` (C++) - More features
- `Jaudiotagger` (Java) - For tags
- `ffmpeg` (C) - For file conversion

**Features to extract:**
```javascript
{
  filename: string;              // File path/ID
  title: string;                 // Song name
  artist: string;                // Artist name
  mbid: string;                  // MusicBrainz ID
  duration: number;              // Seconds
  bpm: number;                   // Tempo
  key: string;                   // Musical key (C, D, Em, etc)
  energy: number;                // 0-1 (how energetic)
  danceability: number;          // 0-1 (how danceable)
  acousticness?: number;         // 0-1
  valence?: number;              // 0-1 (musical positiveness)
  instrumentalness?: number;     // 0-1
  liveness?: number;             // 0-1
  speechiness?: number;          // 0-1
  loudness?: number;             // dB
  tags: string;                  // JSON: ["genre1", "mood1"]
  embedding?: number[];          // Vector for similarity
}
```

---

## Step 3: Database Schema (Already in Your Code!)

Your schema is **ready to go**:

```prisma
model AudioFeatures {
  id             String   @id @default(cuid())
  songCacheId    String?  @unique
  filename       String
  duration       Float?
  bpm            Float?
  key            String?
  energy         Float?
  danceability   Float?
  rhythmStrength Float?
  spectralCentroid Float?
  embeddingBase64 String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([filename])
  @@index([bpm])
}

model SongCache {
  id           String   @id @default(cuid())
  title        String
  artist       String
  spotifyId    String?  @unique
  isrc         String?  @unique
  spotifyUrl   String?
  youtubeUrl   String?
  album        String?
  year         Int?
  duration     Int?
  thumbnailUrl String?
  hitCount     Int      @default(0)
  lastAccessed DateTime @default(now())
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([artist, title])
  @@index([lastAccessed])
  @@index([hitCount(sort: Desc)])
}
```

**To enable pgvector searches, also need:**
```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE audio_vectors (
  id TEXT PRIMARY KEY,
  embedding vector(1536),  -- OpenAI embeddings are 1536 dims
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_embedding ON audio_vectors USING ivfflat(embedding vector_cosine_ops);
```

---

## Step 4: Python Pipeline Script

Create `scripts/music-pipeline.py` to download and process:

```python
#!/usr/bin/env python3
"""
Music Data Pipeline
Downloads public music data, extracts features, stores in database
"""

import os
import json
import sqlite3
from typing import List, Dict
import requests
import librosa
import numpy as np
from psycopg2 import connect
from datetime import datetime

class MusicPipeline:
    def __init__(self, sqlite_path: str = "audio_features.db", postgres_url: str = None):
        """Initialize pipeline with database connections"""
        self.sqlite_path = sqlite_path
        self.postgres_url = postgres_url or os.getenv("DATABASE_URL")
        self.init_sqlite()
        
    def init_sqlite(self):
        """Create SQLite schema if not exists"""
        conn = sqlite3.connect(self.sqlite_path)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS features (
                id TEXT PRIMARY KEY,
                filename TEXT,
                title TEXT,
                artist TEXT,
                mbid TEXT,
                isrc TEXT,
                bpm REAL,
                key TEXT,
                energy REAL,
                danceability REAL,
                tags TEXT,
                created_at TIMESTAMP
            )
        """)
        conn.commit()
        conn.close()
    
    def fetch_musicbrainz(self, artist: str, limit: int = 100) -> List[Dict]:
        """Fetch songs from MusicBrainz API"""
        print(f"📥 Fetching from MusicBrainz: {artist}")
        url = f"https://musicbrainz.org/ws/2/artist/"
        params = {
            "query": f'artist:"{artist}"',
            "fmt": "json",
            "limit": limit
        }
        
        try:
            response = requests.get(url, params=params, headers={"User-Agent": "MediaSite/1.0"})
            data = response.json()
            
            songs = []
            for release in data.get("releases", []):
                songs.append({
                    "title": release.get("title"),
                    "artist": artist,
                    "mbid": release.get("id"),
                    "year": release.get("date", "")[:4],
                })
            
            print(f"✅ Got {len(songs)} songs")
            return songs
        except Exception as e:
            print(f"❌ Error fetching: {e}")
            return []
    
    def fetch_acousticbrainz(self, mbid: str) -> Dict:
        """Fetch pre-extracted audio features from AcousticBrainz"""
        url = f"https://acousticbrainz.org/api/v1/{mbid}/low-level"
        
        try:
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                data = response.json()
                return {
                    "bpm": data.get("rhythm", {}).get("bpm"),
                    "key": data.get("tonal", {}).get("key", {}).get("key"),
                    "energy": data.get("lowlevel", {}).get("average_loudness"),  # Approximate
                }
            return {}
        except Exception as e:
            print(f"⚠️  No AcousticBrainz data: {e}")
            return {}
    
    def extract_features_librosa(self, audio_file: str) -> Dict:
        """Extract audio features using librosa"""
        try:
            y, sr = librosa.load(audio_file, sr=None)
            
            # Tempo
            onset_env = librosa.onset.onset_strength(y=y, sr=sr)
            bpm = librosa.tempo(onset_env=onset_env, sr=sr)[0]
            
            # Chroma features for key detection (simplified)
            chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
            key_idx = np.argmax(np.mean(chroma, axis=1))
            keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
            key = keys[key_idx]
            
            # Energy (RMS)
            S = librosa.feature.melspectrogram(y=y, sr=sr)
            S_db = librosa.power_to_db(S, ref=np.max)
            energy = float(np.mean(S_db)) / 80  # Normalize to 0-1
            
            # Spectral centroid (perceived brightness)
            spec_cent = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
            
            # Zero crossing rate (noisiness)
            zcr = librosa.feature.zero_crossing_rate(y)[0]
            
            # Danceability approximation (tempo + beat strength)
            beat_frames = librosa.beat.beat_track(y=y, sr=sr)[1]
            danceability = min(1.0, bpm / 200 * 0.5 + len(beat_frames) / len(y) * 0.5)
            
            return {
                "bpm": bpm,
                "key": key,
                "energy": np.clip(energy, 0, 1),
                "danceability": np.clip(danceability, 0, 1),
                "spectral_centroid": float(np.mean(spec_centroid)),
                "zero_crossing_rate": float(np.mean(zcr)),
            }
        except Exception as e:
            print(f"❌ Extraction error: {e}")
            return {}
    
    def store_songs_sqlite(self, songs: List[Dict]):
        """Store songs in SQLite"""
        conn = sqlite3.connect(self.sqlite_path)
        cursor = conn.cursor()
        
        for song in songs:
            cursor.execute("""
                INSERT OR REPLACE INTO features 
                (id, filename, title, artist, mbid, isrc, bpm, key, energy, danceability, tags, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                song.get("id", song.get("mbid", song.get("title"))),
                song.get("filename", ""),
                song.get("title"),
                song.get("artist"),
                song.get("mbid"),
                song.get("isrc"),
                song.get("bpm"),
                song.get("key"),
                song.get("energy"),
                song.get("danceability"),
                json.dumps(song.get("tags", [])),
                datetime.now().isoformat(),
            ))
        
        conn.commit()
        conn.close()
        print(f"✅ Stored {len(songs)} songs in SQLite")
    
    def store_songs_postgres(self, songs: List[Dict]):
        """Store songs in PostgreSQL"""
        try:
            conn = connect(self.postgres_url)
            cursor = conn.cursor()
            
            for song in songs:
                # Insert to AudioFeatures
                cursor.execute("""
                    INSERT INTO "AudioFeatures" 
                    (id, filename, duration, bpm, key, energy, danceability, "rhythmStrength", created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
                """, (
                    song.get("id", song.get("mbid")),
                    song.get("filename", ""),
                    song.get("duration"),
                    song.get("bpm"),
                    song.get("key"),
                    song.get("energy"),
                    song.get("danceability"),
                    song.get("spectral_centroid"),
                ))
                
                # Insert to SongCache
                cursor.execute("""
                    INSERT INTO "SongCache" 
                    (title, artist, isrc, year, created_at, "updatedAt")
                    VALUES (%s, %s, %s, %s, NOW(), NOW())
                    ON CONFLICT DO NOTHING
                """, (
                    song.get("title"),
                    song.get("artist"),
                    song.get("isrc"),
                    song.get("year"),
                ))
            
            conn.commit()
            cursor.close()
            conn.close()
            print(f"✅ Stored {len(songs)} songs in PostgreSQL")
        except Exception as e:
            print(f"❌ PostgreSQL error: {e}")
    
    def run(self, artists: List[str]):
        """Run full pipeline"""
        all_songs = []
        
        for artist in artists:
            # Fetch metadata
            songs = self.fetch_musicbrainz(artist, limit=50)
            
            # Enrich with AcousticBrainz
            for song in songs:
                if song.get("mbid"):
                    features = self.fetch_acousticbrainz(song["mbid"])
                    song.update(features)
            
            all_songs.extend(songs)
        
        # Store
        self.store_songs_sqlite(all_songs)
        self.store_songs_postgres(all_songs)
        
        print(f"✅ Pipeline complete: {len(all_songs)} songs processed")

if __name__ == "__main__":
    pipeline = MusicPipeline()
    
    # Example: fetch music by artists
    artists = [
        "The Beatles",
        "Miles Davis",
        "Daft Punk",
        "Billie Eilish",
        "Tame Impala",
    ]
    
    pipeline.run(artists)
```

---

## Step 5: Integration with Your Algorithm

Your `lib/audio-search.ts` **already handles** this! Just ensure:

1. **SQLite database exists**: `audio_features.db`
2. **Postgres tables are populated**: `AudioFeatures`, `SongCache`
3. **Run the pipeline** to populate both

Then your algorithm will:
```
User prompt: "chill study music"
  ↓
parsePromptToSignature() → TargetSignature {tempo: 80-120, energy: 0.5, ...}
  ↓
findCandidates() → searches local SQLite or Postgres
  ↓
Returns 200 best matching tracks with scores
  ↓
AI playlist generator uses these as first choice!
```

---

## Step 6: Deployment Strategy

### Phase 1: Local Development
```bash
# Run the Python pipeline
python scripts/music-pipeline.py

# Verify SQLite
sqlite3 audio_features.db "SELECT COUNT(*) FROM features;"

# Test search
node -e "
  import { findCandidates, parsePromptToSignature } from './lib/audio-search.js';
  const sig = await parsePromptToSignature('chill study music');
  const candidates = await findCandidates(sig, 20);
  console.log(candidates);
"
```

### Phase 2: Production
```bash
# Run pipeline on schedule (nightly)
0 2 * * * python /path/to/music-pipeline.py

# Monitor database size
SELECT COUNT(*) FROM "AudioFeatures";  -- Should be 10k+
SELECT COUNT(*) FROM "SongCache";      -- Should be 10k+

# Check cache effectiveness
SELECT COUNT(*) FROM "SongCache" WHERE "hitCount" > 0;
```

---

## Alternative: Use Pre-extracted Datasets

Instead of extracting yourself, download pre-built datasets:

### Million Song Dataset
```bash
# Download subset (7GB, ~400k songs)
wget http://labrosa.ee.columbia.edu/millionsong/MSongsDB/MillionSongSubset.tar.gz
tar -xzf MillionSongSubset.tar.gz

# Has precomputed audio features (timbre, loudness, BPM, etc)
```

### FMA Dataset
```bash
# Free Music Archive - 917k tracks with metadata
wget https://github.com/mdeff/fma/releases/download/full/fma_full_metadata.zip

# Then map to your schema and bulk insert
```

---

## Success Criteria

✅ When complete:
- [ ] `audio_features.db` has 1000+ songs
- [ ] `AudioFeatures` table has 1000+ rows
- [ ] `SongCache` table has 1000+ rows
- [ ] Search for "chill" returns 50+ local results
- [ ] Latency <100ms for searches
- [ ] AI playlist generator prefers local matches over Spotify

---

## Questions to Answer

1. **Data source**: Which would you prefer?
   - [ ] MusicBrainz + AcousticBrainz (comprehensive, free)
   - [ ] Million Song Dataset (pre-processed, 400k songs)
   - [ ] YouTube Audio Library (royalty-free, ~10k tracks)
   - [ ] Multiple sources combined

2. **Processing method**:
   - [ ] Use pre-extracted features from AcousticBrainz
   - [ ] Extract yourself with librosa
   - [ ] Use Spotify API (30-second previews)

3. **Scale**:
   - [ ] Start small: 1,000 songs
   - [ ] Medium: 10,000 songs
   - [ ] Large: 100,000+ songs

4. **Infrastructure**:
   - [ ] Run locally during development
   - [ ] Run on schedule in production
   - [ ] Cloud-based batch processing

Let me know which direction you'd like to go, and I'll create the specific implementation! 🎵
