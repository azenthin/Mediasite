import { getSpotifyRecommendations } from '../lib/music-search';

interface TestResult {
  prompt: string;
  success: boolean;
  error?: string;
  songs?: any[];
  issues?: string[];
}

interface IssueCategory {
  name: string;
  count: number;
  prompts: string[];
}

interface Stats {
  totalSongs: number;
  avgSongsPerPlaylist: number;
  minSongs: number;
  maxSongs: number;
  duplicateSongs: Set<string>;
  duplicateArtists: { [prompt: string]: number };
  genreAccuracy: number;
  missingMetadata: number;
  invalidSpotifyUrls: number;
  invalidYouTubeUrls: number;
}

/**
 * Issue categories to check:
 * 1. Song Count - should be 15 per playlist
 * 2. Duplicate Songs - same song appearing in different positions
 * 3. Artist Diversity - no more than 2-3 songs from same artist
 * 4. Relevance/Genre Accuracy - songs match the search query
 * 5. Metadata Completeness - title, artist, genre present
 * 6. Spotify/YouTube URLs - valid format and not null for most songs
 * 7. Variety - repeated searches return different songs
 * 8. Edge Cases - unusual prompts, special characters
 * 9. Performance - all requests complete in reasonable time
 * 10. Consistency - same prompt gives same quality results
 */

const TEST_PROMPTS = [
  // Genres (20)
  'rock', 'pop', 'jazz', 'metal', 'indie', 'hip hop', 'country', 'electronic',
  'folk', 'classical', 'reggae', 'blues', 'soul', 'r&b', 'techno', 'house',
  'punk', 'alternative', 'k-pop', 'latin',

  // Moods (15)
  'happy', 'sad', 'chill', 'energetic', 'relaxing', 'dark', 'peaceful',
  'romantic', 'uplifting', 'melancholic', 'intense', 'groovy', 'dreamy',
  'mellow', 'angry',

  // Activities (10)
  'workout', 'study', 'party', 'sleep', 'meditation', 'dinner', 'road trip',
  'dancing', 'running', 'coding',

  // Eras (10)
  '80s', '90s', '2000s', '2010s', 'retro', 'vintage', 'modern', 'contemporary',
  'classic', 'timeless',

  // Artists (15)
  'taylor swift', 'drake', 'beyonce', 'the beatles', 'metallica', 'radiohead',
  'led zeppelin', 'billie eilish', 'ariana grande', 'harry styles',
  'weeknd', 'ed sheeran', 'adele', 'eminem', 'rihanna',

  // Complex/Mixed (10)
  'dark electronic', 'chill hip hop', 'acoustic rock', 'synth pop', 'soulful r&b',
  'upbeat indie pop', 'energetic dance', 'mellow jazz', 'summer vibes', 'lo-fi',

  // Edge Cases (10)
  'cats', 'ocean', 'sunset', 'neon', 'rain', 'midnight', 'adventure', 'mystery', 'love', 'pain',
];

