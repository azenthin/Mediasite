Audio feature extraction

This folder contains a simple batch extractor to compute audio features and embeddings for local audio files.

What it does
- Reads audio files from `audio/` (relative to repo root)
- Extracts tempo (BPM), a simple key estimate, energy (RMS), spectral centroid, a danceability heuristic, and OpenL3 embeddings
- Stores scalar features in `audio_features.db` (SQLite, dev) and embeddings in a FAISS index `openl3.index` with id map `faiss_id_map.txt`

Quick start (Windows PowerShell)
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r scripts/requirements.txt
# Ensure ffmpeg is installed and in PATH for openl3
# Add audio files under ./audio (mp3, wav, flac, ogg, m4a)
python scripts/extract_audio_features.py
```

Notes
- openl3 requires ffmpeg; on Windows download ffmpeg and add to PATH.
- This is a dev-ready pipeline. For production, replace SQLite+FAISS with Postgres+pgvector or Pinecone/Weaviate and run extraction as a background worker.
- The key estimation here is a heuristic. For better accuracy, use Essentia's KeyExtractor or a trained model.
