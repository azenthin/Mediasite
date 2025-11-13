const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const total = await prisma.verifiedTrack.count();
    const withGenres = await prisma.verifiedTrack.count({
      where: { NOT: { genres: null } }
    });
    
    console.log('📊 Final Database Stats:');
    console.log('   Total tracks:', total.toLocaleString());
    console.log('   With genres:', withGenres.toLocaleString(), '(' + Math.round(withGenres/total*100) + '%)');
    
    // Sample some tracks
    const samples = await prisma.verifiedTrack.findMany({
      take: 5,
      orderBy: { trackPopularity: 'desc' }
    });
    
    console.log('\n🎵 Top 5 Popular Tracks:');
    samples.forEach((t, i) => {
      const genres = t.genres ? JSON.parse(t.genres).slice(0, 2).join(', ') : 'No genre';
      console.log(`   ${i+1}. ${t.artist} - ${t.title} (${genres})`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
})();
