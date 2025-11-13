const { chooseCanonicalReleaseDate } = require('../../scripts/ingest/release-date');

describe('release date selection', () => {
  test('picks earliest date', () => {
    const releases = [{ id: 'r1', date: '2020-02-01' }, { id: 'r2', date: '2019-01-01' }];
    expect(chooseCanonicalReleaseDate(releases)).toBe('2019-01-01');
  });

  test('returns null for empty', () => {
    expect(chooseCanonicalReleaseDate([])).toBeNull();
  });
});
