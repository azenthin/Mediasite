const { parseCSV, validateRows } = require('../../scripts/ingest/validate-source');

describe('validate source CSV', () => {
  test('valid rows pass', () => {
    const txt = 'Artist,Title\nA,B\nC,D';
    const rows = parseCSV(txt);
    const res = validateRows(rows);
    expect(res.valid).toBe(true);
  });

  test('missing title fails', () => {
    const txt = 'Artist,Title\nA,';
    const rows = parseCSV(txt);
    const res = validateRows(rows);
    expect(res.valid).toBe(false);
    expect(res.errors.length).toBeGreaterThan(0);
  });
});
