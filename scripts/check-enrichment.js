const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkEnrichment() {
  console.log('🔍 Checking enrichment data...\n');
  
  // Total tracks
  const total = await prisma.verifiedTrack.count();
  console.log(`📊 Total tracks: ${total}`);
  
  // Tracks with genres
  const withGenres = await prisma.verifiedTrack.count({
    where: { genres: { not: null } }
  });
  console.log(`🎵 Tracks with genres: ${withGenres}`);
  
  // Tracks with mood
  const withMood = await prisma.verifiedTrack.count({
    where: { mood: { not: null } }
  });
  console.log(`😊 Tracks with mood: ${withMood}`);
  
  // Tracks with audio features
  const withAudioFeatures = await prisma.verifiedTrack.count({
    where: { danceability: { not: null } }
  });
  console.log(`🎼 Tracks with audio features: ${withAudioFeatures}`);
  
  // Sample tracks
  console.log(`\n📋 Sample enriched tracks:\n`);
  const samples = await prisma.verifiedTrack.findMany({
    where: { genres: { not: null } },
    take: 10,
    select: {
      title: true,
      artist: true,
      primaryGenre: true,
      trackPopularity: true,
      mood: true,
      danceability: true
    }
  });
  
  samples.forEach(track => {
    console.log(`- ${track.artist} - ${track.title}`);
    console.log(`  Genre: ${track.primaryGenre || 'N/A'} | Pop: ${track.trackPopularity || 'N/A'} | Mood: ${track.mood || 'N/A'} | Dance: ${track.danceability || 'N/A'}`);
  });
  
  await prisma.$disconnect();
}

checkEnrichment();
