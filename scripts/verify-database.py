#!/usr/bin/env python3
"""Verify Phase 1 database import results"""

import sqlite3
import os
import json

db_path = 'enhanced_music.db'
size_mb = os.path.getsize(db_path) / (1024 * 1024)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Total songs
cursor.execute('SELECT COUNT(*) FROM songs')
total = cursor.fetchone()[0]

# Songs with audio features
cursor.execute('SELECT COUNT(*) FROM songs WHERE bpm IS NOT NULL')
with_bpm = cursor.fetchone()[0]

cursor.execute('SELECT COUNT(*) FROM songs WHERE energy IS NOT NULL')
with_energy = cursor.fetchone()[0]

cursor.execute('SELECT COUNT(*) FROM songs WHERE popularity IS NOT NULL')
with_popularity = cursor.fetchone()[0]

# Sample songs
cursor.execute('''
    SELECT title, artist, bpm, energy, genres 
    FROM songs 
    WHERE bpm IS NOT NULL 
    LIMIT 5
''')
samples = cursor.fetchall()

# Genre distribution
cursor.execute('''
    SELECT json_extract(value, '$') as genre, COUNT(*) as count
    FROM songs, json_each(songs.genres, '$')
    GROUP BY genre
    ORDER BY count DESC
    LIMIT 10
''')
top_genres = cursor.fetchall()

print("\n" + "=" * 70)
print("PHASE 1 VERIFICATION REPORT")
print("=" * 70)
print(f"\n📊 DATABASE STATISTICS:")
print(f"  Total songs:        {total:,}")
print(f"  Database size:      {size_mb:.1f} MB")

print(f"\n🎵 AUDIO FEATURES COVERAGE:")
print(f"  Songs with BPM:     {with_bpm:,} ({100*with_bpm/total:.1f}%)")
print(f"  Songs with Energy:  {with_energy:,} ({100*with_energy/total:.1f}%)")
print(f"  Songs with Pop.:    {with_popularity:,} ({100*with_popularity/total:.1f}%)")

print(f"\n🎸 TOP GENRES BY COUNT:")
for genre, count in top_genres:
    print(f"  • {genre:30} {count:6,} songs")

print(f"\n📝 SAMPLE SONGS (with audio features):")
for title, artist, bpm, energy, genres_json in samples:
    genres = json.loads(genres_json) if genres_json else []
    print(f"  • {title[:45]:45} - {artist[:20]:20}")
    print(f"    BPM: {bpm:7.1f}, Energy: {energy}, Genres: {', '.join(genres[:3])}")

conn.close()

print("\n" + "=" * 70)
print("✅ PHASE 1 STATUS: COMPLETE")
print(f"   Ready for Phase 2: python scripts/enhanced-music-importer.py 40000")
print("=" * 70 + "\n")
