import { getSpotifyRecommendations } from '../lib/music-search';

async function testAPI() {
  const prompts = ['rock', 'pop', 'jazz', 'happy', 'metal', 'indie'];
  
  console.log('🎵 TESTING SPOTIFY RECOMMENDATIONS FUNCTION\n========================================\n');

  for (const prompt of prompts) {
    console.log(`Testing: "${prompt}"`);
    try {
      const songs = await getSpotifyRecommendations(prompt);
      console.log(`  ✅ ${songs.length} songs returned`);
      if (songs.length > 0) {
        console.log(`  Top result: "${songs[0].title}" by ${songs[0].artist} (${songs[0].genre})`);
        
        // Count genres
        const genreCount = new Map<string, number>();
        songs.forEach(s => {
          const g = s.genre || 'unknown';
          genreCount.set(g, (genreCount.get(g) || 0) + 1);
        });
        
        const topGenres = Array.from(genreCount.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(g => `${g[0]} (${g[1]})`)
          .join(', ');
        
        console.log(`  Top genres: ${topGenres}`);
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error}`);
    }
    console.log('');
  }

  console.log('========================================');
  console.log('✅ Test complete!');
  process.exit(0);
}

testAPI().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
