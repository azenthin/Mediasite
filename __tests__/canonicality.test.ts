import computeCanonicality from '@/lib/canonicality';

describe('computeCanonicality', () => {
  test('high-confidence case (ISRC + MBID + duration + earliest + provider)', () => {
    const evidence = {
      hasIsrc: true,
      mbidMatch: true,
      acoustidMatch: false,
      durationSimilarity: 1,
      earliestRelease: true,
      providerAgreement: 1,
    };

    const result = computeCanonicality(evidence as any);
    expect(result.score).toBeGreaterThanOrEqual(0.75);
    expect(result.breakdown.hasIsrc).toBeGreaterThan(0);
    expect(result.breakdown.mbidMatch).toBeGreaterThan(0);
  });

  test('low-confidence case (nothing matches)', () => {
    const evidence = {};
    const result = computeCanonicality(evidence as any);
    expect(result.score).toBe(0);
  });

  test('acoustid rescue pushes over threshold', () => {
    const evidence = {
      hasIsrc: false,
      mbidMatch: false,
      acoustidMatch: true,
      durationSimilarity: 0.95,
      earliestRelease: false,
      providerAgreement: 0.5,
    };

    const result = computeCanonicality(evidence as any);
    // acoustid (0.2) + duration (0.0475) + provider(0.05) ~= 0.2975
    expect(result.score).toBeGreaterThanOrEqual(0.25);
  });
});
