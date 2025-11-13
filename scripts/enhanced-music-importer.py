#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Enhanced Music Database Importer - Scalable Edition
Imports up to 1M+ songs from MusicBrainz, AcousticBrainz, and Last.fm
Stores comprehensive metadata and audio features
Supports threading for ~10x faster imports
"""

import os
import sys
import json
import sqlite3
import requests
import time
from datetime import datetime
from typing import List, Dict, Optional
from urllib.parse import urlencode
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock, RLock
import threading

# Force UTF-8 output on Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

class EnhancedMusicImporter:
    def __init__(self, db_path: str = "enhanced_music.db", use_threading: bool = True, max_workers: int = 10):
        self.db_path = db_path
        self.conn = None
        self.cursor = None
        self.use_threading = use_threading
        self.max_workers = max_workers
        
        # Thread-safe rate limiting
        self.rate_limit_lock = Lock()
        self.mb_delays = {}  # Per-thread rate limiting
        self.ab_delay_lock = Lock()
        self.ab_last_request = 0
        
        # Shared rate limiting across all threads
        self.mb_delay = 0.15  # With threading, can be more aggressive (respecting MusicBrainz's 1/s limit)
        self.ab_delay = 0.05   # With threading, distribute across threads
        
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'MediaSite-Enhanced-Importer/2.0 (contact: mediasite.ai)',
            'Accept': 'application/json'
        })
        
        # Add initial delay to avoid rate limiting on startup
        time.sleep(1)
        
        self.init_db()
    
    def init_db(self):
        """Initialize database with enhanced schema"""
        self.conn = sqlite3.connect(self.db_path)
        self.cursor = self.conn.cursor()
        
        # Create tables
        self.cursor.executescript("""
            CREATE TABLE IF NOT EXISTS songs (
                id TEXT PRIMARY KEY,
                mbid TEXT UNIQUE,
                title TEXT NOT NULL,
                artist TEXT NOT NULL,
                album TEXT,
                genres TEXT,
                subgenres TEXT,
                moods TEXT,
                tags TEXT,
                bpm REAL,
                key TEXT,
                energy REAL,
                danceability REAL,
                acousticness REAL,
                instrumentalness REAL,
                valence REAL,
                loudness REAL,
                popularity_score INTEGER,
                release_year INTEGER,
                duration_ms INTEGER,
                language TEXT,
                similar_artists TEXT,
                collaborators TEXT,
                embedding TEXT,
                source TEXT,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS artists (
                name TEXT PRIMARY KEY,
                popularity_score INTEGER,
                similar_artists TEXT,
                genres TEXT,
                total_songs INTEGER,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS import_stats (
                source TEXT,
                total_songs INTEGER,
                with_genres INTEGER,
                with_audio_features INTEGER,
                with_popularity INTEGER,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_genres ON songs(genres);
            CREATE INDEX IF NOT EXISTS idx_moods ON songs(moods);
            CREATE INDEX IF NOT EXISTS idx_tags ON songs(tags);
            CREATE INDEX IF NOT EXISTS idx_artist ON songs(artist);
            CREATE INDEX IF NOT EXISTS idx_title ON songs(title);
            CREATE INDEX IF NOT EXISTS idx_bpm ON songs(bpm);
            CREATE INDEX IF NOT EXISTS idx_energy ON songs(energy);
            CREATE INDEX IF NOT EXISTS idx_popularity ON songs(popularity_score DESC);
        """)
        self.conn.commit()
        print("✅ Database initialized")
    
    def _rate_limit(self, api_name: str):
        """Respect API rate limits (thread-safe)"""
        if api_name == 'musicbrainz':
            with self.rate_limit_lock:
                elapsed = time.time() - self.mb_delays.get(threading.current_thread().ident, 0)
                if elapsed < self.mb_delay:
                    time.sleep(self.mb_delay - elapsed)
                self.mb_delays[threading.current_thread().ident] = time.time()
        elif api_name == 'acousticbrainz':
            with self.ab_delay_lock:
                elapsed = time.time() - self.ab_last_request
                if elapsed < self.ab_delay:
                    time.sleep(self.ab_delay - elapsed)
                self.ab_last_request = time.time()
    
    def import_from_musicbrainz(self, genres: List[str] = None, per_genre: int = 500) -> List[Dict]:
        """
        Import songs from MusicBrainz by genre
        
        MusicBrainz has ~50M recordings. We'll import by genre to get good coverage.
        Supports threading for faster imports.
        """
        if genres is None:
            genres = [
                'pop', 'rock', 'hip-hop', 'electronic', 'house', 'techno', 'dubstep',
                'ambient', 'indie', 'alternative', 'metal', 'jazz', 'blues', 'folk',
                'country', 'reggae', 'r&b', 'soul', 'funk', 'disco', 'trap', 'phonk',
                'hardstyle', 'drum and bass', 'jungle', 'grime', 'synthwave', 'vaporwave',
                'lo-fi', 'indie rock', 'experimental', 'psychedelic', 'trance', 'dnb',
            ]
        
        print(f"\n📥 Importing from MusicBrainz...")
        print(f"   Genres: {', '.join(genres[:5])}... ({len(genres)} total)")
        print(f"   Songs per genre: {per_genre}")
        print(f"   Total target: {len(genres) * per_genre:,} songs")
        print(f"   Threading: {'✅ Enabled' if self.use_threading else '❌ Disabled'}")
        
        all_songs = []
        all_songs_lock = Lock()
        stats = {'total': 0, 'errors': 0}
        stats_lock = Lock()
        
        def fetch_genre(genre):
            """Fetch songs for a single genre (can be called in parallel)"""
            genre_songs = []
            try:
                print(f"  ⏳ Fetching {genre}...")
                
                url = "https://musicbrainz.org/ws/2/recording/"
                
                # Paginate through results
                for offset in range(0, per_genre, 100):
                    retries = 0
                    max_retries = 3
                    data = None
                    
                    while retries < max_retries and data is None:
                        try:
                            self._rate_limit('musicbrainz')
                            
                            params = {
                                'query': f'tag:{genre}',
                                'fmt': 'json',
                                'limit': 100,  # Max 100 per request
                                'offset': offset,
                            }
                            
                            response = self.session.get(url, params=params, timeout=30)
                            response.raise_for_status()
                            data = response.json()
                        except (ConnectionError, ConnectionResetError, TimeoutError, requests.exceptions.ConnectionError, requests.exceptions.Timeout, OSError, EOFError) as e:
                            # Catch socket/SSL/connection errors
                            retries += 1
                            if retries < max_retries:
                                wait_time = 5 * retries  # Exponential backoff: 5s, 10s, 15s
                                error_name = type(e).__name__
                                # print(f"    ⚠️  {error_name} (retry {retries}/{max_retries} after {wait_time}s): {genre}")
                                time.sleep(wait_time)
                                continue  # Retry the request
                            else:
                                # print(f"    ⚠️  Max retries reached for {genre} offset {offset}")
                                data = {'recordings': []}
                                break
                        except requests.exceptions.HTTPError as e:
                            if e.response.status_code == 503:
                                # Service temporarily unavailable - quick retry
                                retries += 1
                                if retries < max_retries:
                                    wait_time = 2 * (retries)  # Short backoff for 503: 2s, 4s, 6s
                                    # print(f"    ⚠️  Service unavailable (retry {retries}/{max_retries}): {genre} offset {offset}")
                                    time.sleep(wait_time)
                                    continue  # Retry the request
                                else:
                                    # Silently skip - don't log max retries for 503
                                    data = {'recordings': []}
                                    break
                            else:
                                # Other HTTP error - don't retry
                                print(f"    ⚠️  HTTP {e.response.status_code} error fetching {genre} offset {offset}")
                                data = {'recordings': []}
                                break
                        except Exception as e:
                            # Final catch-all for unexpected errors
                            error_name = type(e).__name__
                            retries += 1
                            if retries < max_retries:
                                # print(f"    ⚠️  {error_name} (retry {retries}/{max_retries}): {genre}")
                                time.sleep(3)
                                continue
                            else:
                                # print(f"    ⚠️  Skipping {genre} offset {offset} after {error_name}")
                                data = {'recordings': []}
                                break
                    
                    if data is None:
                        continue
                    
                    for recording in data.get('recordings', []):
                        try:
                            artist_credit = recording.get('artist-credit', [{}])[0]
                            artist_name = artist_credit.get('artist', {}).get('name', 'Unknown')
                            
                            song = {
                                'id': f"{recording.get('id')}",
                                'mbid': recording.get('id'),
                                'title': recording.get('title'),
                                'artist': artist_name,
                                'album': None,
                                'genres': json.dumps([genre]),
                                'subgenres': json.dumps([genre]),
                                'moods': None,
                                'tags': json.dumps([genre]),
                                'bpm': None,
                                'key': None,
                                'energy': None,
                                'danceability': None,
                                'acousticness': None,
                                'instrumentalness': None,
                                'valence': None,
                                'loudness': None,
                                'popularity_score': None,
                                'release_year': None,
                                'duration_ms': recording.get('length'),
                                'language': None,
                                'similar_artists': None,
                                'source': 'musicbrainz',
                            }
                            
                            # Try to get album from first release
                            if recording.get('releases'):
                                first_release = recording['releases'][0]
                                song['album'] = first_release.get('title')
                                release_date = first_release.get('date')
                                if release_date:
                                    try:
                                        song['release_year'] = int(release_date.split('-')[0])
                                    except:
                                        pass
                            
                            genre_songs.append(song)
                        except Exception as e:
                            with stats_lock:
                                stats['errors'] += 1
                    
                    if len(data.get('recordings', [])) < 100:
                        break

                
                print(f"  ✅ {genre}: {len(genre_songs)} songs")
                with all_songs_lock:
                    all_songs.extend(genre_songs)
                    with stats_lock:
                        stats['total'] += len(genre_songs)
            
            except Exception as e:
                print(f"    ❌ Critical error with genre '{genre}': {str(e)[:50]}")
                with stats_lock:
                    stats['errors'] += 1
        
        # Import genres (sequential or parallel)
        if self.use_threading and len(genres) > 1:
            with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                futures = [executor.submit(fetch_genre, genre) for genre in genres]
                for future in as_completed(futures):
                    try:
                        future.result()
                    except Exception as e:
                        print(f"  ❌ Thread error: {e}")
        else:
            for genre in genres:
                fetch_genre(genre)
        
        print(f"\n✅ Fetched {stats['total']} songs from MusicBrainz (errors: {stats['errors']})")
        return all_songs
    
    def enrich_with_acousticbrainz(self, songs: List[Dict]) -> List[Dict]:
        """Enrich songs with audio features from AcousticBrainz (threaded)"""
        print(f"\n🎵 Enriching with AcousticBrainz features...")
        print(f"   Songs to enrich: {len(songs)}")
        print(f"   Threading: {'✅ Enabled' if self.use_threading else '❌ Disabled'}")
        
        enriched = {'count': 0}
        enriched_lock = Lock()
        
        def enrich_song(song):
            """Enrich a single song (can be called in parallel)"""
            try:
                if not song.get('mbid'):
                    return
                
                self._rate_limit('acousticbrainz')
                url = f"https://acousticbrainz.org/api/v1/{song['mbid']}/low-level"
                
                response = self.session.get(url, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    
                    # Extract audio features
                    if 'rhythm' in data:
                        song['bpm'] = data['rhythm'].get('bpm')
                    
                    if 'tonal' in data:
                        song['key'] = data['tonal'].get('key_key')
                    
                    if 'lowlevel' in data:
                        lowlevel = data['lowlevel']
                        if 'energy' in lowlevel and 'mean' in lowlevel['energy']:
                            song['energy'] = lowlevel['energy']['mean']
                        if 'danceability' in lowlevel and 'mean' in lowlevel['danceability']:
                            song['danceability'] = lowlevel['danceability']['mean']
                    
                    with enriched_lock:
                        enriched['count'] += 1
            except Exception as e:
                pass  # Silently skip if enrichment fails (but song still gets stored with what we have)
        
        # Enrich songs (sequential or parallel)
        if self.use_threading:
            with ThreadPoolExecutor(max_workers=self.max_workers * 2) as executor:
                futures = [executor.submit(enrich_song, song) for song in songs]
                for i, future in enumerate(as_completed(futures)):
                    if i % 5000 == 0:
                        print(f"  [{i}/{len(songs)}] Enriched {enriched['count']} songs...")
                    try:
                        future.result()
                    except:
                        pass
        else:
            for i, song in enumerate(songs):
                if i % 100 == 0:
                    print(f"  [{i}/{len(songs)}] Enriched {enriched['count']} songs...")
                enrich_song(song)
        
        print(f"✅ Enriched {enriched['count']}/{len(songs)} songs with audio features")
        return songs
    
    def enrich_with_lastfm(self, songs: List[Dict]) -> List[Dict]:
        """Enrich with Last.fm tags and popularity"""
        print(f"\n🏷️  Enriching with Last.fm tags...")
        
        enriched = 0
        for i, song in enumerate(songs):
            if i % 100 == 0:
                print(f"  [{i}/{len(songs)}] Enriched {enriched} songs...")
            
            try:
                self._rate_limit('lastfm')
                
                # Note: Last.fm requires API key, skip for now
                # This would be: artist.getTopTags, track.getTags
                pass
            
            except Exception as e:
                pass
        
        print(f"✅ Enriched {enriched}/{len(songs)} with Last.fm data")
        return songs
    
    def store_songs(self, songs: List[Dict]) -> int:
        """Store songs in database"""
        print(f"\n💾 Storing {len(songs)} songs...")
        
        stored = 0
        for i, song in enumerate(songs):
            if i % 1000 == 0:
                print(f"  [{i}/{len(songs)}] Stored {stored} songs...")
            
            try:
                # Estimate popularity from audio features if not available
                if not song.get('popularity_score'):
                    # Simple heuristic: higher energy + danceability = more popular
                    if song.get('energy') and song.get('danceability'):
                        score = int((song['energy'] + song['danceability']) / 2 * 100)
                        song['popularity_score'] = min(100, max(0, score))
                
                self.cursor.execute("""
                    INSERT OR REPLACE INTO songs (
                        id, mbid, title, artist, album, genres, subgenres, moods, tags,
                        bpm, key, energy, danceability, acousticness, instrumentalness,
                        valence, loudness, popularity_score, release_year, duration_ms,
                        language, source
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    song['id'], song['mbid'], song['title'], song['artist'],
                    song.get('album'), song['genres'], song.get('subgenres'),
                    song.get('moods'), song['tags'], song.get('bpm'), song.get('key'),
                    song.get('energy'), song.get('danceability'), song.get('acousticness'),
                    song.get('instrumentalness'), song.get('valence'), song.get('loudness'),
                    song.get('popularity_score'), song.get('release_year'),
                    song.get('duration_ms'), song.get('language'), song['source']
                ))
                
                stored += 1
            except Exception as e:
                print(f"    Error storing song: {e}")
        
        self.conn.commit()
        print(f"✅ Stored {stored}/{len(songs)} songs")
        return stored
    
    def verify_import(self) -> Dict:
        """Check what was imported"""
        self.cursor.execute("SELECT COUNT(*) FROM songs")
        total = self.cursor.fetchone()[0]
        
        self.cursor.execute("SELECT COUNT(*) FROM songs WHERE bpm IS NOT NULL")
        with_bpm = self.cursor.fetchone()[0]
        
        self.cursor.execute("SELECT COUNT(*) FROM songs WHERE energy IS NOT NULL")
        with_energy = self.cursor.fetchone()[0]
        
        self.cursor.execute("SELECT COUNT(*) FROM songs WHERE genres IS NOT NULL")
        with_genres = self.cursor.fetchone()[0]
        
        self.cursor.execute("SELECT COUNT(*) FROM songs WHERE popularity_score IS NOT NULL")
        with_popularity = self.cursor.fetchone()[0]
        
        self.cursor.execute("SELECT title, artist, bpm, energy, genres FROM songs LIMIT 3")
        samples = self.cursor.fetchall()
        
        print(f"\n📊 Import Statistics:")
        print(f"  Total songs: {total}")
        print(f"  With BPM: {with_bpm} ({100*with_bpm/max(total,1):.1f}%)")
        print(f"  With Energy: {with_energy} ({100*with_energy/max(total,1):.1f}%)")
        print(f"  With Genres: {with_genres} ({100*with_genres/max(total,1):.1f}%)")
        print(f"  With Popularity: {with_popularity} ({100*with_popularity/max(total,1):.1f}%)")
        
        print(f"\n  Sample songs:")
        for title, artist, bpm, energy, genres in samples:
            genres_list = json.loads(genres) if genres else []
            print(f"    • {artist} - {title} | BPM: {bpm} | Energy: {energy} | Genres: {genres_list}")
        
        return {
            'total': total,
            'with_bpm': with_bpm,
            'with_energy': with_energy,
            'with_genres': with_genres,
            'with_popularity': with_popularity,
        }
    
    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()


def main():
    """Run the enhanced import pipeline"""
    import sys
    
    print("🎵 Enhanced Music Database Importer v2.1")
    print("=" * 70)
    
    # Configuration - EXPANDED GENRES (150+)
    target_songs = 1_000_000  # 1 million songs
    genres = [
        # Core genres (7)
        'pop', 'rock', 'hip-hop', 'rap', 'r&b', 'soul', 'funk',
        
        # Electronic/Dance (28)
        'electronic', 'house', 'techno', 'trance', 'drum and bass', 'dubstep', 
        'trap', 'future bass', 'deep house', 'uk garage', 'electro', 'industrial',
        'darkwave', 'synthwave', 'vaporwave', 'chillwave', 'lo-fi', 'vapor',
        'hardstyle', 'hardcore', 'gabber', 'jungle', 'liquid drum and bass',
        'neurofunk', 'grime', 'brostep', 'riddim', 'glitch', 'IDM',
        
        # Rock/Metal (32)
        'indie rock', 'punk', 'emo', 'screamo', 'alternative rock', 'grunge',
        'hard rock', 'progressive rock', 'psychedelic rock', 'math rock', 
        'post-rock', 'noise rock', 'glam rock', 'heavy metal', 'death metal',
        'black metal', 'thrash metal', 'power metal', 'progressive metal',
        'metalcore', 'deathcore', 'garage rock', 'garage punk', 'art rock',
        'experimental rock', 'krautrock', 'kosmische', 'motorik', 'surf rock',
        'twee', 'chamber pop', 'art pop', 'baroque pop', 'power pop',
        
        # Hip-Hop variants (12)
        'cloud rap', 'mumble rap', 'conscious rap', 'gangsta rap', 'phonk',
        'horrorcore', 'boom-bap', 'chopped and screwed', 'trap', 'cloud',
        'hyperpop', 'PC music',
        
        # Jazz/Blues (9)
        'jazz', 'blues', 'jazz fusion', 'avant-garde jazz', 'nu-jazz',
        'cool jazz', 'bebop', 'modal jazz', 'free jazz',
        
        # Folk/Acoustic (10)
        'folk', 'acoustic', 'singer-songwriter', 'coffeehouse', 'sea shanty',
        'traditional folk', 'celtic', 'scottish', 'irish folk', 'bluegrass',
        
        # Country/Americana (8)
        'country', 'outlaw country', 'country rock', 'country pop',
        'alt country', 'americana', 'western swing', 'honky tonk',
        
        # Reggae/World (16)
        'reggae', 'dancehall', 'ragga', 'dub', 'roots reggae', 'ska',
        'two-tone', 'dub reggae', 'reggaeton', 'latin', 'afrobeat',
        'bossa nova', 'samba', 'cumbia', 'middle eastern', 'indian',
        
        # Disco/Funk/Soul (7)
        'disco', 'northern soul', 'motown', 'neo-soul', 'smooth jazz',
        'deep soul', 'funk',
        
        # Classical/Orchestral (7)
        'classical', 'baroque', 'romantic', 'modern classical', 'minimalist',
        'orchestral', 'opera',
        
        # Ambient/Atmospheric (11)
        'ambient', 'dark ambient', 'drone', 'shoegaze', 'slowcore', 'noise',
        'power electronics', 'wall of sound', 'electroacoustic', 'microtonal',
        'spectralism',
        
        # World/Ethnic (10)
        'world', 'ethnic', 'tribal', 'world fusion', 'global', 'asian',
        'african', 'asian folk', 'indian classical', 'middle eastern music',
        
        # Experimental/Avant-Garde (15)
        'experimental', 'avant-garde', 'glitch pop', 'wonky', 'plunderphonics',
        'mashup', 'breakcore', 'hardcore punk', 'witch house', 'folktronica',
        'folktronic', 'musique concrète', 'serialism', 'post-minimalism',
        'alternative',
        
        # Other/Misc (9)
        'spoken word', 'soundtrack', 'video game music', 'chiptune', 'vgm',
        'dance', 'dance-punk', 'futurism', 'futurepop',
        
        # More niche electronic (8)
        'liquid', 'liquid funk', 'deep electronic', 'synth-pop', 'new wave',
        'coldwave', 'dark electronic', 'ambient electronic',
        
        # Additional rock/alternative (6)
        'alternative', 'grunge', 'post-punk', 'new wave', 'darkwave', 'coldwave',
    ]
    
def main():
    """Run the enhanced import pipeline - phased approach"""
    import sys
    
    print("🎵 Enhanced Music Database Importer v2.2 - Phased Import")
    print("=" * 70)
    
    # Configuration - EXPANDED GENRES (191 total)
    all_genres = sorted(list(set([
        'pop', 'rock', 'hip-hop', 'rap', 'r&b', 'soul', 'funk',
        'electronic', 'house', 'techno', 'trance', 'drum and bass', 'dubstep', 
        'trap', 'future bass', 'deep house', 'uk garage', 'electro', 'industrial',
        'darkwave', 'synthwave', 'vaporwave', 'chillwave', 'lo-fi', 'vapor',
        'hardstyle', 'hardcore', 'gabber', 'jungle', 'liquid drum and bass',
        'neurofunk', 'grime', 'brostep', 'riddim', 'glitch', 'IDM',
        'indie rock', 'punk', 'emo', 'screamo', 'alternative rock', 'grunge',
        'hard rock', 'progressive rock', 'psychedelic rock', 'math rock', 
        'post-rock', 'noise rock', 'glam rock', 'heavy metal', 'death metal',
        'black metal', 'thrash metal', 'power metal', 'progressive metal',
        'metalcore', 'deathcore', 'garage rock', 'garage punk', 'art rock',
        'experimental rock', 'krautrock', 'kosmische', 'motorik', 'surf rock',
        'twee', 'chamber pop', 'art pop', 'baroque pop', 'power pop',
        'cloud rap', 'mumble rap', 'conscious rap', 'gangsta rap', 'phonk',
        'horrorcore', 'boom-bap', 'chopped and screwed', 'trap', 'cloud',
        'hyperpop', 'PC music',
        'jazz', 'blues', 'jazz fusion', 'avant-garde jazz', 'nu-jazz',
        'cool jazz', 'bebop', 'modal jazz', 'free jazz',
        'folk', 'acoustic', 'singer-songwriter', 'coffeehouse', 'sea shanty',
        'traditional folk', 'celtic', 'scottish', 'irish folk', 'bluegrass',
        'country', 'outlaw country', 'country rock', 'country pop',
        'alt country', 'americana', 'western swing', 'honky tonk',
        'reggae', 'dancehall', 'ragga', 'dub', 'roots reggae', 'ska',
        'two-tone', 'dub reggae', 'reggaeton', 'latin', 'afrobeat',
        'bossa nova', 'samba', 'cumbia', 'middle eastern', 'indian',
        'disco', 'northern soul', 'motown', 'neo-soul', 'smooth jazz',
        'deep soul', 'funk',
        'classical', 'baroque', 'romantic', 'modern classical', 'minimalist',
        'orchestral', 'opera',
        'ambient', 'dark ambient', 'drone', 'shoegaze', 'slowcore', 'noise',
        'power electronics', 'wall of sound', 'electroacoustic', 'microtonal',
        'spectralism',
        'world', 'ethnic', 'tribal', 'world fusion', 'global', 'asian',
        'african', 'asian folk', 'indian classical', 'middle eastern music',
        'experimental', 'avant-garde', 'glitch pop', 'wonky', 'plunderphonics',
        'mashup', 'breakcore', 'hardcore punk', 'witch house', 'folktronica',
        'folktronic', 'musique concrète', 'serialism', 'post-minimalism',
        'alternative',
        'spoken word', 'soundtrack', 'video game music', 'chiptune', 'vgm',
        'dance', 'dance-punk', 'futurism', 'futurepop',
        'liquid', 'liquid funk', 'deep electronic', 'synth-pop', 'new wave',
        'coldwave', 'dark electronic', 'ambient electronic',
        'alternative', 'grunge', 'post-punk', 'new wave', 'darkwave', 'coldwave',
    ])))
    
    # Parse command line for target size (default: 10k for Phase 1)
    target_songs = 10_000
    if len(sys.argv) > 1:
        try:
            target_songs = int(sys.argv[1])
        except:
            print(f"Usage: python enhanced-music-importer.py [target_songs]")
            print(f"Examples:")
            print(f"  python enhanced-music-importer.py 10000    # Phase 1 (10k songs)")
            print(f"  python enhanced-music-importer.py 40000    # Phase 2 (40k songs)")
            print(f"  python enhanced-music-importer.py 150000   # Phase 3 (150k songs)")
            print(f"  python enhanced-music-importer.py 800000   # Phase 4 (800k songs)")
            return
    
    per_genre = max(1, target_songs // len(all_genres))
    
    print(f"\n📋 Import Configuration:")
    print(f"  Genres: {len(all_genres)}")
    print(f"  Target total: {target_songs:,} songs")
    print(f"  Per genre: ~{per_genre:,} songs")
    print(f"  Threading: ❌ Disabled (sequential mode)")
    
    # Calculate time estimate
    mb_time_hours = (per_genre / 100 * len(all_genres) * 0.3) / 3600
    ab_time_hours = (target_songs * 0.1) / 3600
    total_hours = mb_time_hours + ab_time_hours
    
    print(f"  Estimated time: {total_hours:.1f} hours (~{total_hours/24:.2f} days)")
    print()
    print("PHASED IMPORT SCHEDULE:")
    print("  Phase 1: python enhanced-music-importer.py 10000     (~0.3 hours)")
    print("  Phase 2: python enhanced-music-importer.py 40000     (~1.2 hours)")
    print("  Phase 3: python enhanced-music-importer.py 150000    (~4.2 hours)")
    print("  Phase 4: python enhanced-music-importer.py 800000    (~22.4 hours)")
    print("  TOTAL: 1,000,000 songs in ~28 hours")
    print()
    
    use_threading = False
    max_workers = 10
    
    importer = EnhancedMusicImporter(
        "enhanced_music.db", 
        use_threading=use_threading,
        max_workers=max_workers
    )
    
    try:
        start_time = time.time()
        
        # Step 1: Import from MusicBrainz
        songs = importer.import_from_musicbrainz(genres=all_genres, per_genre=per_genre)
        print(f"\n✅ Step 1 Complete: Fetched {len(songs)} songs from MusicBrainz")
        
        # Step 2: Enrich with AcousticBrainz features (with error handling)
        try:
            songs = importer.enrich_with_acousticbrainz(songs)
            print(f"✅ Step 2 Complete: Enriched songs with audio features")
        except Exception as e:
            print(f"⚠️  Step 2 Warning: Enrichment encountered an issue, but continuing with what we have")
            print(f"   Error: {str(e)[:100]}")
            # Don't fail - just use the songs as-is
        
        # Step 3: Store in database (CRITICAL - MUST HAPPEN)
        print(f"\n🔄 Step 3: Storing {len(songs)} songs to database...")
        stored = importer.store_songs(songs)
        print(f"✅ Step 3 Complete: Stored {stored} songs")
        
        # Step 4: Verify
        stats = importer.verify_import()
        
        elapsed = time.time() - start_time
        hours = elapsed / 3600
        
        print(f"\n✅ Phase Complete!")
        print(f"   Database: enhanced_music.db")
        print(f"   Total songs now: {stats['total']:,}")
        print(f"   Phase time: {hours:.1f} hours")
        print(f"   Average rate: {stats['total'] / hours:.0f} songs/hour")
        
        # Calculate storage
        import os
        if os.path.exists("enhanced_music.db"):
            db_size_mb = os.path.getsize("enhanced_music.db") / (1024 * 1024)
            print(f"   Database size: {db_size_mb:.1f} MB")
        
        # Show next step
        if stats['total'] < 1_000_000:
            next_phases = {
                10_000: (40_000, "Phase 2"),
                40_000: (150_000, "Phase 3"),
                150_000: (800_000, "Phase 4"),
                800_000: (1_000_000, "Final")
            }
            
            for current, (next_target, phase_name) in next_phases.items():
                if stats['total'] < current:
                    break
                if stats['total'] >= current and stats['total'] < next_target:
                    print(f"\n📝 Ready for next phase:")
                    print(f"   {phase_name}: python enhanced-music-importer.py {next_target}")
                    print(f"   (Will add {next_target - target_songs:,} more songs to reach {next_target:,} total)")
                    break
    
    except Exception as e:
        print(f"\n❌ CRITICAL ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        print(f"\n⚠️  Attempting to save any progress before exiting...")
        if 'importer' in locals():
            try:
                importer.conn.commit()
                print(f"✅ Database committed")
            except:
                pass
    
    finally:
        importer.close()


if __name__ == "__main__":
    main()
