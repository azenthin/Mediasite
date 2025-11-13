#!/usr/bin/env python3
"""
Monitor Phase 2 import progress in real-time
Shows status every 60 seconds until completion
"""

import sqlite3
import os
import time
from datetime import datetime, timedelta

db_path = "enhanced_music.db"
target = 40000
check_interval = 60  # seconds

def get_status():
    """Get current database status"""
    if not os.path.exists(db_path):
        return {
            "exists": False,
            "total": 0,
            "artists_with_data": 0,
            "unique_artists": 0,
            "genres_with_data": 0,
            "bpm_enriched": 0,
            "size_mb": 0
        }
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM songs")
        total = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM songs WHERE artist IS NOT NULL")
        artists_with_data = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(DISTINCT artist) FROM songs WHERE artist IS NOT NULL")
        unique_artists = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM songs WHERE genres IS NOT NULL")
        genres_with_data = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM songs WHERE bpm IS NOT NULL")
        bpm_enriched = cursor.fetchone()[0]
        
        conn.close()
        
        size_mb = os.path.getsize(db_path) / (1024 * 1024)
        
        return {
            "exists": True,
            "total": total,
            "artists_with_data": artists_with_data,
            "unique_artists": unique_artists,
            "genres_with_data": genres_with_data,
            "bpm_enriched": bpm_enriched,
            "size_mb": size_mb
        }
    except Exception as e:
        return {
            "exists": True,
            "error": str(e),
            "total": 0
        }

def format_time(seconds):
    """Format seconds to HH:MM:SS"""
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    return f"{h:02d}:{m:02d}:{s:02d}"

def estimate_remaining(current, rate_per_sec):
    """Estimate remaining time in seconds"""
    if rate_per_sec <= 0:
        return None
    remaining = (target - current) / rate_per_sec
    return remaining

print("=" * 70)
print("PHASE 2 IMPORT MONITOR - Real-time Tracking")
print("=" * 70)
print(f"Target: {target:,} songs")
print(f"Update interval: Every {check_interval} seconds")
print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("=" * 70)

start_time = time.time()
last_total = 0
measurements = []

while True:
    try:
        elapsed = time.time() - start_time
        status = get_status()
        
        if "error" in status:
            print(f"[{format_time(elapsed)}] ⚠️  Database not ready: {status['error']}")
        else:
            total = status['total']
            progress = (total / target * 100) if total > 0 else 0
            
            # Calculate rate
            if len(measurements) > 0:
                prev_time, prev_count = measurements[-1]
                time_delta = elapsed - prev_time
                count_delta = total - prev_count
                rate = count_delta / time_delta if time_delta > 0 else 0
            else:
                rate = 0
            
            measurements.append((elapsed, total))
            
            # Keep only recent measurements for smoother rate calculation
            if len(measurements) > 5:
                measurements.pop(0)
            
            # Calculate average rate over all time
            if elapsed > 0:
                avg_rate = total / elapsed
            else:
                avg_rate = 0
            
            # Estimate remaining time
            if avg_rate > 0:
                remaining_secs = (target - total) / avg_rate
                remaining_time = format_time(remaining_secs)
            else:
                remaining_time = "calculating..."
            
            # Format output
            bar_filled = int(progress / 5)
            bar = "█" * bar_filled + "░" * (20 - bar_filled)
            
            print(f"\n[{format_time(elapsed)}] Progress: {bar} {progress:.1f}%")
            print(f"  Songs: {total:,}/{target:,}")
            print(f"  Artists: {status['artists_with_data']:,} (unique: {status['unique_artists']:,})")
            print(f"  Genres: {status['genres_with_data']:,}")
            print(f"  BPM: {status['bpm_enriched']:,} ({status['bpm_enriched']/max(1, total)*100:.1f}%)")
            print(f"  Rate: {avg_rate:.1f} songs/sec | Speed: {rate:.1f} songs/sec (recent)")
            print(f"  Size: {status['size_mb']:.1f} MB")
            print(f"  ETA: {remaining_time}")
            
            # Check if complete
            if total >= target:
                print(f"\n✅ IMPORT COMPLETE!")
                print(f"   Total songs: {total:,}")
                print(f"   Total time: {format_time(elapsed)}")
                print(f"   Average rate: {avg_rate:.1f} songs/sec")
                break
        
        time.sleep(check_interval)
    
    except KeyboardInterrupt:
        elapsed = time.time() - start_time
        print(f"\n\n⏹️  Monitoring stopped after {format_time(elapsed)}")
        break
    except Exception as e:
        print(f"❌ Error: {e}")
        time.sleep(check_interval)
