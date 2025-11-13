/**
 * Query Interpreter
 * Parses user prompts into structured music search components
 * Identifies: GENRE, ARTIST, MOOD/VIBE, and PACE/BPM
 */

export interface ParsedQuery {
  rawPrompt: string;
  queryType: 'genre' | 'artist' | 'mood' | 'compound' | 'unknown';
  genres: string[];
  artists: string[];
  moods: string[];
  bpmRange?: { min: number; max: number };
  confidence: number;
  explanation?: string;
}

// List of all 191 genres from the database
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

// Mood/vibe keywords and their synonyms (21 mood types, 100+ keywords)
const MOOD_KEYWORDS = {
  // Energetic & High-Energy moods
  energetic: ['energetic', 'high energy', 'hyper', 'intense', 'powerful', 'aggressive', 'wild', 'explosive', 'driving'],
  upbeat: ['upbeat', 'happy', 'cheerful', 'positive', 'feel good', 'uplifting', 'bright', 'joyful', 'sunny'],
  hype: ['hype', 'hype up', 'pump up', 'workout', 'intense', 'adrenaline', 'rush', 'fired up'],
  motivating: ['motivating', 'motivational', 'inspiring', 'inspirational', 'empowering', 'uplifting energy'],
  
  // Calm & Relaxation moods
  chill: ['chill', 'chilled', 'relax', 'relaxing', 'calm', 'laid back', 'easy', 'smooth', 'easy going', 'unwinding'],
  ambient: ['ambient', 'atmospheric', 'dreamy', 'ethereal', 'spacey', 'meditative', 'tranquil', 'serene'],
  mellow: ['mellow', 'soft', 'gentle', 'soothing', 'warm', 'peaceful', 'tranquil', 'cozy'],
  peaceful: ['peaceful', 'peace', 'quiet', 'serene', 'harmonious', 'zen'],
  
  // Melancholic & Sad moods
  sad: ['sad', 'melancholic', 'melancholy', 'sorrowful', 'heartbreak', 'depressing', 'dark', 'blue', 'lonely'],
  moody: ['moody', 'gloomy', 'dark', 'brooding', 'introspective', 'contemplative', 'pensive', 'reflective'],
  nostalgic: ['nostalgic', 'retro', 'vintage', 'old school', 'throwback', 'memory', 'flashback', 'reminisce'],
  melancholic: ['melancholic', 'wistful', 'bittersweet', 'longing', 'yearning'],
  
  // Study/Focus moods
  focus: ['study', 'focus', 'concentration', 'productive', 'work', 'background music', 'working', 'homework'],
  lofi: ['lo-fi', 'lofi', 'study beats', 'chill beats', 'coffee shop', 'late night'],
  
  // Dark & Intense moods
  dark: ['dark', 'heavy', 'ominous', 'sinister', 'eerie', 'haunting', 'ominous', 'spooky', 'scary'],
  aggressive: ['aggressive', 'angry', 'rage', 'fierce', 'brutal', 'violent', 'harsh'],
  
  // Vibe-specific moods
  groovy: ['groovy', 'funky', 'groovy vibe', 'swing', 'bounce', 'rhythm', 'groove'],
  romantic: ['romantic', 'love', 'romantic vibe', 'intimate', 'sensual', 'passionate'],
  party: ['party', 'party vibe', 'club', 'dance floor', 'celebration', 'festival'],
  cinematic: ['cinematic', 'epic', 'dramatic', 'movie', 'soundtrack', 'grand', 'orchestral'],
};

// BPM keywords and their ranges
const BPM_KEYWORDS = {
  slow: { min: 60, max: 90 },
  'slow pace': { min: 60, max: 90 },
  medium: { min: 90, max: 130 },
  'medium pace': { min: 90, max: 130 },
  fast: { min: 130, max: 180 },
  'fast pace': { min: 130, max: 180 },
  'fast paced': { min: 130, max: 180 },
  dnb: { min: 160, max: 200 },
  drum: { min: 160, max: 200 }, // drum and bass
};

/**
 * Check if a word/phrase is an artist name in the database
 * (simple heuristic: uppercase or proper noun)
 */
function couldBeArtist(word: string): boolean {
  // Known artist indicators
  if (word.length < 2) return false;
  
  // Very common words that are not artists
  const commonWords = ['the', 'and', 'or', 'by', 'with', 'from', 'to', 'for', 'a', 'an'];
  if (commonWords.includes(word.toLowerCase())) return false;
  
  // Proper noun heuristic: starts with capital letter
  if (word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase()) {
    return true;
  }
  
  return false;
}

/**
 * Parse user prompt into structured query components
 */
