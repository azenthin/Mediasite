"""
Smart Query Analyzer
Detects query intent and parses components for context-aware scoring
"""

import re
from typing import TypedDict
from enum import Enum

class QueryType(Enum):
    ARTIST = "artist"           # "justin bieber", "the weeknd"
    GENRE = "genre"             # "pop", "phonk", "hardstyle"
    MOOD = "mood"               # "chill", "upbeat", "melancholic"
    AUDIO_FEATURE = "audio_feature"  # "120 bpm", "energetic", "fast"
    MIXED = "mixed"             # "chill pop at 90 bpm"

class ParsedQuery(TypedDict):
    query_type: QueryType
    confidence: float            # 0-1, how sure we are about type
    artist: str | None
    genre: str | None
    mood: str | None
    bpm_range: tuple[int, int] | None  # (min, max)
    energy_range: tuple[float, float] | None
    language: str | None
    year_range: tuple[int, int] | None
    components: dict             # Raw extracted components

class QueryAnalyzer:
    def __init__(self):
        # Known genres (expand as needed)
        self.known_genres = {
            'pop', 'rock', 'hip-hop', 'rap', 'electronic', 'edm', 'house', 'techno',
            'trance', 'dubstep', 'drum-and-bass', 'dnb', 'jungle', 'garage',
            'grime', 'phonk', 'trap', 'hardstyle', 'hardcore', 'ambient', 'indie',
            'alternative', 'metal', 'jazz', 'blues', 'folk', 'country', 'reggae',
            'r&b', 'soul', 'funk', 'disco', 'synthwave', 'vaporwave', 'lo-fi',
            'chillhop', 'hyperpop', 'witch-house', 'jersery-club', 'footwork',
            'psychedelic', 'experimental', 'classical', 'piano', 'acoustic',
            'chill', 'ambient', 'orchestral', 'ost', 'video game', 'anime'
        }
        
        # Known moods
        self.known_moods = {
            'chill', 'relaxing', 'calm', 'peaceful', 'upbeat', 'energetic',
            'happy', 'sad', 'melancholic', 'dark', 'moody', 'intense', 'aggressive',
            'romantic', 'love', 'party', 'workout', 'focus', 'sleep', 'study',
            'nightlife', 'summer', 'winter', 'spring', 'autumn', 'nostalgic',
            'psychedelic', 'trippy', 'groovy', 'funky', 'smooth', 'mellow'
        }
        
        # BPM references
        self.bpm_descriptors = {
            'slow': (60, 100),
            'medium': (90, 120),
            'fast': (120, 160),
            'very fast': (160, 200),
            'rapid': (160, 200),
            'breakbeats': (160, 180),
            'garage': (130, 150),
        }
        
        # Energy descriptors
        self.energy_descriptors = {
            'low energy': (0, 0.3),
            'calm': (0, 0.3),
            'medium energy': (0.3, 0.7),
            'high energy': (0.7, 1.0),
            'intense': (0.8, 1.0),
        }
    
    def analyze(self, query: str) -> ParsedQuery:
        """Analyze query and return structured components"""
        query_lower = query.lower().strip()
        
        # Try to detect query type
        artist_match = self._extract_artist(query_lower)
        genre_match = self._extract_genre(query_lower)
        mood_match = self._extract_mood(query_lower)
        audio_feature_match = self._extract_audio_features(query_lower)
        
        # Determine primary query type based on matches
        query_type, confidence = self._determine_query_type(
            artist_match, genre_match, mood_match, audio_feature_match
        )
        
        # Extract numeric features
        bpm_range = self._extract_bpm(query_lower)
        energy_range = self._extract_energy(query_lower)
        year_range = self._extract_year_range(query_lower)
        language = self._extract_language(query_lower)
        
        return ParsedQuery(
            query_type=query_type,
            confidence=confidence,
            artist=artist_match,
            genre=genre_match,
            mood=mood_match,
            bpm_range=bpm_range,
            energy_range=energy_range,
            language=language,
            year_range=year_range,
            components={
                'raw_query': query,
                'artist': artist_match,
                'genre': genre_match,
                'mood': mood_match,
                'bpm': bpm_range,
                'energy': energy_range,
            }
        )
    
    def _extract_artist(self, query: str) -> str | None:
        """Try to extract artist name from query"""
        # Common patterns: "by [artist]", "[artist] songs", etc
        patterns = [
            r'by\s+([a-z\s]+?)(?:\s+(?:songs|music|remix|ft\.|featuring)|\s+at\s+|\s+with\s+|$)',
            r'([a-z\s]+?)\s+(?:songs|music|remix)',
            r'featuring\s+([a-z\s]+?)(?:\s+|$)',
            r'^([a-z\s]+?)(?:\s+(?:songs|covers|hits))?$',  # Entire query might be artist
        ]
        
        for pattern in patterns:
            match = re.search(pattern, query)
            if match:
                artist = match.group(1).strip()
                # Filter out common words that aren't artists
                if len(artist) > 2 and artist not in self.known_genres and artist not in self.known_moods:
                    return artist
        
        return None
    
    def _extract_genre(self, query: str) -> str | None:
        """Extract genre from query"""
        for genre in sorted(self.known_genres, key=len, reverse=True):
            if genre in query:
                return genre
        return None
    
    def _extract_mood(self, query: str) -> str | None:
        """Extract mood from query"""
        for mood in sorted(self.known_moods, key=len, reverse=True):
            if mood in query:
                return mood
        return None
    
    def _extract_audio_features(self, query: str) -> dict | None:
        """Extract audio feature descriptors (bpm, energy)"""
        features = {}
        
        # Check BPM descriptors
        for desc, (min_bpm, max_bpm) in self.bpm_descriptors.items():
            if desc in query:
                features['bpm'] = (min_bpm, max_bpm)
        
        # Check energy descriptors
        for desc, (min_energy, max_energy) in self.energy_descriptors.items():
            if desc in query:
                features['energy'] = (min_energy, max_energy)
        
        return features if features else None
    
    def _determine_query_type(self, artist, genre, mood, audio_feature) -> tuple[QueryType, float]:
        """Determine primary query type and confidence"""
        matches = sum([bool(artist), bool(genre), bool(mood), bool(audio_feature)])
        
        if artist and not genre and not mood:
            return QueryType.ARTIST, 0.9
        elif genre and not artist and not mood:
            return QueryType.GENRE, 0.9
        elif mood and not artist and not genre:
            return QueryType.MOOD, 0.9
        elif audio_feature and not artist and not genre and not mood:
            return QueryType.AUDIO_FEATURE, 0.9
        elif matches > 1:
            return QueryType.MIXED, 0.7
        else:
            # Default to mood (most common user query)
            return QueryType.MOOD, 0.5
    
    def _extract_bpm(self, query: str) -> tuple[int, int] | None:
        """Extract specific BPM numbers"""
        # Pattern: "120 bpm", "100-130 bpm", "around 110 bpm"
        pattern = r'(\d+)\s*(?:to|-|–)?\s*(\d+)?\s*(?:bpm|bpms?|beats?)'
        match = re.search(pattern, query)
        
        if match:
            min_bpm = int(match.group(1))
            max_bpm = int(match.group(2)) if match.group(2) else min_bpm + 20
            return (min_bpm, max_bpm)
        
        return None
    
    def _extract_energy(self, query: str) -> tuple[float, float] | None:
        """Extract energy level (0-1)"""
        if 'high energy' in query or 'energetic' in query or 'intense' in query:
            return (0.7, 1.0)
        elif 'medium energy' in query:
            return (0.3, 0.7)
        elif 'low energy' in query or 'calm' in query or 'relaxing' in query:
            return (0, 0.3)
        return None
    
    def _extract_year_range(self, query: str) -> tuple[int, int] | None:
        """Extract year range"""
        pattern = r'(19|20)\d{2}(?:\s*(?:to|-|–)\s*(19|20)\d{2})?'
        match = re.search(pattern, query)
        
        if match:
            year1 = int(match.group(0).split('-')[0].split(' ')[0])
            if '-' in match.group(0) or '–' in match.group(0):
                year2 = int(match.group(0).split('-')[1])
                return (year1, year2)
            return (year1, year1)
        
        return None
    
    def _extract_language(self, query: str) -> str | None:
        """Extract language hint"""
        if 'spanish' in query or 'latino' in query:
            return 'es'
        elif 'french' in query:
            return 'fr'
        elif 'german' in query:
            return 'de'
        elif 'japanese' in query or 'anime' in query:
            return 'ja'
        elif 'korean' in query or 'kpop' in query:
            return 'ko'
        return None


# Example usage
if __name__ == "__main__":
    analyzer = QueryAnalyzer()
    
    test_queries = [
        "justin bieber songs",
        "pop music",
        "chill vibes",
        "120 bpm phonk",
        "upbeat electronic at 130 bpm",
        "sad indie songs from the 2000s",
        "fast hardstyle with high energy",
        "the weeknd lo-fi remix",
        "spanish reggaeton",
    ]
    
    for query in test_queries:
        result = analyzer.analyze(query)
        print(f"\nQuery: '{query}'")
        print(f"Type: {result['query_type'].value} (confidence: {result['confidence']:.2f})")
        print(f"Components: {result['components']}")
