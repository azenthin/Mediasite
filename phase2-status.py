#!/usr/bin/env python3
"""
Quick status checker for Phase 2 import
Shows: song count, artists, unique artists, genres, BPM enrichment, size, progress
"""

import sqlite3
import os
from datetime import datetime

db_path = "enhanced_music.db"

def get_status():
    """Get current import status"""
    if not os.path.exists(db_path):
        return {
            "exists": False,
            "total": 0,
            "artists_with_data": 0,
            "unique_artists": 0,
            "genres_with_data": 0,
            "bpm_enriched": 0,
            "size_mb": 0,
            "progress": 0
        }
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Total songs
        cursor.execute("SELECT COUNT(*) FROM songs")
        total = cursor.fetchone()[0]
        
        # Artists with data
        cursor.execute("SELECT COUNT(*) FROM songs WHERE artist IS NOT NULL")
        artists_with_data = cursor.fetchone()[0]
        
        # Unique artists
        cursor.execute("SELECT COUNT(DISTINCT artist) FROM songs WHERE artist IS NOT NULL")
        unique_artists = cursor.fetchone()[0]
        
        # Genres with data
        cursor.execute("SELECT COUNT(*) FROM songs WHERE genres IS NOT NULL")
        genres_with_data = cursor.fetchone()[0]
        
        # BPM enrichment
        cursor.execute("SELECT COUNT(*) FROM songs WHERE bpm IS NOT NULL")
        bpm_enriched = cursor.fetchone()[0]
        
        conn.close()
        
        # Database size
        size_mb = os.path.getsize(db_path) / (1024 * 1024)
        
        # Progress (target is 40,000)
        progress = (total / 40000) * 100
        
        return {
            "exists": True,
            "total": total,
            "artists_with_data": artists_with_data,
            "unique_artists": unique_artists,
            "genres_with_data": genres_with_data,
            "bpm_enriched": bpm_enriched,
            "size_mb": size_mb,
            "progress": progress
        }
    except Exception as e:
        return {
            "exists": True,
            "error": str(e),
            "total": 0
        }

if __name__ == "__main__":
    status = get_status()
    
    if "error" in status:
        print(f"Error: {status['error']}")
    else:
        print(f"Time: {datetime.now().strftime('%H:%M:%S')}")
        print(f"Songs: {status['total']:,}/40,000 ({status['progress']:.1f}%)")
        print(f"Artists: {status['artists_with_data']:,} (unique: {status['unique_artists']:,})")
        print(f"Genres: {status['genres_with_data']:,}")
        print(f"BPM: {status['bpm_enriched']:,} ({(status['bpm_enriched']/max(1, status['total'])*100):.1f}%)")
        print(f"Size: {status['size_mb']:.1f} MB")
