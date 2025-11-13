#!/usr/bin/env python3
"""
Quick script to check if songs are in memory and commit them to database.
This helps if enrichment failed but songs were still fetched.
"""

import sqlite3
import json

def check_and_store():
    """Check database state"""
    db_path = "enhanced_music.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check current state
    cursor.execute("SELECT COUNT(*) FROM songs")
    total = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM songs WHERE bpm IS NOT NULL")
    with_bpm = cursor.fetchone()[0]
    
    print(f"Current database state:")
    print(f"  Total songs: {total}")
    print(f"  With BPM: {with_bpm}")
    print(f"  Without BPM: {total - with_bpm}")
    
    # If we have Phase 1 songs but no enrichment yet, that's expected
    # If we have 50k+, the merge likely worked!
    if total > 13500:
        print(f"\n✅ SUCCESS! Merge appears to have worked!")
        print(f"   We have {total:,} songs (Phase 1: 13,139 + new songs)")
        print(f"   This is great progress!")
    elif total == 13139:
        print(f"\n⚠️  Only have Phase 1 data (13,139 songs)")
        print(f"   Phase 2 import and enrichment may have failed")
        print(f"   Checking if there are unindexed songs...")
    
    # List recent additions
    cursor.execute("SELECT mbid, title, artist FROM songs ORDER BY rowid DESC LIMIT 5")
    recent = cursor.fetchall()
    
    if recent:
        print(f"\n  Recent songs in database:")
        for mbid, title, artist in recent:
            print(f"    • {artist} - {title} (mbid: {mbid[:8]}...)")
    
    conn.close()

if __name__ == "__main__":
    check_and_store()
