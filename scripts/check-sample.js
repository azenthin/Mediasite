require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSample() {
  const tracks = await prisma.verifiedTrack.findMany({
    take: 10,
    select: {
      title: true,
      artist: true,
      album: true,
      spotifyId: true,
    },
  });

  console.log('Sample of 10 tracks from database:');
  tracks.forEach((t, i) => {
    console.log(`${i + 1}. "${t.title}" by ${t.artist}`);
    console.log(`   Album: ${t.album || 'N/A'}`);
  });

  await prisma.$disconnect();
}

checkSample();
