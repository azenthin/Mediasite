// Simple genre reconciliation: given arrays of genre sources, pick primary via weighting.
function choosePrimaryGenre(candidates) {
  // candidates: [{source: 'musicbrainz'|'spotify', genres: ['pop','dance']}, ...]
  const scores = {};
  for (const c of candidates || []) {
    const weight = c.source === 'musicbrainz' ? 2 : 1; // prefer MB tags
    for (const g of c.genres || []) {
      scores[g] = (scores[g] || 0) + weight;
    }
  }
  const entries = Object.entries(scores);
  if (entries.length === 0) return null;
  entries.sort((a,b)=> b[1]-a[1]);
  return entries[0][0];
}

module.exports = { choosePrimaryGenre };