async function testPlaylist(prompt: string): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    const songs = await getSpotifyRecommendations(prompt);
    const duration = Date.now() - startTime;
    
    const issues: string[] = [];
    
    // Check song count
    if (songs.length !== 15) {
      issues.push(`Song count is ${songs.length}, expected 15`);
    }
    
    // Check for duplicates
    const songIds = new Set<string>();
    songs.forEach(s => {
      const id = `${s.title}|${s.artist}`.toLowerCase();
      if (songIds.has(id)) {
        issues.push(`Duplicate song detected: "${s.title}" by ${s.artist}`);
      }
      songIds.add(id);
    });
    
    // Check artist diversity
    const artistCount = new Map<string, number>();
    songs.forEach(s => {
      const artist = s.artist.toLowerCase();
      artistCount.set(artist, (artistCount.get(artist) || 0) + 1);
    });
    
    let maxFromArtist = 0;
    artistCount.forEach(count => {
      if (count > 3) {
        issues.push(`Too many songs from one artist: ${count} (max should be 3)`);
      }
      maxFromArtist = Math.max(maxFromArtist, count);
    });
    
    // Check metadata completeness
    songs.forEach((s, i) => {
      if (!s.title || !s.title.trim()) {
        issues.push(`Song ${i + 1}: Missing title`);
      }
      if (!s.artist || !s.artist.trim()) {
        issues.push(`Song ${i + 1}: Missing artist`);
      }
    });
    
    // Check Spotify URLs
    const validSpotifyUrls = songs.filter(s => s.spotifyUrl && s.spotifyUrl.startsWith('spotify:track:')).length;
    if (validSpotifyUrls < songs.length * 0.7) {
      issues.push(`Only ${validSpotifyUrls}/${songs.length} songs have valid Spotify URLs`);
    }
    
    // Check genre relevance (basic check)
    const promptLower = prompt.toLowerCase();
    const relevantSongs = songs.filter(s => {
      const genreLower = (s.genre || '').toLowerCase();
      return genreLower.includes(promptLower) || 
             s.title?.toLowerCase().includes(promptLower) ||
             s.artist?.toLowerCase().includes(promptLower);
    });
    
    const relevanceScore = (relevantSongs.length / songs.length) * 100;
    if (relevanceScore < 60) {
      issues.push(`Low relevance score: ${relevanceScore.toFixed(0)}% (expected >60%)`);
    }
    
    // Check performance
    if (duration > 500) {
      issues.push(`Slow response time: ${duration}ms (expected <500ms)`);
    }
    
    return {
      prompt,
      success: issues.length === 0,
      songs,
      issues: issues.length > 0 ? issues : undefined,
    };
  } catch (error) {
    return {
      prompt,
      success: false,
      error: String(error),
    };
  }
}

