const { runInBatches, chunkArray } = require('../../scripts/ingest/batch-runner');

describe('batch runner', () => {
  test('chunks array correctly', () => {
    expect(chunkArray([1,2,3,4,5], 2)).toEqual([[1,2],[3,4],[5]]);
  });

  test('runs worker on all items', async () => {
    const rows = [1,2,3,4];
    const processed = [];
    await runInBatches(rows, async (x) => { processed.push(x); }, 2);
    expect(processed.length).toBe(4);
  });
});
