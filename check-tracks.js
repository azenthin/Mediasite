process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./prisma/dev.db';
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkTracks() {
  try {
    console.log('Checking VerifiedTrack database...\n');
    
    const total = await prisma.verifiedTrack.count();
    console.log(`Total tracks: ${total.toLocaleString()}`);
    
    const genres = await prisma.verifiedTrack.groupBy({
      by: ['primaryGenre'],
      _count: true,
    });
    
    console.log(`Unique genres: ${genres.length}`);
    
    const sortedGenres = genres
      .sort((a, b) => b._count - a._count)
      .slice(0, 30);
    
    console.log('\n=== Top 30 Genres by Track Count ===');
    sortedGenres.forEach((genre, i) => {
      console.log(`${i + 1}. ${genre.primaryGenre || '(null)'}: ${genre._count.toLocaleString()} tracks`);
    });
    
    // Check recently added
    const recent = await prisma.verifiedTrack.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { title: true, artist: true, primaryGenre: true, createdAt: true }
    });
    
    console.log('\n=== 5 Most Recently Added Tracks ===');
    recent.forEach((track, i) => {
      console.log(`${i + 1}. ${track.artist} - ${track.title}`);
      console.log(`   Genre: ${track.primaryGenre}, Added: ${track.createdAt}`);
    });
    
  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTracks();
