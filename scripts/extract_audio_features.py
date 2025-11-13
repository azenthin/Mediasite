#!/usr/bin/env python3
"""
scripts/extract_audio_features.py

Batch-extract audio features and embeddings for local audio files.
Saves scalar features to a local SQLite DB (dev) and embeddings to a FAISS index.

Behavior:
- Looks for audio files under `audio/` relative to repo root.
- If no files found, exits cleanly with a message.
- Designed for local/dev usage. For production, adapt storage to Postgres + Pinecone/pgvector.

Notes:
- Requires Python packages listed in requirements.txt
- openl3 requires ffmpeg installed and accessible in PATH.
"""
import os
import sys
from pathlib import Path
import sqlite3
import os
import uuid
try:
    import psycopg2
    from pgvector.psycopg2 import register_vector
    from pgvector import Vector
except Exception:
    psycopg2 = None
    register_vector = None
    Vector = None
import numpy as np
from tqdm import tqdm

# Optional imports; script will print a helpful message if missing
try:
    import librosa
except Exception:
    print("Missing dependency: librosa. Install with: pip install librosa")
    sys.exit(1)

try:
    import openl3
except Exception:
    print("Missing dependency: openl3. Install with: pip install openl3")
    sys.exit(1)

try:
    import faiss
except Exception:
    faiss = None
    # FAISS is optional when pushing embeddings to Postgres/pgvector.
    print("faiss not available — continuing without local FAISS index. Embeddings will be pushed to Postgres if DATABASE_URL is set.")

AUDIO_DIR = Path(__file__).resolve().parents[1] / "audio"
DB_PATH = Path(__file__).resolve().parents[1] / "audio_features.db"
FAISS_INDEX_PATH = Path(__file__).resolve().parents[1] / "openl3.index"
FAISS_MAP_PATH = Path(__file__).resolve().parents[1] / "faiss_id_map.txt"
SAMPLE_RATE = 48000
EMBED_DIM = 512  # using openl3 embedding_size=512

# Ensure audio dir exists
if not AUDIO_DIR.exists():
    print(f"Audio folder not found at {AUDIO_DIR}. Create it and add .mp3/.wav files, then re-run.")
    sys.exit(0)

# SQLite setup (dev fallback)
conn = sqlite3.connect(str(DB_PATH))
c = conn.cursor()
c.execute(
    """
    CREATE TABLE IF NOT EXISTS features (
        id INTEGER PRIMARY KEY,
        filename TEXT UNIQUE,
        duration REAL,
        bpm REAL,
        key TEXT,
        energy REAL,
        danceability REAL,
        rhythm_strength REAL,
        spectral_centroid REAL,
        processed_at TEXT
    )
    """
)
conn.commit()

# Postgres (production) setup when DATABASE_URL provided
PG_CONN = None
PG_CUR = None
DATABASE_URL = os.getenv('DATABASE_URL')
if DATABASE_URL and psycopg2 is not None:
    PG_CONN = psycopg2.connect(DATABASE_URL)
    register_vector(PG_CONN)
    PG_CUR = PG_CONN.cursor()
    # Ensure pgvector extension and tables exist
    PG_CUR.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    PG_CUR.execute(
        """
        CREATE TABLE IF NOT EXISTS audio_features (
            id TEXT PRIMARY KEY,
            filename TEXT UNIQUE,
            duration REAL,
            bpm REAL,
            key TEXT,
            energy REAL,
            danceability REAL,
            rhythm_strength REAL,
            spectral_centroid REAL,
            embedding_base64 TEXT,
            created_at TIMESTAMP DEFAULT now()
        )
        """
    )
    PG_CUR.execute(
        """
        CREATE TABLE IF NOT EXISTS audio_vectors (
            id TEXT PRIMARY KEY,
            embedding vector(%d)
        )
        """ % EMBED_DIM
    )
    PG_CONN.commit()
elif DATABASE_URL and psycopg2 is None:
    print("DATABASE_URL provided but psycopg2/pgvector Python packages are missing. Install psycopg2-binary and pgvector to enable Postgres ingestion.")

# Load or create FAISS index
index = None
id_map = []

if faiss is not None:
    if FAISS_INDEX_PATH.exists():
        try:
            index = faiss.read_index(str(FAISS_INDEX_PATH))
            print("Loaded existing FAISS index.")
        except Exception as e:
            # Fall back to a clean index when the saved version is incompatible
            print("Failed to load existing FAISS index, creating a new one.", e)
            index = None

    if index is None:
        index = faiss.IndexFlatIP(EMBED_DIM)  # inner-product index on normalized vectors

    if FAISS_MAP_PATH.exists():
        with open(FAISS_MAP_PATH, "r", encoding="utf-8") as f:
            id_map = [l.strip() for l in f if l.strip()]
else:
    index = None


def estimate_key(y, sr):
    # Simple chroma-based estimation (very approximate)
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    chroma_mean = chroma.mean(axis=1)
    pitch_class = int(np.argmax(chroma_mean))
    NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
    note = NOTES[pitch_class]
    return note


