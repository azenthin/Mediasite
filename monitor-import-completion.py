#!/usr/bin/env python3
"""
Monitor Phase 2 Import Until Completion
Checks progress every 60 seconds and displays status
"""
import sqlite3
import os
import json
import time
import sys
from pathlib import Path
from datetime import datetime

db_path = Path("enhanced_music.db")

def check_status():
    if not db_path.exists():
        print("❌ Database not found yet")
        return None, None, None
    
    try:
        conn = sqlite3.connect(str(db_path))
        c = conn.cursor()
        
        c.execute("SELECT COUNT(*) FROM songs")
        total = c.fetchone()[0]
        
        c.execute("SELECT COUNT(*) FROM songs WHERE artist IS NOT NULL")
        with_artist = c.fetchone()[0]
        
        c.execute("SELECT COUNT(*) FROM songs WHERE bpm IS NOT NULL")
        with_bpm = c.fetchone()[0]
        
        c.execute("SELECT COUNT(DISTINCT artist) FROM songs")
        unique_artists = c.fetchone()[0]
        
        file_size_mb = db_path.stat().st_size / 1024 / 1024
        
        conn.close()
        return total, with_artist, with_bpm, unique_artists, file_size_mb
    except Exception as e:
        print(f"Error: {e}")
        return None, None, None, None, None

print("\n🎵 PHASE 2 IMPORT MONITOR")
print("=" * 70)
print("Monitoring until database reaches 40,000 songs...")
print("=" * 70)

last_total = 0
check_count = 0

while True:
    result = check_status()
    if result and result[0]:
        total, with_artist, with_bpm, unique_artists, file_size = result
        progress_pct = (total / 40000) * 100
        check_count += 1
        
        # Clear screen and print status
        os.system('cls' if os.name == 'nt' else 'clear')
        
        print("\n🎵 PHASE 2 IMPORT MONITOR - LIVE STATUS")
        print("=" * 70)
        print(f"Last Updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Check #: {check_count}")
        print("\n📊 Database Status:")
        print(f"   Total Songs: {total:,} / 40,000")
        print(f"   Progress: {progress_pct:.1f}%")
        print(f"   With Artist: {with_artist:,} ({100*with_artist/max(total,1):.1f}%)")
        print(f"   With BPM: {with_bpm:,} ({100*with_bpm/max(total,1):.1f}%)")
        print(f"   Unique Artists: {unique_artists:,}")
        print(f"   Database Size: {file_size:.2f} MB")
        
        # Calculate rate
        if check_count > 1 and total > last_total:
            songs_per_minute = (total - last_total)
            if songs_per_minute > 0:
                minutes_remaining = (40000 - total) / songs_per_minute
                print(f"\n⏱️  Estimated Time:")
                print(f"   Songs/min: {songs_per_minute:.0f}")
                print(f"   Minutes remaining: ~{minutes_remaining:.0f}")
        
        # Check completion
        if total >= 40000:
            print("\n" + "=" * 70)
            print("✅ PHASE 2 IMPORT COMPLETE!")
            print("=" * 70)
            print(f"\n🎉 Final Stats:")
            print(f"   Total Songs: {total:,}")
            print(f"   Unique Artists: {unique_artists:,}")
            print(f"   Database Size: {file_size:.2f} MB")
            print(f"   Import completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            print("\nReady to validate new data format!")
            print("=" * 70 + "\n")
            break
        
        print("\n" + "=" * 70)
        print("(Checking every 60 seconds... Press Ctrl+C to exit)")
        print("=" * 70 + "\n")
        
        last_total = total
    
    time.sleep(60)
