Generating sample audio for local indexing

1) Generate two short WAV files (sine waves) into ./audio:

```bash
node scripts/generate_sample_audio.js
```

2) Activate your `mediasite` Python environment (conda) and run the extractor:

Windows PowerShell example:

```powershell
conda activate mediasite; python .\scripts\extract_audio_features.py
```

This will extract features from `./audio/*.wav` and (depending on your env) write to the local dev SQLite + FAISS index or to Postgres if `DATABASE_URL` is configured.
