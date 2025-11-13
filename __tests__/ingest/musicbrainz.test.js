const { lookupByISRC } = require('../../scripts/ingest/musicbrainz');

describe('musicbrainz helper (mocked)', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });
  afterEach(() => {
    global.fetch = undefined;
  });

  test('lookupByISRC returns no-mbid when no recordings', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ recordings: [] }) });
    const res = await lookupByISRC('USRC17607839');
    expect(res.found).toBe(false);
    expect(res.reason).toBe('no-mbid');
  });
});