def compute_danceability(bpm, beat_strength, energy):
    # Simple heuristic combining bpm, beat strength and energy
    if bpm is None:
        bpm_factor = 0.5
    else:
        bpm_clamped = min(max(bpm, 60), 180)
        bpm_factor = (bpm_clamped - 60) / (180 - 60)
    score = 0.4 * bpm_factor + 0.4 * beat_strength + 0.2 * energy
    return float(max(0.0, min(1.0, score)))


def process_file(path):
    try:
        y, sr = librosa.load(path, sr=SAMPLE_RATE, mono=True)
    except Exception as exc:
        print(f"Failed to load {path}: {exc}")
        return None

    duration = librosa.get_duration(y=y, sr=sr)
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    try:
        tempo = librosa.beat.tempo(onset_envelope=onset_env, sr=sr)
        bpm = float(tempo[0]) if tempo.size else None
    except Exception:
        bpm = None

    beat_strength = float(onset_env.mean()) if onset_env.size else 0.0
    rms = librosa.feature.rms(y=y)
    energy = float(np.mean(rms))
    spec_cent = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
    key = estimate_key(y, sr)

    # OpenL3 embedding (average over frames)
    try:
        emb, ts = openl3.get_audio_embedding(y, sr, input_repr="mel256", content_type="music", embedding_size=EMBED_DIM)
        emb_mean = np.mean(emb, axis=0)
        # normalize
        norm = np.linalg.norm(emb_mean)
        if norm > 0:
            emb_norm = (emb_mean / norm).astype('float32')
        else:
            emb_norm = emb_mean.astype('float32')
    except Exception as e:
        print(f"openl3 failed for {path}: {e}")
        emb_norm = None

    danceability = compute_danceability(bpm, beat_strength, energy)

    return {
        "duration": duration,
        "bpm": bpm,
        "key": key,
        "energy": energy,
        "danceability": danceability,
        "rhythm_strength": beat_strength,
        "spectral_centroid": spec_cent,
        "embedding": emb_norm,
    }


def main():
    files = [p for p in AUDIO_DIR.rglob("*") if p.suffix.lower() in ('.mp3', '.wav', '.flac', '.ogg', '.m4a')]
    if not files:
        print(f"No audio files found in {AUDIO_DIR}. Add files and re-run.")
        return

    print(f"Found {len(files)} files. Processing...")

    for file in tqdm(files):
        meta = process_file(str(file))
        if meta is None:
            continue

        # Upsert scalar features into local SQLite (dev)
        c.execute(
            "INSERT OR REPLACE INTO features (filename, duration, bpm, key, energy, danceability, rhythm_strength, spectral_centroid, processed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))",
            (str(file), meta['duration'], meta['bpm'], meta['key'], meta['energy'], meta['danceability'], meta['rhythm_strength'], meta['spectral_centroid'])
        )
        conn.commit()

        # Add to FAISS (dev index)
        if index is not None and meta.get('embedding') is not None:
            emb = meta['embedding'].reshape(1, -1).astype('float32')
            try:
                index.add(emb)
                id_map.append(str(file))
            except Exception as e:
                print(f"Failed to add embedding for {file} to FAISS: {e}")

        # If Postgres is configured, write scalars + vectors to Postgres/pgvector
        if PG_CUR is not None and meta.get('embedding') is not None:
            rec_id = str(uuid.uuid4())
            # store base64 embedding as fallback
            try:
                import base64
                emb_bytes = meta['embedding'].tobytes()
                emb_b64 = base64.b64encode(emb_bytes).decode('ascii')
            except Exception:
                emb_b64 = None

            try:
                PG_CUR.execute(
                    "INSERT INTO audio_features (id, filename, duration, bpm, key, energy, danceability, rhythm_strength, spectral_centroid, embedding_base64) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) ON CONFLICT (filename) DO UPDATE SET duration = EXCLUDED.duration, bpm = EXCLUDED.bpm, key = EXCLUDED.key, energy = EXCLUDED.energy, danceability = EXCLUDED.danceability, rhythm_strength = EXCLUDED.rhythm_strength, spectral_centroid = EXCLUDED.spectral_centroid, embedding_base64 = EXCLUDED.embedding_base64",
                    (rec_id, str(file), meta['duration'], meta['bpm'], meta['key'], meta['energy'], meta['danceability'], meta['rhythm_strength'], meta['spectral_centroid'], emb_b64)
                )
                # Insert vector into audio_vectors (upsert)
                vec = Vector(meta['embedding'].tolist())
                PG_CUR.execute(
                    "INSERT INTO audio_vectors (id, embedding) VALUES (%s, %s) ON CONFLICT (id) DO UPDATE SET embedding = EXCLUDED.embedding",
                    (rec_id, vec)
                )
                PG_CONN.commit()
            except Exception as e:
                PG_CONN.rollback()
                print(f"Failed to write to Postgres for {file}: {e}")

    # Save index and id map when FAISS is available
    if index is not None and faiss is not None:
        try:
            faiss.write_index(index, str(FAISS_INDEX_PATH))
            with open(FAISS_MAP_PATH, 'w', encoding='utf-8') as f:
                for p in id_map:
                    f.write(p + "\n")
            print("Indexing complete. Total vectors:", index.ntotal)
        except Exception as e:
            print("Failed to save FAISS index or id map:", e)


if __name__ == '__main__':
    main()
