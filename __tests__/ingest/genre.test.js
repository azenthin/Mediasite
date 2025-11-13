const { choosePrimaryGenre } = require('../../scripts/ingest/genre');

describe('genre reconciliation', () => {
  test('prefers musicbrainz genre when present', () => {
    const cand = [
      { source: 'spotify', genres: ['dance','pop'] },
      { source: 'musicbrainz', genres: ['pop'] }
    ];
    expect(choosePrimaryGenre(cand)).toBe('pop');
  });
  test('returns null when empty', () => {
    expect(choosePrimaryGenre([])).toBeNull();
  });
});
