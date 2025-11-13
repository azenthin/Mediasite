const { normalize } = require('../../scripts/ingest/normalize');

describe('normalize canonical record', () => {
  test('combines spotify + musicbrainz and computes canonicality', () => {
    const spotify = { found: true, isrc: 'USRC1', title: 'Foo', artists: [{ name: 'Artist A' }], duration_ms: 210000, raw: {} };
    const musicbrainz = { found: true, mbid: 'mb-1', title: 'Foo', artists: ['Artist A'], duration: 210000, releases: [{ id: 'r1', date: '2001-01-01' }], raw: {} };
    const rec = normalize({ spotify, musicbrainz });
    expect(rec.title).toBe('Foo');
    expect(rec.isrc).toBe('USRC1');
    expect(rec.mbid).toBe('mb-1');
    expect(rec.accept).toBe(true);
    expect(rec.canonicality.score).toBeGreaterThanOrEqual(0.7);
  });

  test('marks no-isrc and low score', () => {
    const spotify = { found: false };
    const musicbrainz = { found: false };
    const rec = normalize({ spotify, musicbrainz });
    expect(rec.skip).toBe(true);
    expect(rec.canonicality.score).toBeLessThan(0.4);
  });
});
