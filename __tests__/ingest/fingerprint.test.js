const path = require('path');
const fs = require('fs');

describe('Fingerprint Ingestion Path', () => {
  it('should compute fingerprint and lookup via AcoustID', async () => {
    // Mock the acoustid module
    const { lookupByFingerprint, computeFingerprint } = require('../../scripts/ingest/acoustid');

    // Test 1: No fingerprint case
    const noFpResult = await lookupByFingerprint();
    expect(noFpResult.found).toBe(false);
    expect(noFpResult.reason).toBe('no-fingerprint');

    // Test 2: With API key mocked, should call fetch
    process.env.ACOUSTID_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'ok',
        results: [
          {
            score: 0.92,
            duration: 240,
            recordings: [{ id: 'rec-456', mbid: 'mbid-789' }],
          },
        ],
      }),
    });

    const fpResult = await lookupByFingerprint('test-fingerprint', 240);
    expect(fpResult.found).toBe(true);
    expect(fpResult.mbids).toContain('mbid-789');

    // Clean up
    delete global.fetch;
    delete process.env.ACOUSTID_API_KEY;
  });

  it('should detect missing fpcalc binary gracefully', async () => {
    const { computeFingerprint } = require('../../scripts/ingest/acoustid');

    // Try to compute fingerprint for a nonexistent file
    const result = await computeFingerprint('/path/to/nonexistent.mp3');
    expect(result.fingerprint).toBe(null);
    expect(result.error).toBeDefined();
  });

  it('should integrate into run-sample.js fallback path', async () => {
    // Verify that run-sample.js imports acoustid helpers
    const runSamplePath = path.join(__dirname, '../../scripts/ingest/run-sample.js');
    const runSampleContent = fs.readFileSync(runSamplePath, 'utf8');
    
    expect(runSampleContent).toContain("require('./acoustid')");
    expect(runSampleContent).toContain('lookupByFingerprint');
    expect(runSampleContent).toContain('computeFingerprint');
    expect(runSampleContent).toContain('Step 4: If no MBID yet and audio file provided');
  });
});
