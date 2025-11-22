import { prisma } from '../lib/database';

async function checkTop300() {
  const top300 = await prisma.verifiedTrack.findMany({
    take: 300,
    orderBy: { trackPopularity: 'desc' },
    select: {
      primaryGenre: true,
      trackPopularity: true,
    },
  });

  // Count genres
  const genreMap = new Map<string, number>();
  top300.forEach((t) => {
    const genre = t.primaryGenre || 'unknown';
    genreMap.set(genre, (genreMap.get(genre) || 0) + 1);
  });

  // Sort by count
  const sorted = Array.from(genreMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  console.log('Top 20 genres in top 300 tracks by popularity:\n');
  sorted.forEach(([genre, count]) => {
    console.log(`  ${genre.padEnd(20)} ${count.toString().padStart(3)} tracks (${(count / 300 * 100).toFixed(1)}%)`);
  });

  // Check if any rock genres exist outside top 300
  const allRockTracks = await prisma.verifiedTrack.findMany({
    where: {
      primaryGenre: {
        in: ['rock', 'classic rock', 'arena rock', 'garage rock', 'yacht rock', 'rockabilly'],
      },
    },
    select: {
      primaryGenre: true,
      trackPopularity: true,
    },
  });

  console.log(`\n\nTotal rock tracks in database: ${allRockTracks.length}`);
  const rockGenreCount = new Map<string, { count: number; avgPopularity: number }>();
  allRockTracks.forEach((t) => {
    const genre = t.primaryGenre || 'unknown';
    const current = rockGenreCount.get(genre) || { count: 0, avgPopularity: 0 };
    current.count++;
    current.avgPopularity = (current.avgPopularity * (current.count - 1) + (t.trackPopularity || 0)) / current.count;
    rockGenreCount.set(genre, current);
  });

  console.log('\nRock genre distribution:');
  Array.from(rockGenreCount.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([genre, data]) => {
      console.log(`  ${genre.padEnd(20)} ${data.count.toString().padStart(4)} tracks (avg popularity: ${data.avgPopularity.toFixed(0)})`);
    });

  process.exit(0);
}

checkTop300().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
