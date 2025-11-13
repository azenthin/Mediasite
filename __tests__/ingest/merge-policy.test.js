const { recordMerge } = require('../../scripts/ingest/merge-policy');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '../../scripts/ingest/merge-log.json');

describe('merge policy log', () => {
  beforeEach(() => { try { fs.unlinkSync(OUT); } catch (e) {} });
  test('records a merge entry', () => {
    const e = recordMerge({ fromId: 'a', toId: 'b', reason: 'duplicate' });
    expect(e.fromId).toBe('a');
    const raw = JSON.parse(fs.readFileSync(OUT,'utf8'));
    expect(raw.merges.length).toBe(1);
  });
});
