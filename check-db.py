import sqlite3
import json

conn = sqlite3.connect('enhanced_music.db')
cursor = conn.cursor()

# Get schema
cursor.execute("PRAGMA table_info(songs)")
cols = cursor.fetchall()
print("Database Columns:", [c[1] for c in cols])

# Count songs
cursor.execute('SELECT COUNT(*) FROM songs')
total = cursor.fetchone()[0]
print(f"\nTotal songs: {total}")

# Count with BPM
cursor.execute('SELECT COUNT(*) FROM songs WHERE bpm IS NOT NULL')
with_bpm = cursor.fetchone()[0]
print(f"Songs with BPM: {with_bpm} ({100*with_bpm/total:.1f}%)")

# Sample
cursor.execute('SELECT title, artist, bpm, genres FROM songs LIMIT 1')
sample = cursor.fetchone()
if sample:
    print(f"\nSample song:")
    print(f"  Title: {sample[0]}")
    print(f"  Artist: {sample[1]}")
    print(f"  BPM: {sample[2]}")
    print(f"  Genres: {sample[3]}")

conn.close()
