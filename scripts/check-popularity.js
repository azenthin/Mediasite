const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPopularityScores() {
  console.log('🔍 Checking popularity scores...\n');
  
  const total = await prisma.verifiedTrack.count();
  console.log(`📊 Total tracks: ${total}`);
  
  // Track popularity
  const withTrackPop = await prisma.verifiedTrack.count({
    where: { trackPopularity: { not: null } }
  });
  console.log(`🎵 Tracks with trackPopularity: ${withTrackPop} (${Math.round(withTrackPop/total*100)}%)`);
  
  // Artist popularity
  const withArtistPop = await prisma.verifiedTrack.count({
    where: { artistPopularity: { not: null } }
  });
  console.log(`🎤 Tracks with artistPopularity: ${withArtistPop} (${Math.round(withArtistPop/total*100)}%)`);
  
  // Both
  const withBoth = await prisma.verifiedTrack.count({
    where: { 
      AND: [
        { trackPopularity: { not: null } },
        { artistPopularity: { not: null } }
      ]
    }
  });
  console.log(`✅ Tracks with both: ${withBoth} (${Math.round(withBoth/total*100)}%)`);
  
  // Sample with scores
  console.log('\n📋 Sample tracks with popularity scores:\n');
  const samples = await prisma.verifiedTrack.findMany({
    where: { trackPopularity: { not: null } },
    orderBy: { trackPopularity: 'desc' },
    take: 10,
    select: {
      title: true,
      artist: true,
      trackPopularity: true,
      artistPopularity: true
    }
  });
  
  samples.forEach((track, i) => {
    console.log(`${i+1}. ${track.artist} - ${track.title}`);
    console.log(`   Track: ${track.trackPopularity} | Artist: ${track.artistPopularity || 'N/A'}`);
  });
  
  await prisma.$disconnect();
}

checkPopularityScores();
