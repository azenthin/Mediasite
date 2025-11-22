import { getSpotifyRecommendations } from '../lib/music-search';

async function runQuickTest() {
  console.log('\n🧪 QUICK TEST - Checking Fixes\n');
  
  const testCases = [
    // Test 1: Multi-word queries
    { prompt: 'dark electronic', name: 'Multi-word: dark electronic' },
    { prompt: 'chill hip hop', name: 'Multi-word: chill hip hop' },
    { prompt: 'acoustic rock', name: 'Multi-word: acoustic rock' },
    
    // Test 2: Single-artist searches (should have max 2-3 per artist now)
    { prompt: 'taylor swift', name: 'Artist: taylor swift' },
    { prompt: 'the beatles', name: 'Artist: the beatles' },
    
    // Test 3: Regular genres
    { prompt: 'rock', name: 'Genre: rock' },
    { prompt: 'jazz', name: 'Genre: jazz' },
  ];
  
  for (const test of testCases) {
    const start = Date.now();
    try {
      const result = await getSpotifyRecommendations(test.prompt);
      const elapsed = Date.now() - start;
      
      // Count songs per artist
      const artistCount = new Map<string, number>();
      let maxPerArtist = 0;
      result.forEach(song => {
        const count = (artistCount.get(song.artist) || 0) + 1;
        artistCount.set(song.artist, count);
        maxPerArtist = Math.max(maxPerArtist, count);
      });
      
      const passed = 
        result.length === 15 && 
        maxPerArtist <= 3 && 
        elapsed < 600;
      
      console.log(`${passed ? '✅' : '❌'} ${test.name}`);
      console.log(`   Songs: ${result.length}/15, Max per artist: ${maxPerArtist}/3, Time: ${elapsed}ms`);
      
      if (result.length > 0) {
        const topArtist = Array.from(artistCount.entries()).sort((a, b) => b[1] - a[1])[0];
        console.log(`   Top artist: ${topArtist[0]} (${topArtist[1]} songs)`);
      }
    } catch (err) {
      console.log(`❌ ${test.name}`);
      console.log(`   ERROR: ${err instanceof Error ? err.message : String(err)}`);
    }
    console.log();
  }
}

runQuickTest().catch(console.error);
