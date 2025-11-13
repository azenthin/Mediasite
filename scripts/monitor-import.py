#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Monitor the ongoing 1M import - tracks both fetching and enriching phases"""

import sqlite3
import time
import os
import sys
from datetime import datetime

if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def monitor():
    # Find the database (it's in the root, not scripts/)
    possible_paths = [
        "../enhanced_music.db",  # From scripts/
        "enhanced_music.db",      # From root
        "c:/Users/Joabzz/Documents/Visual Studio Code/mediasite/enhanced_music.db"
    ]
    
    db_path = None
    for path in possible_paths:
        if os.path.exists(path):
            db_path = path
            break
    
    if not db_path:
        print("ERROR: Could not find enhanced_music.db")
        print("Checked paths:")
        for path in possible_paths:
            print(f"  - {path}")
        return
    
    last_count = 0
    start_time = time.time()
    
    print("\n" + "=" * 70)
    print("IMPORT MONITOR - 1M Song Database")
    print("=" * 70)
    print(f"Database: {db_path}")
    print(f"Start time: {time.strftime('%H:%M:%S')}")
    print("=" * 70)
    print()
    
    while True:
        try:
            if os.path.exists(db_path):
                conn = sqlite3.connect(db_path)
                cursor = conn.cursor()
                
                # Get counts
                cursor.execute("SELECT COUNT(*) FROM songs")
                total = cursor.fetchone()[0]
                
                cursor.execute("SELECT COUNT(*) FROM songs WHERE bpm IS NOT NULL")
                with_bpm = cursor.fetchone()[0]
                
                cursor.execute("SELECT COUNT(*) FROM songs WHERE energy IS NOT NULL")
                with_energy = cursor.fetchone()[0]
                
                cursor.execute("SELECT COUNT(*) FROM songs WHERE genres IS NOT NULL")
                with_genres = cursor.fetchone()[0]
                
                elapsed = time.time() - start_time
                rate = total / elapsed if elapsed > 0 else 0
                remaining = (1_000_000 - total) / rate if rate > 0 else 0
                
                eta_seconds = int(remaining)
                eta_hours = eta_seconds // 3600
                eta_mins = (eta_seconds % 3600) // 60
                
                db_size_mb = os.path.getsize(db_path) / (1024 * 1024)
                
                # Status
                if total == 0:
                    phase = "FETCHING from MusicBrainz"
                elif total < 500000:
                    phase = "ENRICHING with AcousticBrainz"
                else:
                    phase = "STORING to Database"
                
                elapsed_hours = elapsed / 3600
                elapsed_mins = (elapsed % 3600) / 60
                
                # Print status line
                status_line = (f"[{time.strftime('%H:%M:%S')}] "
                             f"Songs: {total:>7,} | "
                             f"With BPM: {with_bpm:>7,} ({100*with_bpm/max(total,1):>5.1f}%) | "
                             f"Rate: {rate:>6.1f}/s | "
                             f"Elapsed: {elapsed_hours:>5.1f}h | "
                             f"ETA: {eta_hours:>2}h {eta_mins:>2}m | "
                             f"Size: {db_size_mb:>6.1f}MB")
                
                print(f"\r{status_line}", end='', flush=True)
                
                conn.close()
            else:
                print(f"Database not found at {db_path}")
            
            time.sleep(30)  # Check every 30 seconds
        
        except KeyboardInterrupt:
            print("\n\nMonitoring stopped.")
            break
        except Exception as e:
            print(f"\nError: {e}")
            import traceback
            traceback.print_exc()
            time.sleep(30)

if __name__ == "__main__":
    monitor()
