#!/usr/bin/env python3
"""Quick test of the local audio_features.db"""

import sqlite3
import os

db_path = 'audio_features.db'

if not os.path.exists(db_path):
    print(f"❌ Database not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print(f"🔍 Testing local database: {db_path}\n")

# Test 1: Count total songs
cursor.execute('SELECT COUNT(*) FROM features')
total = cursor.fetchone()[0]
print(f"📊 Total songs in database: {total}")

# Test 2: Get songs in BPM range (80-120, typical for chill music)
cursor.execute(
    """SELECT title, artist, bpm, energy, danceability FROM features 
       WHERE bpm BETWEEN 80 AND 120 
       ORDER BY ABS(bpm - 100) ASC 
       LIMIT 5"""
)
rows = cursor.fetchall()
print(f"\n🎵 Sample songs (BPM 80-120, sorted by closeness to 100):")
for i, (title, artist, bpm, energy, danceability) in enumerate(rows, 1):
    energy_str = f"{energy:.2f}" if energy else "N/A"
    dance_str = f"{danceability:.2f}" if danceability else "N/A"
    print(f"  {i}. {artist or 'Unknown'} - {title or 'Unknown'} [BPM: {bpm}, Energy: {energy_str}, Dance: {dance_str}]")

# Test 3: Check how many songs have audio features
cursor.execute(
    """SELECT 
        COUNT(CASE WHEN bpm IS NOT NULL THEN 1 END) as with_bpm,
        COUNT(CASE WHEN energy IS NOT NULL THEN 1 END) as with_energy,
        COUNT(CASE WHEN danceability IS NOT NULL THEN 1 END) as with_danceability
       FROM features"""
)
with_bpm, with_energy, with_danceability = cursor.fetchone()
print(f"\n📈 Audio features coverage:")
print(f"  - With BPM: {with_bpm}")
print(f"  - With Energy: {with_energy}")
print(f"  - With Danceability: {with_danceability}")

conn.close()
print(f"\n✅ Database test completed successfully!\n")
