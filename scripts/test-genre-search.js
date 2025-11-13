const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testGenreSearch() {
  const queries = ['pop', 'rock', 'edm', 'swedish', 'k-pop'];
  
  console.log('🔍 Testing genre-based searches...\n');
  
  for (const query of queries) {
    const results = await prisma.verifiedTrack.findMany({
      where: {
        OR: [
          { artist: { contains: query } },
          { title: { contains: query } },
          { album: { contains: query } },
          { primaryGenre: { contains: query } },
          { genres: { contains: query } },
          { mood: { contains: query } },
        ],
      },
      orderBy: [
        { trackPopularity: 'desc' },
        { verifiedAt: 'desc' },
      ],
      take: 5,
      select: {
        title: true,
        artist: true,
        primaryGenre: true,
        trackPopularity: true,
      }
    });
    
    console.log(`📊 Query: "${query}" - Found ${results.length} tracks`);
    results.forEach((track, i) => {
      console.log(`  ${i + 1}. ${track.artist} - ${track.title}`);
      console.log(`     Genre: ${track.primaryGenre || 'N/A'} | Popularity: ${track.trackPopularity || 'N/A'}`);
    });
    console.log('');
  }
  
  await prisma.$disconnect();
}

testGenreSearch();
