#!/usr/bin/env python3
import sqlite3
import os
import json
from pathlib import Path

db_path = Path("enhanced_music.db")

if not db_path.exists():
    print("❌ Database not found yet")
    exit(1)

conn = sqlite3.connect(str(db_path))
c = conn.cursor()

# Get counts
c.execute("SELECT COUNT(*) FROM songs")
total = c.fetchone()[0]

c.execute("SELECT COUNT(*) FROM songs WHERE artist IS NOT NULL")
with_artist = c.fetchone()[0]

c.execute("SELECT COUNT(*) FROM songs WHERE genres IS NOT NULL")
with_genres = c.fetchone()[0]

c.execute("SELECT COUNT(*) FROM songs WHERE bpm IS NOT NULL")
with_bpm = c.fetchone()[0]

c.execute("SELECT COUNT(DISTINCT artist) FROM songs")
unique_artists = c.fetchone()[0]

# Get file size
file_size_mb = db_path.stat().st_size / 1024 / 1024

# Get sample songs with artist
c.execute("""
    SELECT title, artist, genres, bpm 
    FROM songs 
    WHERE artist IS NOT NULL 
    LIMIT 3
""")
samples = c.fetchall()

print("\n📊 PHASE 2 IMPORT STATUS")
print("=" * 70)
print(f"\n✅ Database Status:")
print(f"   Total Songs: {total:,}")
print(f"   With Artist Field: {with_artist:,} ({100*with_artist/max(total,1):.1f}%)")
print(f"   With Genres: {with_genres:,} ({100*with_genres/max(total,1):.1f}%)")
print(f"   With BPM: {with_bpm:,} ({100*with_bpm/max(total,1):.1f}%)")
print(f"   Unique Artists: {unique_artists:,}")
print(f"   Database Size: {file_size_mb:.2f} MB")
print(f"   Target: 40,000 songs")
print(f"   Progress: {100*total/40000:.1f}%")

if samples:
    print(f"\n🎵 Sample Songs with Artists:")
    for title, artist, genres_json, bpm in samples:
        try:
            genres = json.loads(genres_json) if genres_json else []
            genre_str = ", ".join(genres[:2]) if genres else "N/A"
        except:
            genre_str = "Error parsing"
        print(f"   • {artist} - {title}")
        print(f"     Genres: {genre_str} | BPM: {bpm}")

print("\n" + "=" * 70)
if total >= 40000:
    print("✅ PHASE 2 IMPORT COMPLETE!")
else:
    print(f"⏳ Import In Progress ({100*total/40000:.1f}% complete)")
print("=" * 70 + "\n")

conn.close()
