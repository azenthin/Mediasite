const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    const count = await prisma.verifiedTrack.count();
    console.log(`VerifiedTrack count: ${count}`);
    
    if (count > 0) {
      const sample = await prisma.verifiedTrack.findMany({
        take: 5,
        select: {
          title: true,
          artist: true,
          spotifyId: true,
        }
      });
      console.log('\nSample records:');
      sample.forEach((track, i) => {
        console.log(`${i + 1}. ${track.artist} - ${track.title} (${track.spotifyId || 'no spotify id'})`);
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
