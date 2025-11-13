const { searchByArtistTitle } = require('../../scripts/ingest/musicbrainz-search');

describe('musicbrainz-search (mock not performed here)', () => {
  test('returns no-match when no query', async () => {
    const res = await searchByArtistTitle('', '');
    expect(res.found).toBe(false);
    expect(res.reason).toBe('no-query');
  });
});
