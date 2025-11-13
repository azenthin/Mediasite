# Ingestion Runbook

Quick start
- Export Spotify credentials in your shell (PowerShell):
  ```powershell
  $env:SPOTIFY_CLIENT_ID='your-client-id'; $env:SPOTIFY_CLIENT_SECRET='your-secret'
  ```
- To run the safe sample runner (non-destructive):
  ```powershell
  node .\scripts\ingest\run-sample.js
  ```

Files
- `run-sample.js` — safe runner that writes `staging-db.json` and `metrics.json`.
- `upsert-staging.js` — idempotent upsert into `staging-db.json`.
- `musicbrainz.js` / `musicbrainz-search.js` — MB lookup helpers.
- `spotify.js` — Spotify helper using client credentials.
- `acoustid.js` — placeholder for AcoustID/Chromaprint integration.

Backups
- Backups should be created before any destructive action. See `scripts/backups/backup-db.ps1` for a convenience PowerShell script.

Notes
- Tests are run non-interactively with CI mode: `npm run test:ci`.
- The current pipeline is ISRC-first with MusicBrainz enrichment and a canonicality scorer. Many modules are present as stubs for later expansion (AcoustID, ML classifier).