async function runTests() {
  console.log('🎵 COMPREHENSIVE 100-SONG PLAYLIST TEST\n');
  console.log(`Testing ${TEST_PROMPTS.length} prompts with 100+ songs total\n`);
  console.log('=====================================\n');
  console.log('ISSUE CHECKLIST:');
  console.log('✓ Song Count (15 per playlist)');
  console.log('✓ Duplicate Songs Detection');
  console.log('✓ Artist Diversity (max 3 per artist)');
  console.log('✓ Metadata Completeness');
  console.log('✓ Spotify URL Validity');
  console.log('✓ Genre/Mood Relevance');
  console.log('✓ Response Time Performance');
  console.log('\n=====================================\n');
  
  const results: TestResult[] = [];
  const issues: Map<string, IssueCategory> = new Map();
  
  // Run all tests
  for (let i = 0; i < TEST_PROMPTS.length; i++) {
    const prompt = TEST_PROMPTS[i];
    process.stdout.write(`[${i + 1}/${TEST_PROMPTS.length}] Testing "${prompt}"... `);
    
    const result = await testPlaylist(prompt);
    results.push(result);
    
    if (result.success) {
      console.log('✅');
    } else {
      console.log('❌');
      
      // Categorize issues
      if (result.error) {
        const category = 'Error/Exception';
        if (!issues.has(category)) {
          issues.set(category, { name: category, count: 0, prompts: [] });
        }
        const cat = issues.get(category)!;
        cat.count++;
        cat.prompts.push(prompt);
      } else if (result.issues) {
        result.issues.forEach(issue => {
          const category = issue.split(':')[0];
          if (!issues.has(category)) {
            issues.set(category, { name: category, count: 0, prompts: [] });
          }
          const cat = issues.get(category)!;
          cat.count++;
          if (!cat.prompts.includes(prompt)) {
            cat.prompts.push(prompt);
          }
        });
      }
    }
  }
  
  // Calculate statistics
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.length - successCount;
  
  const stats: Stats = {
    totalSongs: 0,
    avgSongsPerPlaylist: 0,
    minSongs: Infinity,
    maxSongs: -Infinity,
    duplicateSongs: new Set(),
    duplicateArtists: {},
    genreAccuracy: 0,
    missingMetadata: 0,
    invalidSpotifyUrls: 0,
    invalidYouTubeUrls: 0,
  };
  
  // Analyze all songs
  const allSongs = new Set<string>();
  results.forEach(result => {
    if (result.songs) {
      stats.totalSongs += result.songs.length;
      stats.minSongs = Math.min(stats.minSongs, result.songs.length);
      stats.maxSongs = Math.max(stats.maxSongs, result.songs.length);
      
      result.songs.forEach(song => {
        const songKey = `${song.title}|${song.artist}`.toLowerCase();
        if (allSongs.has(songKey)) {
          stats.duplicateSongs.add(songKey);
        }
        allSongs.add(songKey);
        
        // Check metadata
        if (!song.title || !song.artist) {
          stats.missingMetadata++;
        }
        
        // Check URLs
        if (!song.spotifyUrl || !song.spotifyUrl.startsWith('spotify:track:')) {
          stats.invalidSpotifyUrls++;
        }
        if (song.youtubeUrl && !song.youtubeUrl.startsWith('https://www.youtube.com')) {
          stats.invalidYouTubeUrls++;
        }
      });
    }
  });
  
  stats.avgSongsPerPlaylist = stats.totalSongs / results.length;
  
  // Print results
  console.log('\n=====================================');
  console.log('📊 TEST RESULTS\n');
  
  console.log(`Total Playlists Tested: ${results.length}`);
  console.log(`✅ Successful: ${successCount} (${(successCount / results.length * 100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${failureCount} (${(failureCount / results.length * 100).toFixed(1)}%)\n`);
  
  console.log('SONG STATISTICS:');
  console.log(`  Total Songs: ${stats.totalSongs}`);
  console.log(`  Average per Playlist: ${stats.avgSongsPerPlaylist.toFixed(1)}`);
  console.log(`  Min: ${stats.minSongs}, Max: ${stats.maxSongs}`);
  console.log(`  Unique Songs: ${allSongs.size}`);
  console.log(`  Duplicate Songs Found: ${stats.duplicateSongs.size}\n`);
  
  console.log('METADATA QUALITY:');
  console.log(`  Missing Metadata: ${stats.missingMetadata}`);
  console.log(`  Invalid Spotify URLs: ${stats.invalidSpotifyUrls}/${stats.totalSongs}`);
  console.log(`  Invalid YouTube URLs: ${stats.invalidYouTubeUrls}/${stats.totalSongs}\n`);
  
  if (issues.size > 0) {
    console.log('⚠️  ISSUES FOUND:\n');
    const sortedIssues = Array.from(issues.values()).sort((a, b) => b.count - a.count);
    
    sortedIssues.forEach(issue => {
      console.log(`${issue.name}: ${issue.count} occurrence(s)`);
      console.log(`  Prompts: ${issue.prompts.slice(0, 5).join(', ')}${issue.prompts.length > 5 ? '...' : ''}`);
      console.log('');
    });
  } else {
    console.log('✅ NO ISSUES FOUND!\n');
  }
  
  // Detailed failure report
  if (failureCount > 0) {
    console.log('FAILURES DETAILS:');
    results.filter(r => !r.success).forEach(result => {
      console.log(`\n"${result.prompt}"`);
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      } else if (result.issues) {
        result.issues.forEach(issue => console.log(`  - ${issue}`));
      }
    });
  }
  
  // Summary recommendations
  console.log('\n=====================================');
  console.log('💡 RECOMMENDATIONS:\n');
  
  if (successCount === results.length) {
    console.log('✅ ALL TESTS PASSED! Playlist generation is working perfectly.');
  } else {
    if (failureCount / results.length > 0.1) {
      console.log(`⚠️  High failure rate (${(failureCount / results.length * 100).toFixed(1)}%). Check scoring algorithm.`);
    }
    if (stats.duplicateSongs.size > 0) {
      console.log('⚠️  Duplicate songs detected. Artist diversity may not be working correctly.');
    }
    if (stats.minSongs < 12) {
      console.log('⚠️  Some playlists have fewer than 12 songs. May need to adjust fetch limit.');
    }
    if (stats.invalidSpotifyUrls > stats.totalSongs * 0.1) {
      console.log('⚠️  Many invalid Spotify URLs. Check TrackIdentifier table integrity.');
    }
  }
  
  console.log('\n=====================================');
  console.log('✅ Test complete!\n');
  
  process.exit(successCount === results.length ? 0 : 1);
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
