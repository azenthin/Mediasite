const { upsert, readStaging } = require('../../scripts/ingest/upsert-staging');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '../../scripts/ingest/staging-db.json');

describe('upsert staging', () => {
  beforeEach(() => {
    try { fs.unlinkSync(OUT); } catch (e) {}
  });

  test('inserts new record', () => {
    upsert({ title: 'A', isrc: 'ISRC1' });
    const db = readStaging();
    expect(db.records.length).toBe(1);
    expect(db.records[0].isrc).toBe('ISRC1');
  });

  test('upserts by isrc and does not duplicate', () => {
    upsert({ title: 'A', isrc: 'ISRC1', spotify_id: 'S1' });
    upsert({ title: 'A2', isrc: 'ISRC1', spotify_id: 'S1' });
    const db = readStaging();
    expect(db.records.length).toBe(1);
    expect(db.records[0].title).toBe('A2');
  });
});
