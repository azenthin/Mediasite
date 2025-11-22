import { prisma } from '../lib/database';

interface Track {
  id: string;
  title: string;
  artist: string;
  primaryGenre?: string;
  genres?: string;
  mood?: string;
  trackPopularity?: number;
}

/**
 * Direct test of the scoring algorithm (simulating queryVerifiedTracks)
 */
async function testScoringAlgorithm(prompt: string) {
  console.log(`\n📊 Testing prompt: "${prompt}"`);

  try {
    // Use NEW algorithm: fetch relevant tracks FIRST
    const promptLower = prompt.toLowerCase();
    
    // First, check if we can find relevant tracks by genre/mood/artist/title
    const relevantTracks = await prisma.verifiedTrack.findMany({
      where: {
        OR: [
          { primaryGenre: { contains: promptLower } },
          { artist: { contains: promptLower } },
          { title: { contains: promptLower } },
        ]
      },
      orderBy: { trackPopularity: 'desc' },
      take: 150
    });
    
    // If we found relevant tracks, use them. Otherwise, fall back to top 300 by popularity
    const allTracks = relevantTracks.length > 0 
      ? relevantTracks 
      : await prisma.verifiedTrack.findMany({
          orderBy: { trackPopularity: 'desc' },
          take: 300
        });

    console.log(`  Found ${relevantTracks.length} relevant tracks, using ${allTracks.length} total`);

    // Score them (matching the algorithm in lib/music-search.ts)
    const scoredTracks = allTracks.map((track: any) => {
      let score = 0;

      // Parse genres and moods
      const genres = (track.primaryGenre || '')
        .toLowerCase()
        .split(',')
        .map((g) => g.trim())
        .filter((g) => g);

      const moods = (track.mood || '')
        .toLowerCase()
        .split(',')
        .map((m) => m.trim())
        .filter((m) => m);

      // Genre matching (highest priority)
      if (genres.some((g) => g === promptLower || g.includes(promptLower))) {
        score += 100;
      }

      // Mood matching
      if (moods.some((m) => m === promptLower || m.includes(promptLower))) {
        score += 80;
      }

      // Title matching
      if (track.title.toLowerCase().includes(promptLower)) {
        score += 40;
      }

      // Artist matching
      if (track.artist.toLowerCase().includes(promptLower)) {
        score += 30;
      }

      // Popularity bonus (only if score > 0)
      if (score > 0) {
        score += (track.trackPopularity || 0) * 0.2;
      }

      return {
        id: track.id,
        title: track.title,
        artist: track.artist,
        primaryGenre: track.primaryGenre,
        score,
      };
    });

    // Sort by score and take top 75
    const topScored = scoredTracks
      .sort((a, b) => b.score - a.score)
      .slice(0, 75);

    console.log(`  Top 75 scored: ${topScored.length}`);

    // Show top matches
    const nonZeroScore = topScored.filter((t) => t.score > 0).length;
    console.log(`  ✅ Matches: ${nonZeroScore} songs with score > 0`);

    if (topScored.length > 0) {
      console.log(`  Top result: "${topScored[0].title}" by ${topScored[0].artist} (score: ${topScored[0].score.toFixed(1)})`);

      // Show genre distribution
      const genreMap = new Map<string, number>();
      topScored.forEach((t) => {
        const g = t.primaryGenre || 'unknown';
        genreMap.set(g, (genreMap.get(g) || 0) + 1);
      });

      const topGenres = Array.from(genreMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      console.log(`  Top genres: ${topGenres.map((g) => `${g[0]} (${g[1]})`).join(', ')}`);

      // Check if matching tracks exist
      const perfectMatches = topScored.filter((t) => t.score >= 100);
      console.log(`  ✅ Perfect matches (score >= 100): ${perfectMatches.length}`);
    } else {
      console.log(`  ❌ NO MATCHES FOUND`);
    }
  } catch (error) {
    console.error(`  Error: ${error}`);
  }
}

/**
 * Run tests
 */
async function runTests() {
  const testPrompts = [
    'rock',
    'pop',
    'jazz',
    'happy',
    'sad',
    'workout',
    'chill',
    'metal',
    'indie',
    'taylor swift',
  ];

  console.log('🎵 DIRECT SCORING ALGORITHM TEST\n=====================================');
  console.log(`Testing ${testPrompts.length} prompts against database\n`);

  for (const prompt of testPrompts) {
    await testScoringAlgorithm(prompt);
  }

  console.log('\n=====================================');
  console.log('✅ Test complete!');
  process.exit(0);
}

runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
