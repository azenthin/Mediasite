# Ingest scripts (development)

This small folder contains safe, non-destructive helper scripts used while developing the ingestion pipeline.

Files
- `sample-source.csv` — a tiny example Source List (Artist,Title) used by the runner.
- `run-sample.js` — a one-shot runner that reads the CSV, calls the Spotify helper and MusicBrainz lookup, and writes `staging-results.json` for inspection. It never writes to the main DB.
- `spotify.js` and `musicbrainz.js` — helper modules used by tests and by the runner.

Running the sample (PowerShell)
```powershell
node .\scripts\ingest\run-sample.js
```

Notes
- The runner uses the existing helper functions: if you want to actually query Spotify you must set `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` in your environment. Without these the Spotify helper will either return mocked results (in tests) or a failure.
- Tests are run non-interactively via CI mode so you won't be prompted to press keys:
```powershell
npm run test:ci
```
# Ingest helpers

This folder contains safe, non-destructive helper scripts used while building the ingestion pipeline.

Usage

- Provide `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` in your environment to allow the Spotify helper to authenticate via Client Credentials.
- Optionally set `INGEST_USER_AGENT` to a contact-bearing user agent for MusicBrainz requests.
- Run the sample runner to produce `out.json`:

```powershell
node scripts/ingest/run-sample.js
```

Notes

- The runner writes to `scripts/ingest/out.json` and does not touch the main application database. Do not run destructive DB operations unless you have a verified backup in `scripts/backups/`.
