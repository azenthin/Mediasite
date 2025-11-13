const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'staging-db.json');

function readStaging() {
  try {
    const txt = fs.readFileSync(OUT, 'utf8');
    return JSON.parse(txt);
  } catch (e) {
    return { records: [] };
  }
}

function writeStaging(db) {
  fs.writeFileSync(OUT, JSON.stringify(db, null, 2));
}

// Upsert a canonical record into staging-db.json using isrc->mbid->spotify_id as keys
function upsert(record) {
  const db = readStaging();
  const keyFields = ['isrc', 'mbid', 'spotify_id'];
  let foundIndex = -1;
  for (const k of keyFields) {
    if (!record[k]) continue;
    foundIndex = db.records.findIndex(r => r[k] && r[k] === record[k]);
    if (foundIndex !== -1) break;
  }
  if (foundIndex !== -1) {
    // merge: shallow merge but preserve/merge identifiers array if present
    const existing = db.records[foundIndex] || {};
    const merged = Object.assign({}, existing, record, { updatedAt: new Date().toISOString() });
    // preserve identifiers array (one-to-many mappings)
    const existingIds = existing.identifiers || [];
    const incomingIds = record.identifiers || [];
    const combined = existingIds.concat(incomingIds).reduce((acc, cur) => {
      const key = `${cur.type}:${cur.value}`;
      if (!acc._seen[key]) { acc._seen[key] = true; acc.items.push(cur); }
      return acc;
    }, { _seen: {}, items: [] }).items;
    if (combined.length > 0) merged.identifiers = combined;
    db.records[foundIndex] = merged;
  } else {
    // ensure identifiers normalized
    const toInsert = Object.assign({ createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, record);
    if (!toInsert.identifiers) toInsert.identifiers = [];
    db.records.push(toInsert);
  }
  writeStaging(db);
  return { success: true };
}

module.exports = { upsert, readStaging, writeStaging };
