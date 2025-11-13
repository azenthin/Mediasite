const { searchSpotify, getSpotifyToken } = require('../../scripts/ingest/spotify');

describe('spotify helper (mocked)', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV, SPOTIFY_CLIENT_ID: 'cid', SPOTIFY_CLIENT_SECRET: 'secret' };
    global.fetch = jest.fn();
  });
  afterEach(() => {
    process.env = OLD_ENV;
    global.fetch = undefined;
  });

  test('getSpotifyToken requests token and caches', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tk', expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tracks: { items: [] } }) });
    const tk = await getSpotifyToken('cid', 'secret');
    expect(tk).toBe('tk');
    // subsequent call should use cached token and not call token endpoint again
    const tk2 = await getSpotifyToken('cid', 'secret');
    expect(tk2).toBe('tk');
  });

  test('searchSpotify returns no-match when search empty', async () => {
    // token response
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tk', expires_in: 3600 }) })
      // search response
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tracks: { items: [] } }) });
    const res = await searchSpotify('Some Artist', 'NoSuchTitle');
    expect(res.found).toBe(false);
    expect(res.reason).toBe('no-match');
  });
});
