/*
  AcoustID fingerprint lookup helper.
  - Requires ACOUSTID_API_KEY in env for real lookups.
  - In test/mock mode, returns synthetic responses to avoid needing the binary or API key.
*/

const ACOUSTID_API_URL = 'https://api.acoustid.org/v2/lookup';

/**
 * Lookup a fingerprint via AcoustID to resolve to MBID(s).
 * @param {string} fp - Chromaprint fingerprint string
 * @param {number} duration - Duration in seconds (optional, used for hinting)
 * @returns {Promise<object>} - { found, mbids, recordings, duration, confidence, reason? }
 */
async function lookupByFingerprint(fp, duration) {
  if (!fp) return { found: false, reason: 'no-fingerprint' };

  const apiKey = process.env.ACOUSTID_API_KEY;
  if (!apiKey) {
    // Mock mode: return a minimal response so tests pass without API key.
    return {
      found: false,
      reason: 'no-api-key',
      note: 'set ACOUSTID_API_KEY to enable real AcoustID lookups',
    };
  }

  try {
    const params = new URLSearchParams({
      client: apiKey,
      fingerprint: fp,
      meta: 'recordings',
    });
    if (duration) {
      params.append('duration', Math.round(duration));
    }

    const url = `${ACOUSTID_API_URL}?${params}`;
    const res = await fetch(url);
    if (!res.ok) {
      return { found: false, reason: `http-${res.status}`, error: res.statusText };
    }

    const data = await res.json();
    if (data.status !== 'ok') {
      return {
        found: false,
        reason: 'acoustid-error',
        error: data.error || 'unknown',
      };
    }

    const results = data.results || [];
    if (!results.length) {
      return { found: false, reason: 'no-matches' };
    }

    // Collect MBIDs from all recordings in top result.
    const topResult = results[0];
    const mbids = [];
    const recordingsInfo = [];
    if (topResult.recordings) {
      for (const rec of topResult.recordings) {
        if (rec.id) recordingsInfo.push(rec.id);
        if (rec.mbid) mbids.push(rec.mbid);
      }
    }

    return {
      found: mbids.length > 0,
      mbids,
      recordings: recordingsInfo,
      duration: topResult.duration,
      confidence: topResult.score || 0,
      reason: mbids.length > 0 ? 'matched' : 'no-mbid',
    };
  } catch (err) {
    return {
      found: false,
      reason: 'lookup-error',
      error: err.message,
    };
  }
}

/**
 * Compute Chromaprint fingerprint for an audio file.
 * Requires `fpcalc` binary in PATH.
 * @param {string} filePath - path to audio file
 * @returns {Promise<object>} - { fingerprint, duration, error? }
 */
async function computeFingerprint(filePath) {
  const { execFile } = require('child_process');
  const util = require('util');
  const execFileAsync = util.promisify(execFile);

  try {
    const { stdout } = await execFileAsync('fpcalc', ['-json', filePath]);
    const parsed = JSON.parse(stdout);
    return {
      fingerprint: parsed.fingerprint,
      duration: parsed.duration,
    };
  } catch (err) {
    return {
      fingerprint: null,
      duration: null,
      error: err.message,
    };
  }
}

module.exports = {
  lookupByFingerprint,
  computeFingerprint,
};
