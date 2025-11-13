const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteTracksWithoutGenre() {
  console.log('🔍 Checking tracks without genres...\n');
  
  // Count tracks without genres
  const countWithoutGenre = await prisma.verifiedTrack.count({
    where: {
      OR: [
        { genres: null },
        { primaryGenre: null }
      ]
    }
  });
  
  console.log(`📊 Found ${countWithoutGenre} tracks without genres`);
  
  if (countWithoutGenre === 0) {
    console.log('✅ All tracks have genres!');
    await prisma.$disconnect();
    return;
  }
  
  // Delete tracks without genres
  console.log(`\n🗑️  Deleting ${countWithoutGenre} tracks...\n`);
  
  const result = await prisma.verifiedTrack.deleteMany({
    where: {
      OR: [
        { genres: null },
        { primaryGenre: null }
      ]
    }
  });
  
  console.log(`✅ Deleted ${result.count} tracks without genres`);
  
  // Show remaining count
  const remaining = await prisma.verifiedTrack.count();
  console.log(`📊 Remaining tracks: ${remaining}`);
  
  await prisma.$disconnect();
}

deleteTracksWithoutGenre();
