const fs = require('fs');
const path = require('path');
const { readStaging, writeStaging } = require('./upsert-staging');
const { lookupByISRC } = require('./musicbrainz');

async function reEnrichAll() {
  const db = readStaging();
  const records = db.records || [];
  for (const r of records) {
    try {
      if (!r.mbid && r.isrc) {
        const mb = await lookupByISRC(r.isrc);
        if (mb && mb.found) {
          r.mbid = mb.mbid || mb.id || mb.mbid;
          r.releases = mb.releases || r.releases || [];
          r.raw = r.raw || {};
          r.raw.musicbrainz = mb.raw || mb.raw_search || mb.raw;
          r.updatedAt = new Date().toISOString();
        }
      }
    } catch (e) {
      // log and continue
      r._reEnrichError = String(e);
    }
  }
  writeStaging(db);
  return db;
}

if (require.main === module) {
  reEnrichAll().then(db => console.log('Re-enriched', (db.records||[]).length, 'records')).catch(err => { console.error(err); process.exit(1); });
}

module.exports = { reEnrichAll };
