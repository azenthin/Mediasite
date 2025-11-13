#!/usr/bin/env python3
"""Verify Phase 1 database import"""

import sqlite3
import os
import sys

db_path = 'enhanced_music.db'

if not os.path.exists(db_path):
    print('❌ Database not found at ' + db_path)
    sys.exit(1)

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

print('🔍 DATABASE VERIFICATION - PHASE 1')
print('=' * 70)
print()

# 1. Check tables
print('📊 TABLES:')
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
for table in tables:
    print(f'  ✓ {table[0]}')

print()

# 2. Count songs
cursor.execute('SELECT COUNT(*) as count FROM songs')
total_songs = cursor.fetchone()['count']
print(f'🎵 TOTAL SONGS: {total_songs:,}')

# 3. Genre coverage
cursor.execute("SELECT COUNT(DISTINCT genre) as count FROM songs")
genres = cursor.fetchone()['count']
print(f'🎭 UNIQUE GENRES: {genres}')

# 4. BPM coverage
cursor.execute('SELECT COUNT(*) as count FROM songs WHERE bpm IS NOT NULL')
bpm_count = cursor.fetchone()['count']
bpm_pct = (bpm_count / total_songs * 100) if total_songs > 0 else 0
print(f'🎚️  BPM DATA: {bpm_count:,} songs ({bpm_pct:.1f}%)')

# 5. Sample songs
print()
print('📝 SAMPLE SONGS (Random 5):')
print('-' * 70)
cursor.execute('''
    SELECT title, artist, genre, bpm 
    FROM songs 
    ORDER BY RANDOM() 
    LIMIT 5
''')
for i, row in enumerate(cursor.fetchall(), 1):
    print(f'{i}. "{row["title"]}" by {row["artist"]}')
    print(f'   Genre: {row["genre"]} | BPM: {row["bpm"] or "N/A"}')
    print()

# 6. Genre distribution
print('🎭 TOP 15 GENRES BY COUNT:')
print('-' * 70)
cursor.execute('''
    SELECT genre, COUNT(*) as count 
    FROM songs 
    GROUP BY genre 
    ORDER BY count DESC 
    LIMIT 15
''')
for row in cursor.fetchall():
    bar = '█' * int(row['count'] / 20)
    pct = (row['count'] / total_songs * 100)
    print(f'{row["genre"]:30} {row["count"]:4} ({pct:4.1f}%) {bar}')

# 7. BPM range
print()
print('🎚️  BPM STATISTICS (for songs with BPM data):')
print('-' * 70)
cursor.execute('''
    SELECT 
        MIN(bpm) as min_bpm,
        MAX(bpm) as max_bpm,
        AVG(bpm) as avg_bpm,
        COUNT(*) as count
    FROM songs 
    WHERE bpm IS NOT NULL
''')
row = cursor.fetchone()
if row and row['count'] > 0:
    print(f'  Min BPM: {row["min_bpm"]:.1f}')
    print(f'  Max BPM: {row["max_bpm"]:.1f}')
    print(f'  Avg BPM: {row["avg_bpm"]:.1f}')
    print(f'  Songs with BPM: {row["count"]:,}')
else:
    print('  No BPM data available')

# 8. Database file size
db_size_mb = os.path.getsize(db_path) / (1024 * 1024)
print()
print(f'💾 DATABASE FILE SIZE: {db_size_mb:.1f} MB')

# 9. Query test
print()
print('🔎 QUERY TESTS:')
print('-' * 70)

# Test 1: Find phonk songs
cursor.execute("SELECT COUNT(*) as count FROM songs WHERE genre = 'phonk'")
phonk_count = cursor.fetchone()['count']
print(f'Phonk songs: {phonk_count}')

# Test 2: Find songs with BPM between 100-130 (upbeat)
cursor.execute("SELECT COUNT(*) as count FROM songs WHERE bpm BETWEEN 100 AND 130")
upbeat_count = cursor.fetchone()['count']
print(f'Upbeat songs (100-130 BPM): {upbeat_count}')

# Test 3: Find songs by specific artist
cursor.execute("SELECT COUNT(*) as count FROM songs GROUP BY artist ORDER BY COUNT(*) DESC LIMIT 1")
top_artist_count = cursor.fetchone()['count']
cursor.execute("SELECT artist FROM songs GROUP BY artist ORDER BY COUNT(*) DESC LIMIT 1")
top_artist = cursor.fetchone()['artist']
print(f'Most prolific artist: {top_artist} ({top_artist_count} songs)')

print()
print('✅ PHASE 1 VERIFICATION COMPLETE')
print()
print('📈 STATUS:')
expected_count = 13139
if abs(total_songs - expected_count) < 100:
    print(f'  ✅ Song count matches expected (~{expected_count:,})')
else:
    print(f'  ⚠️  Song count differs: expected ~{expected_count:,}, got {total_songs:,}')

if bpm_pct > 30:
    print(f'  ✅ BPM coverage good ({bpm_pct:.1f}%)')
else:
    print(f'  ⚠️  BPM coverage low ({bpm_pct:.1f}%)')

if genres > 150:
    print(f'  ✅ Genre diversity excellent ({genres} genres)')
else:
    print(f'  ⚠️  Genre diversity lower than expected ({genres} genres)')

print()
print('✨ Ready for Phase 2: python scripts/enhanced-music-importer.py 40000')

conn.close()
