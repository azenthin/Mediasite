const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTracks() {
  try {
    const count = await prisma.verifiedTrack.count();
    const sample = await prisma.verifiedTrack.findMany({ 
      take: 15,
      include: { identifiers: true }
    });
    
    console.log(`\n🎵 Total verified tracks in database: ${count}\n`);
    console.log('📝 Sample tracks:\n');
    
    sample.forEach((t, i) => {
      const spotify = t.identifiers.find(id => id.provider === 'SPOTIFY')?.externalId || 'N/A';
      const isrc = t.identifiers.find(id => id.provider === 'ISRC')?.externalId || 'N/A';
      
      console.log(`${i + 1}. "${t.title}" by ${t.artist}`);
      console.log(`   Spotify: ${spotify}`);
      console.log(`   ISRC: ${isrc}`);
      console.log(`   Score: ${t.canonicalityScore.toFixed(3)}\n`);
    });
    
    console.log('\n✅ Dev server running at: http://localhost:3000');
    console.log('💡 Try browsing music or using the AI playlist feature!\n');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkTracks();
