#!/usr/bin/env python3
"""
Quick Start: Download music data from public sources and populate database
This script fetches songs from public APIs and stores them locally
"""

import os
import json
import sqlite3
import requests
from datetime import datetime
from typing import List, Dict, Optional

class QuickMusicImport:
    def __init__(self, sqlite_path: str = "audio_features.db"):
        self.sqlite_path = sqlite_path
        self.init_db()
    
    def init_db(self):
        """Create SQLite database if doesn't exist"""
        conn = sqlite3.connect(self.sqlite_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS features (
                id TEXT PRIMARY KEY,
                filename TEXT,
                title TEXT,
                artist TEXT,
                mbid TEXT,
                isrc TEXT,
                bpm REAL,
                key TEXT,
                energy REAL,
                danceability REAL,
                tags TEXT,
                created_at TIMESTAMP
            )
        """)
        
        conn.commit()
        conn.close()
        print("✅ SQLite database initialized")
    
    def import_from_musicbrainz(self, genres: List[str], per_genre: int = 50) -> List[Dict]:
        """
        Download songs by genre from MusicBrainz
        
        Args:
            genres: List of genres to search (e.g., ["electronic", "indie", "jazz"])
            per_genre: Number of songs per genre
        
        Returns:
            List of song dictionaries
        """
        print(f"\n📥 Fetching from MusicBrainz...")
        all_songs = []
        
        for genre in genres:
            print(f"  Searching genre: {genre}")
            
            try:
                # Search for recordings by genre
                url = "https://musicbrainz.org/ws/2/recording/"
                params = {
                    "query": f'primarytype:Single tag:{genre}',
                    "fmt": "json",
                    "limit": per_genre,
                }
                
                response = requests.get(
                    url,
                    params=params,
                    headers={"User-Agent": "MediaSite-MusicPipeline/1.0"},
                    timeout=10
                )
                response.raise_for_status()
                data = response.json()
                
                for recording in data.get("recordings", []):
                    # Get first artist
                    artist_credit = recording.get("artist-credit", [{}])[0]
                    artist_name = artist_credit.get("artist", {}).get("name", "Unknown")
                    
                    song = {
                        "id": recording.get("id"),
                        "title": recording.get("title"),
                        "artist": artist_name,
                        "mbid": recording.get("id"),
                        "isrc": recording.get("isrcs", [""])[0] if recording.get("isrcs") else None,
                        "bpm": None,  # Not in MusicBrainz, use AcousticBrainz
                        "key": None,
                        "energy": None,
                        "danceability": None,
                        "tags": json.dumps([genre]),
                    }
                    
                    all_songs.append(song)
                    
                print(f"    ✓ Got {len(data.get('recordings', []))} recordings")
                
            except Exception as e:
                print(f"    ❌ Error: {e}")
                continue
        
        return all_songs
    
    def enrich_with_acousticbrainz(self, songs: List[Dict]) -> List[Dict]:
        """
        Fetch audio features from AcousticBrainz API
        
        This is the key advantage - we get pre-extracted audio features!
        """
        print(f"\n🎵 Enriching with AcousticBrainz features...")
        enriched = 0
        
        for i, song in enumerate(songs, 1):
            if not song.get("mbid"):
                continue
            
            try:
                # Query AcousticBrainz for this recording
                url = f"https://acousticbrainz.org/api/v1/{song['mbid']}/low-level"
                response = requests.get(url, timeout=5)
                
                if response.status_code == 200:
                    data = response.json()
                    
                    # Extract useful features
                    song["bpm"] = data.get("rhythm", {}).get("bpm")
                    song["energy"] = data.get("lowlevel", {}).get("average_loudness")
                    
                    # Key detection
                    tonal = data.get("tonal", {})
                    if tonal.get("chords_changes_rate"):
                        song["key"] = tonal.get("key", {}).get("key")
                    
                    enriched += 1
                    
                    if i % 10 == 0:
                        print(f"  [{i}/{len(songs)}] Enriched {enriched} songs...")
                
            except Exception as e:
                # Silently skip if API unavailable
                pass
        
        print(f"  ✅ Enriched {enriched}/{len(songs)} songs with audio features")
        return songs
    
    def estimate_danceability(self, song: Dict) -> float:
        """
        Simple heuristic to estimate danceability
        Based on BPM (danceable songs are typically 90-130 BPM)
        """
        bpm = song.get("bpm")
        if not bpm:
            return 0.5  # Default middle value
        
        # Ideal dance range: 90-130 BPM
        if 90 <= bpm <= 130:
            danceability = 0.8 + (0.2 * (1 - abs(bpm - 110) / 40))  # Peak at 110
        elif 70 <= bpm < 90:
            danceability = 0.4 + (0.4 * (bpm - 70) / 20)
        elif 130 < bpm <= 160:
            danceability = 0.8 - (0.3 * (bpm - 130) / 30)
        else:
            danceability = 0.3
        
        return min(1.0, max(0.0, danceability))
    
    def store_songs_local(self, songs: List[Dict]) -> int:
        """Store songs in local SQLite database"""
        print(f"\n💾 Storing {len(songs)} songs in SQLite...")
        
        conn = sqlite3.connect(self.sqlite_path)
        cursor = conn.cursor()
        
        stored = 0
        for song in songs:
            try:
                # Calculate danceability if not present
                danceability = song.get("danceability") or self.estimate_danceability(song)
                
                cursor.execute("""
                    INSERT OR REPLACE INTO features 
                    (id, filename, title, artist, mbid, isrc, bpm, key, energy, danceability, tags, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    song.get("id"),
                    song.get("filename", ""),
                    song.get("title"),
                    song.get("artist"),
                    song.get("mbid"),
                    song.get("isrc"),
                    song.get("bpm"),
                    song.get("key"),
                    song.get("energy"),
                    danceability,
                    song.get("tags", "[]"),
                    datetime.now().isoformat(),
                ))
                stored += 1
            except Exception as e:
                print(f"  Error storing {song.get('title')}: {e}")
        
        conn.commit()
        conn.close()
        
        print(f"  ✅ Stored {stored}/{len(songs)} songs")
        return stored
    
    def verify_import(self) -> Dict:
        """Check what we have in the database"""
        conn = sqlite3.connect(self.sqlite_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM features")
        total = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM features WHERE bpm IS NOT NULL")
        with_bpm = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM features WHERE energy IS NOT NULL")
        with_energy = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM features WHERE danceability IS NOT NULL")
        with_danceability = cursor.fetchone()[0]
        
        # Show sample
        cursor.execute("SELECT title, artist, bpm, energy, danceability FROM features LIMIT 3")
        samples = cursor.fetchall()
        
        conn.close()
        
        print(f"\n📊 Database Statistics:")
        print(f"  Total songs: {total}")
        print(f"  With BPM: {with_bpm} ({100*with_bpm/max(total,1):.1f}%)")
        print(f"  With Energy: {with_energy} ({100*with_energy/max(total,1):.1f}%)")
        print(f"  With Danceability: {with_danceability} ({100*with_danceability/max(total,1):.1f}%)")
        
        print(f"\n  Sample songs:")
        for title, artist, bpm, energy, danceability in samples:
            energy_str = f"{energy:.2f}" if energy else "N/A"
            dance_str = f"{danceability:.2f}" if danceability else "N/A"
            print(f"    {artist} - {title} (BPM: {bpm}, Energy: {energy_str}, Dance: {dance_str})")
        
        return {
            "total": total,
            "with_bpm": with_bpm,
            "with_energy": with_energy,
            "with_danceability": with_danceability,
        }

def main():
    """Run the import pipeline"""
    print("🎵 MediaSite Music Data Pipeline")
    print("=" * 50)
    
    # Initialize importer
    importer = QuickMusicImport("audio_features.db")
    
    # Define genres to import
    # These are just examples - MusicBrainz has many more!
    genres = [
        "electronic",
        "indie",
        "lo-fi",
        "synthwave",
        "ambient",
        "jazz",
        "hip-hop",
        "rock",
        "pop",
        "folk",
    ]
    
    print(f"\n📋 Fetching music from public databases...")
    print(f"   Genres: {', '.join(genres)}")
    print(f"   This will take a few minutes...")
    
    # Fetch songs from MusicBrainz
    songs = importer.import_from_musicbrainz(genres, per_genre=30)
    print(f"\n✅ Fetched {len(songs)} songs from MusicBrainz")
    
    # Enrich with AcousticBrainz features
    songs = importer.enrich_with_acousticbrainz(songs)
    
    # Store in local database
    stored = importer.store_songs_local(songs)
    
    # Verify
    stats = importer.verify_import()
    
    print(f"\n✅ Pipeline Complete!")
    print(f"   Database: audio_features.db")
    print(f"   Songs stored: {stats['total']}")
    print(f"\n🔍 Next step:")
    print(f"   Your AI playlist generator will now use local data!")
    print(f"   Try searching for 'lo-fi study music' or 'electronic chill'")

if __name__ == "__main__":
    main()
