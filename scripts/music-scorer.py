"""
Context-Aware Music Scoring Algorithm
Scores songs based on query type with appropriate weighting
"""

from typing import List, Dict, Tuple
from enum import Enum
import json
import re

class QueryType(Enum):
    ARTIST = "artist"
    GENRE = "genre"
    MOOD = "mood"
    AUDIO_FEATURE = "audio_feature"
    MIXED = "mixed"

class MusicScorer:
    """Score songs based on parsed query"""
    
    def __init__(self):
        # Different weight distributions for different query types
        self.weights = {
            QueryType.ARTIST: {
                'artist_exact': 0.50,
                'title_keyword': 0.20,
                'similar_artist': 0.15,
                'audio_features': 0.10,
                'popularity': 0.05,
            },
            QueryType.GENRE: {
                'genre_exact': 0.40,
                'subgenre': 0.20,
                'audio_features': 0.20,
                'mood_alignment': 0.10,
                'popularity': 0.10,
            },
            QueryType.MOOD: {
                'mood_tags': 0.35,
                'audio_features': 0.40,
                'genre_alignment': 0.15,
                'popularity': 0.10,
            },
            QueryType.AUDIO_FEATURE: {
                'audio_features': 0.70,
                'mood_alignment': 0.15,
                'genre_alignment': 0.10,
                'popularity': 0.05,
            },
            QueryType.MIXED: {
                'artist_exact': 0.25,
                'genre_exact': 0.25,
                'audio_features': 0.25,
                'mood_tags': 0.15,
                'popularity': 0.10,
            },
        }
    
    def score_song(
        self,
        song: Dict,
        query: str,
        query_type: QueryType,
        parsed_query: Dict
    ) -> Tuple[float, Dict]:
        """
        Score a single song against query
        Returns: (score: 0-1, scoring_breakdown: dict)
        """
        score = 0.0
        breakdown = {
            'artist_exact': 0,
            'title_keyword': 0,
            'similar_artist': 0,
            'genre_exact': 0,
            'subgenre': 0,
            'mood_tags': 0,
            'audio_features': 0,
            'genre_alignment': 0,
            'mood_alignment': 0,
            'popularity': 0,
        }
        
        weights = self.weights[query_type]
        
        # 1. Artist matching (for artist queries)
        if 'artist_exact' in weights:
            artist_score = self._score_artist_exact(
                song.get('artist', ''),
                parsed_query.get('artist', '')
            )
            breakdown['artist_exact'] = artist_score
            score += weights.get('artist_exact', 0) * artist_score
        
        # 2. Title/keyword matching
        if 'title_keyword' in weights and parsed_query.get('artist'):
            title_score = self._score_title_keyword(
                song.get('title', ''),
                parsed_query.get('artist', '')
            )
            breakdown['title_keyword'] = title_score
            score += weights.get('title_keyword', 0) * title_score
        
        # 3. Genre matching
        if 'genre_exact' in weights and parsed_query.get('genre'):
            genre_score = self._score_genre_exact(
                song.get('genres', ''),
                parsed_query.get('genre', '')
            )
            breakdown['genre_exact'] = genre_score
            score += weights.get('genre_exact', 0) * genre_score
        
        # 4. Subgenre matching
        if 'subgenre' in weights and parsed_query.get('genre'):
            subgenre_score = self._score_subgenre(
                song.get('subgenres', ''),
                parsed_query.get('genre', '')
            )
            breakdown['subgenre'] = subgenre_score
            score += weights.get('subgenre', 0) * subgenre_score
        
        # 5. Mood matching
        if 'mood_tags' in weights and parsed_query.get('mood'):
            mood_score = self._score_mood(
                song.get('moods', ''),
                parsed_query.get('mood', '')
            )
            breakdown['mood_tags'] = mood_score
            score += weights.get('mood_tags', 0) * mood_score
        
        # 6. Audio features matching
        if 'audio_features' in weights:
            audio_score = self._score_audio_features(song, parsed_query)
            breakdown['audio_features'] = audio_score
            score += weights.get('audio_features', 0) * audio_score
        
        # 7. Popularity boost
        if 'popularity' in weights:
            popularity_score = self._score_popularity(song.get('popularity_score'))
            breakdown['popularity'] = popularity_score
            score += weights.get('popularity', 0) * popularity_score
        
        return score, breakdown
    
    def _score_artist_exact(self, song_artist: str, query_artist: str) -> float:
        """
        Score artist exact match
        Returns 0-1
        """
        if not query_artist:
            return 0
        
        song_artist_lower = song_artist.lower().strip()
        query_artist_lower = query_artist.lower().strip()
        
        # Exact match
        if song_artist_lower == query_artist_lower:
            return 1.0
        
        # Substring match (e.g., "The Weeknd" matches "weeknd")
        if query_artist_lower in song_artist_lower or song_artist_lower in query_artist_lower:
            return 0.8
        
        # Levenshtein-like similarity (simple version)
        if self._string_similarity(song_artist_lower, query_artist_lower) > 0.7:
            return 0.6
        
        return 0
    
    def _score_title_keyword(self, song_title: str, keyword: str) -> float:
        """
        Score title containing keyword
        Returns 0-1
        """
        if not keyword:
            return 0
        
        song_title_lower = song_title.lower().strip()
        keyword_lower = keyword.lower().strip()
        
        # Exact title match
        if song_title_lower == keyword_lower:
            return 1.0
        
        # Keyword in title
        if keyword_lower in song_title_lower:
            return 0.7
        
        # Partial word match
        words = song_title_lower.split()
        if any(keyword_lower in word for word in words):
            return 0.5
        
        return 0
    
    def _score_genre_exact(self, song_genres: str, query_genre: str) -> float:
        """
        Score genre exact match
        Returns 0-1
        """
        if not query_genre or not song_genres:
            return 0
        
        try:
            genres = json.loads(song_genres) if isinstance(song_genres, str) else song_genres
        except:
            genres = []
        
        query_genre_lower = query_genre.lower().strip()
        
        # Exact match in genres
        if any(g.lower() == query_genre_lower for g in genres):
            return 1.0
        
        # Substring match (e.g., "indie rock" contains "indie")
        if any(query_genre_lower in g.lower() for g in genres):
            return 0.8
        
        return 0
    
    def _score_subgenre(self, song_subgenres: str, query_genre: str) -> float:
        """
        Score subgenre relevance
        Returns 0-1 (lower weight than exact genre match)
        """
        if not query_genre or not song_subgenres:
            return 0
        
        try:
            subgenres = json.loads(song_subgenres) if isinstance(song_subgenres, str) else song_subgenres
        except:
            subgenres = []
        
        query_genre_lower = query_genre.lower().strip()
        
        # Match in subgenres
        if any(query_genre_lower in g.lower() for g in subgenres):
            return 0.7
        
        return 0
    
    def _score_mood(self, song_moods: str, query_mood: str) -> float:
        """
        Score mood match
        Returns 0-1
        """
        if not query_mood or not song_moods:
            return 0
        
        try:
            moods = json.loads(song_moods) if isinstance(song_moods, str) else song_moods
        except:
            moods = []
        
        query_mood_lower = query_mood.lower().strip()
        
        # Exact match
        if any(m.lower() == query_mood_lower for m in moods):
            return 1.0
        
        # Substring match
        if any(query_mood_lower in m.lower() for m in moods):
            return 0.8
        
        return 0
    
    def _score_audio_features(self, song: Dict, parsed_query: Dict) -> float:
        """
        Score audio features match
        Returns 0-1
        """
        score = 0
        component_count = 0
        
        # BPM matching
        if parsed_query.get('bpm_range') and song.get('bpm'):
            min_bpm, max_bpm = parsed_query['bpm_range']
            song_bpm = song['bpm']
            if min_bpm <= song_bpm <= max_bpm:
                bpm_score = 1.0
            else:
                # Penalize based on distance
                distance = min(abs(song_bpm - min_bpm), abs(song_bpm - max_bpm))
                bpm_score = max(0, 1.0 - (distance / 50))  # 50 BPM penalty per point
            score += bpm_score
            component_count += 1
        
        # Energy matching
        if parsed_query.get('energy_range') and song.get('energy'):
            min_energy, max_energy = parsed_query['energy_range']
            song_energy = song['energy']
            if min_energy <= song_energy <= max_energy:
                energy_score = 1.0
            else:
                distance = min(abs(song_energy - min_energy), abs(song_energy - max_energy))
                energy_score = max(0, 1.0 - distance)
            score += energy_score
            component_count += 1
        
        # Danceability (often implied in fast/high-energy queries)
        if song.get('danceability'):
            if parsed_query.get('energy_range'):
                min_energy, _ = parsed_query['energy_range']
                if min_energy > 0.6:  # High energy implies high danceability
                    if song['danceability'] > 0.6:
                        score += 0.5
                        component_count += 1
        
        if component_count == 0:
            return 0.5  # Default if no audio features specified
        
        return score / component_count
    
    def _score_popularity(self, popularity_score: Optional[int]) -> float:
        """
        Score based on popularity
        Returns 0-1
        """
        if popularity_score is None:
            return 0.5  # Neutral if unknown
        
        # Normalize to 0-1
        return min(1.0, popularity_score / 100)
    
    def _string_similarity(self, s1: str, s2: str) -> float:
        """
        Simple string similarity (0-1)
        """
        # Very simple: count matching characters
        if not s1 or not s2:
            return 0
        
        matches = sum(1 for a, b in zip(s1, s2) if a == b)
        return matches / max(len(s1), len(s2))
    
    def score_songs(
        self,
        songs: List[Dict],
        query: str,
        query_type: QueryType,
        parsed_query: Dict,
        limit: int = 20
    ) -> List[Tuple[Dict, float, Dict]]:
        """
        Score multiple songs and return top results
        Returns: [(song, score, breakdown), ...]
        """
        results = []
        
        for song in songs:
            score, breakdown = self.score_song(song, query, query_type, parsed_query)
            results.append((song, score, breakdown))
        
        # Sort by score (highest first)
        results.sort(key=lambda x: x[1], reverse=True)
        
        return results[:limit]


