// Simplified query interpreter in plain JS for testing

const ALL_GENRES = [
  'IDM', 'PC music', 'acoustic', 'african', 'afrobeat', 'alt country', 'alternative',
  'alternative rock', 'ambient', 'ambient electronic', 'americana', 'art pop', 'art rock',
  'asian', 'asian folk', 'avant-garde', 'avant-garde jazz', 'baroque', 'baroque pop',
  'bebop', 'black metal', 'bluegrass', 'blues', 'boom-bap', 'bossa nova', 'breakcore',
  'brostep', 'celtic', 'chamber pop', 'chillwave', 'chiptune', 'chopped and screwed',
  'classical', 'cloud', 'cloud rap', 'coffeehouse', 'coldwave', 'conscious rap',
  'cool jazz', 'country', 'country pop', 'country rock', 'cumbia', 'dance', 'dance-punk',
  'dancehall', 'dark ambient', 'dark electronic', 'darkwave', 'death metal', 'deathcore',
  'deep electronic', 'deep house', 'deep soul', 'disco', 'drone', 'drum and bass', 'dub',
  'dub reggae', 'dubstep', 'electro', 'electroacoustic', 'electronic', 'emo', 'ethnic',
  'experimental', 'experimental rock', 'folk', 'folktronic', 'folktronica', 'free jazz',
  'funk', 'future bass', 'futurepop', 'futurism', 'gabber', 'gangsta rap', 'garage punk',
  'garage rock', 'glam rock', 'glitch', 'glitch pop', 'global', 'grime', 'grunge',
  'hard rock', 'hardcore', 'hardcore punk', 'hardstyle', 'heavy metal', 'hip-hop', 'honky tonk',
  'horrorcore', 'house', 'hyperpop', 'indian', 'indian classical', 'indie rock', 'industrial',
  'irish folk', 'jazz', 'jazz fusion', 'jungle', 'kosmische', 'krautrock', 'latin',
  'liquid', 'liquid drum and bass', 'liquid funk', 'lo-fi', 'mashup', 'math rock',
  'metalcore', 'microtonal', 'middle eastern', 'middle eastern music', 'minimalist', 'modal jazz',
  'modern classical', 'motorik', 'motown', 'mumble rap', 'musique concrète', 'neo-soul',
  'neurofunk', 'new wave', 'noise', 'noise rock', 'northern soul', 'nu-jazz', 'opera',
  'orchestral', 'outlaw country', 'phonk', 'plunderphonics', 'pop', 'post-minimalism',
  'post-punk', 'post-rock', 'power electronics', 'power metal', 'power pop', 'progressive metal',
  'progressive rock', 'psychedelic rock', 'punk', 'r&b', 'ragga', 'rap', 'reggae',
  'reggaeton', 'riddim', 'rock', 'romantic', 'roots reggae', 'samba', 'scottish', 'screamo',
  'sea shanty', 'serialism', 'shoegaze', 'singer-songwriter', 'ska', 'slowcore', 'smooth jazz',
  'soul', 'soundtrack', 'spectralism', 'spoken word', 'surf rock', 'synth-pop', 'synthwave',
  'techno', 'thrash metal', 'traditional folk', 'trance', 'trap', 'tribal', 'twee',
  'two-tone', 'uk garage', 'vapor', 'vaporwave', 'vgm', 'video game music', 'wall of sound',
  'western swing', 'witch house', 'wonky', 'world', 'world fusion',
];

const MOOD_KEYWORDS = {
  energetic: ['energetic', 'high energy', 'hyper', 'intense', 'powerful', 'aggressive'],
  upbeat: ['upbeat', 'happy', 'cheerful', 'positive', 'feel good', 'bright'],
  hype: ['hype', 'pump up', 'workout'],
  chill: ['chill', 'relax', 'calm', 'laid back', 'smooth'],
  ambient: ['ambient', 'atmospheric', 'dreamy', 'spacey', 'meditative'],
  sad: ['sad', 'melancholic', 'sorrowful', 'heartbreak'],
  dark: ['dark', 'heavy', 'ominous', 'sinister'],
  focus: ['study', 'focus', 'concentration'],
};

function parseQuery(prompt) {
  const lowerPrompt = prompt.toLowerCase();
  const words = prompt.split(/\s+/);
  
  const result = {
    rawPrompt: prompt,
    queryType: 'unknown',
    genres: [],
    artists: [],
    moods: [],
    confidence: 0,
  };
  
  // Extract genres
  for (const genre of ALL_GENRES) {
    if (lowerPrompt.includes(genre.toLowerCase())) {
      result.genres.push(genre);
    }
  }
  
  // Extract moods
  for (const [mood, keywords] of Object.entries(MOOD_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerPrompt.includes(keyword)) {
        if (!result.moods.includes(mood)) result.moods.push(mood);
      }
    }
  }
  
  // Extract artists (capitalized words)
  for (const word of words) {
    if (word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase()) {
      const isGenre = ALL_GENRES.some(g => g.toLowerCase() === word.toLowerCase());
      const isMood = Object.values(MOOD_KEYWORDS).some(keywords =>
        keywords.some(k => k.toLowerCase() === word.toLowerCase())
      );
      if (!isGenre && !isMood && word.length > 2) {
        result.artists.push(word);
      }
    }
  }
  
  // Determine query type
  if (result.genres.length > 0 && !result.artists.length && !result.moods.length) {
    result.queryType = 'genre';
    result.confidence = 0.95;
  } else if (result.artists.length > 0 && !result.genres.length && !result.moods.length) {
    result.queryType = 'artist';
    result.confidence = 0.85;
  } else if (result.moods.length > 0 && !result.genres.length && !result.artists.length) {
    result.queryType = 'mood';
    result.confidence = 0.80;
  } else if (result.genres.length || result.artists.length || result.moods.length) {
    result.queryType = 'compound';
    result.confidence = 0.75;
  }
  
  return result;
}

// Test cases
const testCases = [
  "phonk",
  "phonk sad slow pace",
  "sad rain vibes",
  "workout hype",
  "gaming vibe trap",
  "chill study music",
  "pop",
];

console.log("Query Interpreter Test Results\n" + "=".repeat(70));

for (const prompt of testCases) {
  const result = parseQuery(prompt);
  console.log(`\n📝 Prompt: "${prompt}"`);
  console.log(`   Type: ${result.queryType.toUpperCase()} (confidence: ${(result.confidence * 100).toFixed(0)}%)`);
  if (result.genres.length) console.log(`   Genres: ${result.genres.join(', ')}`);
  if (result.artists.length) console.log(`   Artists: ${result.artists.join(', ')}`);
  if (result.moods.length) console.log(`   Moods: ${result.moods.join(', ')}`);
}
