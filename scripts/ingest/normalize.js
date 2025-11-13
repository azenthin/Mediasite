// Create a canonical record object from provider outputs.
// This is a lightweight JS implementation mirroring lib/canonicality.ts for staging use.

function computeCanonicality(evidence, weights) {
  weights = weights || {
    hasIsrc: 0.35,
    mbidMatch: 0.2,
    acoustidMatch: 0.2,
    durationSimilarity: 0.05,
    earliestRelease: 0.1,
    providerAgreement: 0.1,
  };
  const hasIsrc = evidence.hasIsrc ? 1 : 0;
  const mbidMatch = evidence.mbidMatch ? 1 : 0;
  const acoustidMatch = evidence.acoustidMatch ? 1 : 0;
  const durationSim = Math.max(0, Math.min(1, evidence.durationSimilarity || 0));
  const earliest = evidence.earliestRelease ? 1 : 0;
  const providerAgreement = Math.max(0, Math.min(1, evidence.providerAgreement || 0));
  const parts = {
    hasIsrc: weights.hasIsrc * hasIsrc,
    mbidMatch: weights.mbidMatch * mbidMatch,
    acoustidMatch: weights.acoustidMatch * acoustidMatch,
    durationSimilarity: weights.durationSimilarity * durationSim,
    earliestRelease: weights.earliestRelease * earliest,
    providerAgreement: weights.providerAgreement * providerAgreement,
  };
  const score = Object.values(parts).reduce((a, b) => a + b, 0);
  return { score: Math.max(0, Math.min(1, score)), breakdown: parts };
}

function normalize({ spotify, musicbrainz }) {
  // spotify: { found, isrc, title, artists, duration_ms, raw }
  // musicbrainz: { found, mbid, title, artists, duration, releases, raw }
  const rec = {
    title: spotify?.title || musicbrainz?.title || null,
    artists: (spotify?.artists || musicbrainz?.artists || []).map(a => (a.name || a).toString()).filter(Boolean),
    isrc: spotify?.isrc || null,
    spotify_id: spotify?.spotify_id || null,
    mbid: musicbrainz?.mbid || null,
    duration_ms: spotify?.duration_ms || (musicbrainz?.duration || null),
    releases: musicbrainz?.releases || [],
    raw: { spotify: spotify?.raw || null, musicbrainz: musicbrainz?.raw || null },
  };

  const evidence = {
    hasIsrc: !!rec.isrc,
    mbidMatch: !!rec.mbid,
    acoustidMatch: false,
    durationSimilarity: (() => {
      if (!rec.duration_ms || !musicbrainz?.duration) return 0;
      const mbMs = musicbrainz.duration;
      const diff = Math.abs(rec.duration_ms - mbMs);
      // normalize: exact match -> 1, within 3s -> 0.8, otherwise scaled
      if (diff === 0) return 1;
      if (diff <= 3000) return 0.8;
      return Math.max(0, 1 - diff / Math.max(rec.duration_ms, mbMs));
    })(),
    earliestRelease: !!(musicbrainz?.releases && musicbrainz.releases.length && musicbrainz.releases[0].date),
    providerAgreement: (() => {
      let agree = 0; let total = 0;
      if (spotify && spotify.title) { total++; if ((spotify.title || '').toLowerCase() === (musicbrainz?.title || '').toLowerCase()) agree++; }
      if (spotify && spotify.artists && spotify.artists.length) { total++; const spArtists = spotify.artists.map(a=>a.name?.toLowerCase?.()||a.toLowerCase?.()); const mbArtists = (musicbrainz?.artists||[]).map(a=> (a.name||a).toLowerCase()); if (spArtists.some(sa=>mbArtists.includes(sa))) agree++; }
      return total===0?0:agree/total;
    })(),
  };

  const canonicality = computeCanonicality(evidence);
  rec.canonicality = canonicality;
  rec.accept = canonicality.score >= 0.7;
  rec.queue = canonicality.score >= 0.4 && canonicality.score < 0.7;
  rec.skip = canonicality.score < 0.4;
  return rec;
}

module.exports = { normalize, computeCanonicality };
