#!/usr/bin/env python3
"""
Simple Phase 2 Status - shows current state
"""
import sqlite3
import os
import json
from pathlib import Path

db_path = Path("enhanced_music.db")

if not db_path.exists():
    print("❌ Database not found")
    exit(1)

conn = sqlite3.connect(str(db_path))
c = conn.cursor()

c.execute("SELECT COUNT(*) FROM songs")
total = c.fetchone()[0]

c.execute("SELECT COUNT(*) FROM songs WHERE artist IS NOT NULL")
with_artist = c.fetchone()[0]

c.execute("SELECT COUNT(DISTINCT artist) FROM songs")
unique_artists = c.fetchone()[0]

c.execute("SELECT COUNT(*) FROM songs WHERE genres IS NOT NULL")
with_genres = c.fetchone()[0]

file_size_mb = db_path.stat().st_size / 1024 / 1024

print(f"Total: {total:,} | Artists: {with_artist:,} | Unique: {unique_artists:,} | Genres: {with_genres:,} | Size: {file_size_mb:.1f}MB | Progress: {100*total/40000:.1f}%")

conn.close()
