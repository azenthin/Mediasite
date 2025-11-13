-- Enhanced Music Database Schema
-- Stores 5M+ songs with comprehensive metadata
-- Optimized for multi-field searching and scoring

CREATE TABLE IF NOT EXISTS songs (
  -- Identity
  id TEXT PRIMARY KEY,
  mbid TEXT UNIQUE,              -- MusicBrainz ID for deduplication
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  
  -- Genre/Categorization (THE POWER)
  genres TEXT,                    -- JSON array: ["pop", "electronic"]
  subgenres TEXT,                 -- JSON array: ["synth-pop", "dance-pop"]
  moods TEXT,                      -- JSON array: ["upbeat", "melancholic", "energetic"]
  tags TEXT,                       -- JSON array: ["summer", "workout", "sleep", "party"]
  
  -- Audio Features (Spotify/AcousticBrainz)
  bpm REAL,                        -- Beats per minute
  key TEXT,                        -- Musical key (C, Cm, C#, etc)
  energy REAL,                     -- 0-1 (intensity and activity)
  danceability REAL,               -- 0-1 (rhythmic regularity)
  acousticness REAL,               -- 0-1 (acoustic vs electronic)
  instrumentalness REAL,           -- 0-1 (presence of vocals)
  valence REAL,                    -- 0-1 (musical positiveness/happiness)
  loudness REAL,                   -- dB
  
  -- Metadata
  popularity_score INTEGER,        -- 0-100 (from Last.fm/Spotify)
  release_year INTEGER,
  duration_ms INTEGER,             -- milliseconds
  language TEXT,                   -- ISO 639-1 code (en, es, fr, etc)
  
  -- Relationships (for discovery)
  similar_artists TEXT,            -- JSON array of similar artist names
  collaborators TEXT,              -- JSON array of featuring artists
  remixes TEXT,                    -- JSON array of remix titles
  
  -- Embeddings (optional, for semantic search)
  embedding TEXT,                  -- JSON array (384-dim vector from text embedding)
  
  -- Metadata
  source TEXT,                     -- "musicbrainz", "spotify", "lastfm"
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes for fast queries
  FOREIGN KEY (artist) REFERENCES artists(name)
);

-- Index for genre queries: "pop", "phonk", etc
CREATE INDEX IF NOT EXISTS idx_genres ON songs(genres);
CREATE INDEX IF NOT EXISTS idx_moods ON songs(moods);
CREATE INDEX IF NOT EXISTS idx_tags ON songs(tags);

-- Index for artist queries: "justin bieber"
CREATE INDEX IF NOT EXISTS idx_artist ON songs(artist);
CREATE INDEX IF NOT EXISTS idx_title ON songs(title);

-- Index for audio feature queries
CREATE INDEX IF NOT EXISTS idx_bpm ON songs(bpm);
CREATE INDEX IF NOT EXISTS idx_energy ON songs(energy);
CREATE INDEX IF NOT EXISTS idx_danceability ON songs(danceability);
CREATE INDEX IF NOT EXISTS idx_valence ON songs(valence);

-- Index for metadata queries
CREATE INDEX IF NOT EXISTS idx_popularity ON songs(popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_year ON songs(release_year);
CREATE INDEX IF NOT EXISTS idx_language ON songs(language);

-- Denormalized artist lookup (for faster queries)
CREATE TABLE IF NOT EXISTS artists (
  name TEXT PRIMARY KEY,
  popularity_score INTEGER,
  similar_artists TEXT,           -- JSON array
  genres TEXT,                    -- JSON array
  total_songs INTEGER,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create artist index
CREATE INDEX IF NOT EXISTS idx_artist_name ON artists(name);

-- Statistics table (for query analysis)
CREATE TABLE IF NOT EXISTS query_stats (
  query_text TEXT,
  query_type TEXT,                -- "artist", "genre", "mood", "audio_feature", "mixed"
  results_returned INTEGER,
  avg_score REAL,
  user_feedback TEXT,             -- "good", "bad", "skip"
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Views for common queries
CREATE VIEW IF NOT EXISTS popular_songs AS
  SELECT * FROM songs
  WHERE popularity_score >= 50
  ORDER BY popularity_score DESC
  LIMIT 1000;

CREATE VIEW IF NOT EXISTS recent_songs AS
  SELECT * FROM songs
  WHERE release_year >= year(date('now')) - 5
  ORDER BY release_year DESC
  LIMIT 1000;
