// Choose canonical release date from MusicBrainz release list
function chooseCanonicalReleaseDate(releases) {
  if (!releases || releases.length === 0) return null;
  // Prefer release that lists an ISRC appearance (release.metadata may not have ISRC info in this simplified model)
  // Fallback: earliest release date available
  const dates = releases
    .map(r => ({ id: r.id, date: r.date }))
    .filter(r => r.date)
    .map(r => ({ id: r.id, date: new Date(r.date) }))
    .sort((a, b) => a.date - b.date);
  if (dates.length === 0) return null;
  return dates[0].date.toISOString().split('T')[0]; // return YYYY-MM-DD
}

module.exports = { chooseCanonicalReleaseDate };
