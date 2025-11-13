const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function searchSong() {
  const results = await prisma.verifiedTrack.findMany({
    where: {
      OR: [
        { title: { contains: 'Popular' } },
        { artist: { contains: 'Ariana' } }
      ]
    }
  });

  console.log(`Found ${results.length} tracks matching "Popular" or "Ariana"`);
  results.forEach(t => {
    console.log(`- "${t.title}" by ${t.artist}`);
  });

  await prisma.$disconnect();
}

searchSong();
