export interface CanonicalityEvidence {
  hasIsrc?: boolean;
  mbidMatch?: boolean;
  acoustidMatch?: boolean;
  durationSimilarity?: number; // 0..1 where 1 is exact match
  earliestRelease?: boolean;
  providerAgreement?: number; // 0..1 proportion of providers that agree
}

export interface CanonicalityResult {
  score: number; // 0..1
  breakdown: {
    hasIsrc: number;
    mbidMatch: number;
    acoustidMatch: number;
    durationSimilarity: number;
    earliestRelease: number;
    providerAgreement: number;
  };
}

// Default weights (sum to 1.0)
const DEFAULT_WEIGHTS = {
  hasIsrc: 0.35,
  mbidMatch: 0.20,
  acoustidMatch: 0.20,
  durationSimilarity: 0.05,
  earliestRelease: 0.10,
  providerAgreement: 0.10,
};

export function computeCanonicality(evidence: CanonicalityEvidence, weights = DEFAULT_WEIGHTS): CanonicalityResult {
  const hasIsrc = evidence.hasIsrc ? 1 : 0;
  const mbidMatch = evidence.mbidMatch ? 1 : 0;
  const acoustidMatch = evidence.acoustidMatch ? 1 : 0;
  const durationSim = Math.max(0, Math.min(1, evidence.durationSimilarity ?? 0));
  const earliest = evidence.earliestRelease ? 1 : 0;
  const providerAgreement = Math.max(0, Math.min(1, evidence.providerAgreement ?? 0));

  const parts = {
    hasIsrc: weights.hasIsrc * hasIsrc,
    mbidMatch: weights.mbidMatch * mbidMatch,
    acoustidMatch: weights.acoustidMatch * acoustidMatch,
    durationSimilarity: weights.durationSimilarity * durationSim,
    earliestRelease: weights.earliestRelease * earliest,
    providerAgreement: weights.providerAgreement * providerAgreement,
  };

  const score = Object.values(parts).reduce((a, b) => a + b, 0);

  return {
    score: Math.max(0, Math.min(1, score)),
    breakdown: {
      hasIsrc: parts.hasIsrc,
      mbidMatch: parts.mbidMatch,
      acoustidMatch: parts.acoustidMatch,
      durationSimilarity: parts.durationSimilarity,
      earliestRelease: parts.earliestRelease,
      providerAgreement: parts.providerAgreement,
    },
  };
}

export default computeCanonicality;
