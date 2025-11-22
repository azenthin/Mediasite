// Use native fetch available in Node.js 18+

interface Song {
  title: string;
  artist: string;
  genre?: string;
  mood?: string;
  year?: string | number;
  spotifyUrl?: string;
  youtubeUrl?: string;
}

interface PlaylistResponse {
  success: boolean;
  type: string;
  message: string;
  playlist?: Song[];
}

// Comprehensive test prompts covering various genres, moods, and searches
const TEST_PROMPTS = [
  // Genre-based
  'rock', 'pop', 'jazz', 'classical', 'hip hop', 'country', 'electronic', 'folk', 'metal', 'reggae',
  'blues', 'soul', 'r&b', 'indie', 'alternative', 'punk', 'techno', 'house', 'k-pop', 'latin',
  
  // Mood-based
  'happy', 'sad', 'energetic', 'chill', 'relaxing', 'uplifting', 'dark', 'melancholic', 'intense', 'mellow',
  'groovy', 'romantic', 'angry', 'peaceful', 'party', 'workout', 'focus', 'sleep', 'mysterious', 'dreamy',
  
  // Era-based
  '80s', '90s', '2000s', '2010s', 'retro', 'vintage', 'modern', 'contemporary', 'classic', 'timeless',
  
  // Activity-based
  'workout', 'study', 'party', 'road trip', 'sleep', 'meditation', 'dinner', 'dancing', 'running', 'coding',
  
  // Artist-based
  'taylor swift', 'drake', 'beyonce', 'the beatles', 'metallica', 'radiohead', 'led zeppelin', 'billie eilish', 'ariana grande', 'harry styles',
  
  // Vibe/Aesthetic
  'summer vibes', 'winter mood', 'love songs', 'breakup anthems', 'feel good', 'dark vibes', 'lo-fi', 'ambient', 'cinematic', 'indie folk',
  
  // Mixed/Complex
  'upbeat indie pop', 'dark electronic', 'chill hip hop', 'acoustic rock', 'synth pop', 'soulful r&b', 'energetic dance', 'mellow jazz',
  
  // Unusual/Creative
  'cats', 'dogs', 'ocean', 'mountain', 'neon', 'sunset', 'midnight', 'rain', 'sunshine', 'nostalgia',
  'adventure', 'love', 'pain', 'joy', 'freedom', 'rebellion', 'serenity', 'passion', 'hope', 'mystery',
  
  // Single words (edge cases)
  'music', 'song', 'beat', 'melody', 'rhythm', 'harmony', 'sound', 'tune', 'track', 'groove',
];

async function testPrompt(prompt: string): Promise<{ prompt: string; success: boolean; error?: string; songCount?: number; genres?: string[] }> {
  try {
    const response = await fetch('http://localhost:3000/api/ai/playlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        conversationHistory: [],
      }),
    });

    const data = (await response.json()) as PlaylistResponse;

    if (!data.success) {
      return { prompt, success: false, error: 'API returned success:false' };
    }

    if (data.type === 'conversation') {
      return { prompt, success: false, error: 'Returned conversation instead of playlist' };
    }

    if (!data.playlist || data.playlist.length === 0) {
      return { prompt, success: false, error: 'No songs returned' };
    }

    const genres = data.playlist
      .map(s => s.genre)
      .filter(g => g)
      .map(g => (g as string).toLowerCase());

    return {
      prompt,
      success: true,
      songCount: data.playlist.length,
      genres: [...new Set(genres)],
    };
  } catch (error) {
    return { prompt, success: false, error: String(error) };
  }
}

async function runTests() {
  console.log(`\n🎵 AI PLAYLIST HIGH-VOLUME TEST (${TEST_PROMPTS.length} prompts)\n`);
  console.log('=' .repeat(80));

  const results = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < TEST_PROMPTS.length; i++) {
    const prompt = TEST_PROMPTS[i];
    process.stdout.write(`[${i + 1}/${TEST_PROMPTS.length}] Testing "${prompt}"... `);

    const result = await testPrompt(prompt);
    results.push(result);

    if (result.success) {
      successCount++;
      console.log(`✅ ${result.songCount} songs`);
    } else {
      failureCount++;
      console.log(`❌ ${result.error}`);
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  // Analysis
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 TEST SUMMARY\n');
  console.log(`Total Prompts: ${TEST_PROMPTS.length}`);
  console.log(`✅ Successful: ${successCount} (${((successCount / TEST_PROMPTS.length) * 100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${failureCount} (${((failureCount / TEST_PROMPTS.length) * 100).toFixed(1)}%)`);

  // Failure analysis
  const failures = results.filter(r => !r.success);
  if (failures.length > 0) {
    console.log('\n❌ FAILURES:');
    failures.forEach(f => {
      console.log(`  - "${f.prompt}": ${f.error}`);
    });
  }

  // Genre analysis (which genres were returned most)
  const allGenres = results
    .filter(r => r.success && r.genres)
    .flatMap(r => r.genres || []);
  const genreCounts: { [key: string]: number } = {};
  allGenres.forEach(g => {
    genreCounts[g] = (genreCounts[g] || 0) + 1;
  });

  console.log('\n🎸 TOP GENRES RETURNED:');
  Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([genre, count]) => {
      console.log(`  ${genre}: ${count} times`);
    });

  // Song count distribution
  const successResults = results.filter(r => r.success);
  const songCounts = successResults.map(r => r.songCount || 0);
  const avgSongs = songCounts.reduce((a, b) => a + b, 0) / songCounts.length;
  const minSongs = Math.min(...songCounts);
  const maxSongs = Math.max(...songCounts);

  console.log('\n📈 SONG COUNT DISTRIBUTION:');
  console.log(`  Average: ${avgSongs.toFixed(1)} songs`);
  console.log(`  Min: ${minSongs}, Max: ${maxSongs}`);
  console.log(`  Expected: 12-15 songs per playlist`);

  // Check for consistency issues
  console.log('\n🔍 ACCURACY CHECKS:');
  
  // Check if prompts with specific genres return relevant songs
  const genrePrompts = ['rock', 'pop', 'jazz', 'classical', 'hip hop'];
  const genreAccuracy = genrePrompts.map(gp => {
    const result = results.find(r => r.prompt === gp);
    if (!result || !result.success) return null;
    
    const returnedGenres = (result.genres || []).join(', ').toLowerCase();
    const isAccurate = returnedGenres.includes(gp);
    return { prompt: gp, returned: returnedGenres, accurate: isAccurate };
  });

  genreAccuracy.filter(a => a).forEach(a => {
    const symbol = a!.accurate ? '✅' : '⚠️ ';
    console.log(`  ${symbol} "${a!.prompt}" → returned: ${a!.returned || 'unknown'}`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('\n💡 RECOMMENDATIONS:\n');
  
  if (failureCount / TEST_PROMPTS.length > 0.1) {
    console.log('⚠️  High failure rate. Check database connectivity and scoring logic.');
  }

  if (avgSongs < 12) {
    console.log('⚠️  Average songs per playlist is low. Database may not have enough data.');
  }

  if (Object.keys(genreCounts).length < 5) {
    console.log('⚠️  Limited genre diversity. Scoring may be too restrictive.');
  }

  console.log('\n✅ Test complete!\n');
}

runTests().catch(console.error);