export function parseQuery(prompt: string): ParsedQuery {
  const rawPrompt = prompt.trim();
  const lowerPrompt = rawPrompt.toLowerCase();
  const words = rawPrompt.split(/\s+/);
  
  const result: ParsedQuery = {
    rawPrompt,
    queryType: 'unknown',
    genres: [],
    artists: [],
    moods: [],
    confidence: 0,
  };
  
  // 1. Extract genres
  const genreRegex = new RegExp(`\\b(${ALL_GENRES.map(g => g.toLowerCase()).join('|')})\\b`, 'gi');
  const genreMatches = lowerPrompt.match(genreRegex);
  if (genreMatches) {
    result.genres = [...new Set(genreMatches.map(g => 
      ALL_GENRES.find(ag => ag.toLowerCase() === g.toLowerCase()) || g
    ))];
  }
  
  // 2. Extract moods
  for (const [mood, keywords] of Object.entries(MOOD_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerPrompt.includes(keyword)) {
        if (!result.moods.includes(mood)) {
          result.moods.push(mood);
        }
      }
    }
  }
  
  // 3. Extract BPM/pace
  for (const [bpmKeyword, range] of Object.entries(BPM_KEYWORDS)) {
    if (lowerPrompt.includes(bpmKeyword)) {
      result.bpmRange = range;
      break; // Use first match
    }
  }
  
  // 4. Look for artist names (capitalized words not already matched)
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (couldBeArtist(word)) {
      // Check if it's not a genre or mood
      const isGenre = ALL_GENRES.some(g => g.toLowerCase() === word.toLowerCase());
      const isMoodWord = Object.values(MOOD_KEYWORDS).some(keywords =>
        keywords.some(k => k.toLowerCase() === word.toLowerCase())
      );
      
      if (!isGenre && !isMoodWord && word.length > 2) {
        result.artists.push(word);
      }
    }
  }
  
  // 5. Determine query type based on what was found
  if (result.genres.length > 0 && result.artists.length === 0 && result.moods.length === 0) {
    result.queryType = 'genre';
    result.confidence = 0.95;
    result.explanation = `Genre-based query: ${result.genres.join(', ')}`;
  } else if (result.artists.length > 0 && result.genres.length === 0 && result.moods.length === 0) {
    result.queryType = 'artist';
    result.confidence = 0.85;
    result.explanation = `Artist-based query: ${result.artists.join(', ')}`;
  } else if (result.moods.length > 0 && result.genres.length === 0 && result.artists.length === 0) {
    result.queryType = 'mood';
    result.confidence = 0.80;
    result.explanation = `Mood-based query: ${result.moods.join(', ')}`;
  } else if (result.genres.length > 0 || result.artists.length > 0 || result.moods.length > 0) {
    result.queryType = 'compound';
    result.confidence = 0.75;
    const parts = [];
    if (result.genres.length > 0) parts.push(`genres: ${result.genres.join(', ')}`);
    if (result.artists.length > 0) parts.push(`artists: ${result.artists.join(', ')}`);
    if (result.moods.length > 0) parts.push(`moods: ${result.moods.join(', ')}`);
    result.explanation = `Compound query (${parts.join(', ')})`;
  }
  
  return result;
}

/**
 * Get related genres for a given mood (for fallback matching)
 */
export function moodToGenres(mood: string): string[] {
  const moodGenreMap: Record<string, string[]> = {
    // Energetic & High-Energy
    energetic: ['trap', 'drum and bass', 'hardcore', 'house', 'dubstep', 'hardstyle'],
    upbeat: ['pop', 'dance', 'synthwave', 'future bass', 'indie pop'],
    hype: ['trap', 'drum and bass', 'dubstep', 'hardcore', 'house', 'hardstyle', 'grime'],
    motivating: ['hip-hop', 'rap', 'pop', 'rock', 'synthwave', 'trap'],
    
    // Calm & Relaxation
    chill: ['lo-fi', 'chillwave', 'ambient', 'downtempo', 'indie', 'soul'],
    ambient: ['ambient', 'dark ambient', 'drone', 'post-rock', 'experimental', 'ambient electronic'],
    mellow: ['soul', 'jazz', 'lo-fi', 'indie', 'acoustic', 'smooth jazz'],
    peaceful: ['ambient', 'classical', 'minimalist', 'post-rock', 'new age'],
    
    // Melancholic & Sad
    sad: ['dark ambient', 'lo-fi', 'downtempo', 'post-rock', 'indie'],
    moody: ['dark ambient', 'post-punk', 'indie', 'experimental', 'slowcore'],
    nostalgic: ['synthwave', 'vaporwave', 'lo-fi', 'chillwave', 'lo-fi hip-hop'],
    melancholic: ['indie', 'post-rock', 'slowcore', 'singer-songwriter'],
    
    // Study/Focus
    focus: ['lo-fi', 'ambient', 'electronic', 'classical', 'minimalist', 'post-rock'],
    lofi: ['lo-fi', 'chillwave', 'ambient', 'downtempo', 'lo-fi hip-hop'],
    
    // Dark & Intense
    dark: ['dark ambient', 'industrial', 'experimental', 'post-punk', 'noise', 'metal'],
    aggressive: ['metal', 'hardcore', 'punk', 'drum and bass', 'dubstep', 'industrial'],
    
    // Vibe-specific
    groovy: ['funk', 'soul', 'disco', 'house', 'r&b', 'hi-hop'],
    romantic: ['soul', 'jazz', 'r&b', 'indie', 'singer-songwriter', 'synthwave'],
    party: ['house', 'dance', 'disco', 'electronic', 'hip-hop', 'reggaeton', 'dancehall'],
    cinematic: ['orchestral', 'post-rock', 'modern classical', 'soundtrack', 'progressive rock'],
  };
  
  return moodGenreMap[mood] || [];
}
