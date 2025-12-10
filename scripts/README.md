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

## `get-several-tracks.js`

- Calls Spotify's `GET /v1/tracks` endpoint in batches of 50 IDs (Spotify's maximum) and enforces a 100 ms delay between each request, yielding ~10 requests per second.
- Automatically stops if Spotify responds with a `429` rate-limit response and surfaces the `Retry-After` header so you can diagnose throttling.
- Automatically fetches artist metadata in 50-artist batches (same delay) and attaches the full artist object (genres, followers, etc.) to each track.
- Returns full track objects (not just IDs) and supports outputting to a file for downstream ingestion.

### Usage (PowerShell)
```
cd "C:\Users\Joabzz\Documents\Visual Studio Code\mediasite"
node scripts/get-several-tracks.js <trackId> <trackId> ...
```
or
```
node scripts/get-several-tracks.js --file data/track-ids.txt --output data/tracks.json
```
The script reads credentials from `.env` (see `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET`) and writes JSON to stdout unless `--output` is provided.