# Example usage
if __name__ == "__main__":
    scorer = MusicScorer()
    
    # Test songs
    test_songs = [
        {
            'id': '1',
            'title': 'Blinding Lights',
            'artist': 'The Weeknd',
            'genres': json.dumps(['synthwave', 'electronic']),
            'moods': json.dumps(['dark', 'energetic']),
            'bpm': 90,
            'energy': 0.73,
            'danceability': 0.75,
            'popularity_score': 95,
        },
        {
            'id': '2',
            'title': 'Good as Hell',
            'artist': 'Lizzo',
            'genres': json.dumps(['pop', 'funk']),
            'moods': json.dumps(['upbeat', 'happy']),
            'bpm': 94,
            'energy': 0.66,
            'danceability': 0.71,
            'popularity_score': 89,
        },
    ]
    
    # Test query
    test_queries = [
        ('the weeknd', QueryType.ARTIST, {'artist': 'the weeknd'}),
        ('pop', QueryType.GENRE, {'genre': 'pop'}),
        ('upbeat', QueryType.MOOD, {'mood': 'upbeat'}),
        ('90 bpm energetic', QueryType.MIXED, {'bpm_range': (80, 100), 'energy_range': (0.6, 1.0)}),
    ]
    
    for query, query_type, parsed in test_queries:
        print(f"\n🎵 Query: '{query}' (type: {query_type.value})")
        results = scorer.score_songs(test_songs, query, query_type, parsed)
        for song, score, breakdown in results:
            print(f"  • {song['artist']} - {song['title']}: {score:.2f}")
            print(f"    → {breakdown}")
