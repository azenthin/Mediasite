#!/usr/bin/env python3
"""
Simplified extractor WITHOUT OpenL3 - just extracts scalar features to verify pipeline.
"""
import os
import sys
from pathlib import Path
import sqlite3
import numpy as np
from tqdm import tqdm

try:
    import librosa
except Exception:
    print("Missing dependency: librosa. Install with: pip install librosa")
    sys.exit(1)

AUDIO_DIR = Path(__file__).resolve().parents[1] / "audio"
DB_PATH = Path(__file__).resolve().parents[1] / "audio_features.db"
SAMPLE_RATE = 48000

# Ensure audio dir exists
if not AUDIO_DIR.exists():
    print(f"Audio folder not found at {AUDIO_DIR}. Create it and add .mp3/.wav files, then re-run.")
    sys.exit(0)

# SQLite setup
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

def estimate_key(y, sr):
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    chroma_mean = chroma.mean(axis=1)
    pitch_class = int(np.argmax(chroma_mean))
    NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
    note = NOTES[pitch_class]
    return note

def compute_danceability(bpm, beat_strength, energy):
    if bpm is None:
        bpm_factor = 0.5
    else:
        bpm_clamped = min(max(bpm, 60), 180)
        bpm_factor = (bpm_clamped - 60) / (180 - 60)
    score = 0.4 * bpm_factor + 0.4 * beat_strength + 0.2 * energy
    return float(max(0.0, min(1.0, score)))

def process_file(path):
    print(f"Loading {path}...")
    try:
        y, sr = librosa.load(path, sr=SAMPLE_RATE, mono=True)
    except Exception as exc:
        print(f"Failed to load {path}: {exc}")
        return None

    print(f"  Computing features...")
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
    danceability = compute_danceability(bpm, beat_strength, energy)

    return {
        "duration": duration,
        "bpm": bpm,
        "key": key,
        "energy": energy,
        "danceability": danceability,
        "rhythm_strength": beat_strength,
        "spectral_centroid": spec_cent,
    }

def main():
    files = [p for p in AUDIO_DIR.rglob("*") if p.suffix.lower() in ('.mp3', '.wav', '.flac', '.ogg', '.m4a')]
    if not files:
        print(f"No audio files found in {AUDIO_DIR}. Add files and re-run.")
        return

    print(f"Found {len(files)} files. Processing (no OpenL3 embeddings)...\n")

    for file in files:
        meta = process_file(str(file))
        if meta is None:
            continue

        c.execute(
            "INSERT OR REPLACE INTO features (filename, duration, bpm, key, energy, danceability, rhythm_strength, spectral_centroid, processed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))",
            (str(file), meta['duration'], meta['bpm'], meta['key'], meta['energy'], meta['danceability'], meta['rhythm_strength'], meta['spectral_centroid'])
        )
        conn.commit()
        bpm_str = f"{meta['bpm']:.1f}" if meta['bpm'] else "N/A"
        print(f"  ✓ Wrote to DB: bpm={bpm_str}, key={meta['key']}, energy={meta['energy']:.3f}\n")

    print(f"\n✓ Done! Processed {len(files)} files. Check audio_features.db")

if __name__ == '__main__':
    main()
