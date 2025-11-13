const { isRemix } = require('../../scripts/ingest/remix-detector');

describe('remix detector', () => {
  test('detects remix tokens', () => {
    expect(isRemix('Song (Remix)')).toBe(true);
    expect(isRemix('Song - Radio Edit')).toBe(true);
    expect(isRemix('Original Song')).toBe(false);
  });
});
