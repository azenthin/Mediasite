import { prisma } from '../lib/database';

async function checkData() {
  // Check a few sample records
  const samples = await prisma.verifiedTrack.findMany({
    take: 5,
    select: {
      title: true,
      artist: true,
      primaryGenre: true,
      mood: true,
      trackPopularity: true,
    },
  });

  console.log('Sample records:');
  samples.forEach((s, i) => {
    console.log(`${i + 1}. "${s.title}" by ${s.artist}`);
    console.log(`   Genre: ${s.primaryGenre || 'NULL'}`);
    console.log(`   Mood: ${s.mood || 'NULL'}`);
    console.log('');
  });

  // Check genres with "rock" in them (SQLite doesn't support case-insensitive contains)
  const allGenres = await prisma.verifiedTrack.findMany({
    select: {
      primaryGenre: true,
    },
    distinct: ['primaryGenre'],
    take: 30,
  });

  const rockGenres = allGenres.filter((g) => g.primaryGenre?.toLowerCase().includes('rock'));
  const rockTracks = await prisma.verifiedTrack.findMany({
    where: {
      primaryGenre: {
        in: rockGenres.map((g) => g.primaryGenre || ''),
      },
    },
    take: 3,
    select: {
      title: true,
      artist: true,
      primaryGenre: true,
    },
  });

  console.log('\nTracks with "rock" in genre:');
  console.log(`Found: ${rockGenres.length || 'NONE'}`);
  rockGenres.forEach((s) => {
    console.log(`  "${s.title}" - ${s.primaryGenre}`);
  });

  process.exit(0);
}

checkData().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
