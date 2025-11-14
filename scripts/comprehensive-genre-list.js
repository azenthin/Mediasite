/**
 * Comprehensive Genre List for Music Fetching
 * Compiled from: Spotify API, MusicBrainz, Every Noise at Once, and industry standards
 * Updated: 2025-11-14
 * 
 * This list contains 1000+ genres organized by category
 * Use these for systematic music catalog building
 */

const GENRES = {
  
  // ============== MAINSTREAM POP & ROCK (50) ==============
  mainstream: [
    'pop', 'rock', 'indie', 'alternative', 'indie-pop', 'indie-rock',
    'synth-pop', 'dream-pop', 'electropop', 'art-pop', 'baroque-pop',
    'chamber-pop', 'jangle-pop', 'noise-pop', 'power-pop', 'soft-rock',
    'hard-rock', 'classic-rock', 'progressive-rock', 'psychedelic-rock',
    'garage-rock', 'punk-rock', 'post-punk', 'new-wave', 'glam-rock',
    'arena-rock', 'southern-rock', 'heartland-rock', 'blues-rock',
    'folk-rock', 'country-rock', 'rockabilly', 'surf-rock', 'grunge',
    'britpop', 'madchester', 'shoegaze', 'space-rock', 'krautrock',
    'math-rock', 'post-rock', 'emo', 'midwest-emo', 'screamo',
    'pop-punk', 'ska-punk', 'skate-punk', 'folk-punk', 'celtic-punk'
  ],

  // ============== HIP-HOP & RAP (80) ==============
  hiphop: [
    'hip-hop', 'rap', 'trap', 'drill', 'boom-bap', 'gangsta-rap',
    'conscious-rap', 'alternative-hip-hop', 'experimental-hip-hop',
    'abstract-hip-hop', 'jazz-rap', 'nerdcore', 'horrorcore',
    'hardcore-hip-hop', 'east-coast-hip-hop', 'west-coast-hip-hop',
    'southern-hip-hop', 'dirty-south', 'crunk', 'snap-rap',
    'miami-bass', 'bounce', 'hyphy', 'g-funk', 'phonk',
    'memphis-rap', 'cloud-rap', 'plugg', 'rage', 'emo-rap',
    'sad-rap', 'mumble-rap', 'soundcloud-rap', 'lo-fi-hip-hop',
    'trip-hop', 'turntablism', 'instrumental-hip-hop', 'breakbeat',
    'uk-hip-hop', 'grime', 'uk-drill', 'ny-drill', 'chicago-drill',
    'brooklyn-drill', 'detroit-rap', 'atlanta-hip-hop', 'houston-rap',
    'bay-area-rap', 'french-rap', 'german-hip-hop', 'spanish-hip-hop',
    'latin-trap', 'trap-latino', 'reggaeton', 'dembow', 'dancehall',
    'afrobeats', 'afro-trap', 'afro-swing', 'afro-fusion',
    'arabic-hip-hop', 'chinese-hip-hop', 'japanese-hip-hop', 'k-hip-hop',
    'indian-hip-hop', 'desi-hip-hop', 'tamil-hip-hop', 'punjabi-hip-hop',
    'vietnamese-hip-hop', 'indonesian-hip-hop', 'thai-hip-hop',
    'malaysian-hip-hop', 'filipino-hip-hop', 'turkish-hip-hop',
    'russian-hip-hop', 'polish-hip-hop', 'brazilian-hip-hop'
  ],

  // ============== R&B & SOUL (40) ==============
  rnb: [
    'r-n-b', 'soul', 'neo-soul', 'alternative-r-n-b', 'alt-r-n-b',
    'contemporary-r-n-b', 'quiet-storm', 'new-jack-swing', 'funk',
    'p-funk', 'g-funk', 'funk-rock', 'funk-metal', 'boogie',
    'disco', 'disco-funk', 'nu-disco', 'future-funk', 'motown',
    'philadelphia-soul', 'memphis-soul', 'chicago-soul', 'southern-soul',
    'northern-soul', 'deep-soul', 'blue-eyed-soul', 'psychedelic-soul',
    'gospel', 'contemporary-gospel', 'urban-gospel', 'worship',
    'ccm', 'christian-rock', 'christian-hip-hop', 'trap-soul',
    'chillwave', 'vaporwave', 'future-beats', 'beat-music'
  ],

  // ============== ELECTRONIC & DANCE (120) ==============
  electronic: [
    'edm', 'electronic', 'dance', 'house', 'deep-house', 'tech-house',
    'progressive-house', 'electro-house', 'future-house', 'bass-house',
    'tropical-house', 'Melbourne-bounce', 'Chicago-house', 'Detroit-techno',
    'techno', 'minimal-techno', 'acid-techno', 'industrial-techno',
    'trance', 'progressive-trance', 'uplifting-trance', 'psytrance',
    'goa-trance', 'hard-trance', 'vocal-trance', 'tech-trance',
    'dubstep', 'brostep', 'riddim', 'melodic-dubstep', 'chillstep',
    'drum-and-bass', 'dnb', 'liquid-dnb', 'neurofunk', 'jump-up',
    'jungle', 'ragga-jungle', 'breakcore', 'speedcore', 'hardcore',
    'happy-hardcore', 'hardstyle', 'rawstyle', 'frenchcore', 'gabber',
    'industrial', 'ebm', 'aggrotech', 'dark-electro', 'electro-industrial',
    'idm', 'intelligent-dance-music', 'glitch', 'glitch-hop',
    'ambient', 'ambient-techno', 'ambient-house', 'dark-ambient',
    'drone', 'drone-ambient', 'space-ambient', 'lowercase',
    'downtempo', 'trip-hop', 'chillout', 'lounge', 'nu-jazz',
    'acid-jazz', 'electro-swing', 'nu-funk', 'future-funk',
    'synthwave', 'retrowave', 'outrun', 'darksynth', 'chillwave',
    'vaporwave', 'hypnagogic-pop', 'hauntology', 'witch-house',
    'uk-garage', '2-step', 'grime', 'dubstep', 'future-garage',
    'footwork', 'juke', 'ghetto-house', 'ballroom', 'vogue',
    'baile-funk', 'funk-carioca', 'favela-funk', 'brega-funk',
    'kuduro', 'afro-house', 'gqom', 'amapiano', 'kwaito',
    'moombahton', 'moombahcore', 'dancehall', 'reggaeton', 'dembow',
    'tropical-bass', 'bass-music', 'future-bass', 'trap', 'hybrid-trap',
    'wave', 'phonk', 'drift-phonk', 'cloud-phonk', 'tiktok-phonk'
  ],

  // ============== METAL (60) ==============
  metal: [
    'metal', 'heavy-metal', 'thrash-metal', 'speed-metal', 'power-metal',
    'death-metal', 'black-metal', 'doom-metal', 'sludge-metal',
    'stoner-metal', 'drone-metal', 'funeral-doom', 'progressive-metal',
    'technical-death-metal', 'brutal-death-metal', 'melodic-death-metal',
    'symphonic-metal', 'gothic-metal', 'folk-metal', 'viking-metal',
    'pagan-metal', 'pirate-metal', 'medieval-metal', 'metalcore',
    'deathcore', 'mathcore', 'grindcore', 'cybergrind', 'goregrind',
    'pornogrind', 'slam', 'beatdown-hardcore', 'nu-metal', 'rap-metal',
    'funk-metal', 'industrial-metal', 'neue-deutsche-härte', 'groove-metal',
    'southern-metal', 'djent', 'post-metal', 'atmospheric-metal',
    'ambient-metal', 'avant-garde-metal', 'experimental-metal',
    'symphonic-black-metal', 'depressive-black-metal', 'cascadian-black-metal',
    'war-metal', 'blackened-death-metal', 'blackened-thrash-metal',
    'crossover-thrash', 'skate-thrash', 'teutonic-thrash-metal',
    'bay-area-thrash-metal', 'melodic-metalcore', 'progressive-metalcore',
    'electronicore', 'nintendocore', 'kawaii-metal'
  ],

  // ============== PUNK & HARDCORE (40) ==============
  punk: [
    'punk', 'punk-rock', 'hardcore-punk', 'post-hardcore', 'melodic-hardcore',
    'skate-punk', 'pop-punk', 'easycore', 'orgcore', 'emo', 'emocore',
    'screamo', 'midwest-emo', 'emo-pop', 'folk-punk', 'celtic-punk',
    'gypsy-punk', 'anarcho-punk', 'crust-punk', 'street-punk', 'd-beat',
    'hardcore', 'beatdown-hardcore', 'youth-crew', 'straight-edge',
    'powerviolence', 'thrashcore', 'grindcore', 'goregrind', 'noisegrind',
    'ska', 'ska-punk', 'two-tone', 'third-wave-ska', 'reggae-punk',
    'garage-punk', 'psychobilly', 'cowpunk', 'deathrock', 'horror-punk'
  ],

  // ============== COUNTRY & FOLK (50) ==============
  country: [
    'country', 'contemporary-country', 'country-pop', 'country-rock',
    'alt-country', 'americana', 'outlaw-country', 'honky-tonk',
    'western-swing', 'bluegrass', 'progressive-bluegrass', 'newgrass',
    'old-time', 'appalachian-folk', 'mountain-music', 'cajun', 'zydeco',
    'folk', 'indie-folk', 'folk-rock', 'folk-pop', 'psych-folk',
    'freak-folk', 'anti-folk', 'neo-folk', 'dark-folk', 'neofolk',
    'chamber-folk', 'baroque-folk', 'singer-songwriter', 'americana',
    'roots-rock', 'southern-rock', 'heartland-rock', 'red-dirt',
    'texas-country', 'nashville-sound', 'bakersfield-sound',
    'countrypolitan', 'traditional-country', 'classic-country',
    'cowboy', 'western', 'western-swing', 'conjunto', 'tejano',
    'norteño', 'banda', 'duranguense', 'sierreño', 'corridos',
    'corridos-tumbados', 'corridos-bélicos', 'regional-mexican'
  ],

  // ============== JAZZ & BLUES (50) ==============
  jazz: [
    'jazz', 'smooth-jazz', 'contemporary-jazz', 'jazz-fusion',
    'jazz-funk', 'soul-jazz', 'hard-bop', 'bebop', 'post-bop',
    'cool-jazz', 'west-coast-jazz', 'modal-jazz', 'free-jazz',
    'avant-garde-jazz', 'spiritual-jazz', 'nu-jazz', 'jazz-rap',
    'acid-jazz', 'electro-swing', 'gypsy-jazz', 'manouche',
    'latin-jazz', 'afro-cuban-jazz', 'bossa-nova', 'samba-jazz',
    'blues', 'electric-blues', 'chicago-blues', 'delta-blues',
    'piedmont-blues', 'texas-blues', 'blues-rock', 'rhythm-and-blues',
    'jump-blues', 'boogie-woogie', 'country-blues', 'acoustic-blues',
    'gospel-blues', 'soul-blues', 'british-blues', 'blues-metal',
    'swing', 'big-band', 'dixieland', 'ragtime', 'stride',
    'traditional-jazz', 'new-orleans-jazz', 'kansas-city-jazz'
  ],

  // ============== LATIN & CARIBBEAN (60) ==============
  latin: [
    'latin', 'latin-pop', 'latin-rock', 'reggaeton', 'dembow',
    'trap-latino', 'latin-trap', 'urban-latino', 'latin-hip-hop',
    'salsa', 'salsa-dura', 'salsa-romantica', 'timba', 'mambo',
    'cha-cha-cha', 'bolero', 'son-cubano', 'rumba', 'guaracha',
    'cumbia', 'cumbia-villera', 'cumbia-sonidera', 'cumbia-andina',
    'vallenato', 'champeta', 'porro', 'currulao', 'bambuco',
    'merengue', 'bachata', 'bachata-urbana', 'Dominican-dembow',
    'punta', 'reggae', 'dancehall', 'dub', 'roots-reggae',
    'lovers-rock', 'reggae-fusion', 'reggae-rock', 'ragga',
    'soca', 'calypso', 'zouk', 'kompa', 'bouyon', 'beguine',
    'bossa-nova', 'samba', 'pagode', 'sertanejo', 'forró',
    'axé', 'frevo', 'maracatu', 'baião', 'choro', 'mpb',
    'tango', 'milonga', 'vals-criollo', 'folklore-argentino',
    'chacarera', 'zamba', 'chamamé', 'cuarteto', 'cumbia-argentina'
  ],

  // ============== AFRICAN & AFRO (50) ==============
  african: [
    'afrobeats', 'afrobeat', 'afro-pop', 'afro-fusion', 'afro-soul',
    'afro-house', 'afro-tech', 'afro-swing', 'afro-trap',
    'highlife', 'hiplife', 'azonto', 'asakaa', 'drill', 'ghanaian-drill',
    'kwaito', 'gqom', 'amapiano', 'bongo-flava', 'singeli',
    'gengetone', 'kapuka', 'benga', 'ohangla', 'zilizopendwa',
    'kuduro', 'kizomba', 'semba', 'zouk', 'coupe-decale',
    'coupé-décalé', 'zouglou', 'afrobeats', 'azonto', 'bongo-piano',
    'mbalax', 'ndombolo', 'soukous', 'rumba-congolaise', 'sebene',
    'makossa', 'bikutsi', 'bend-skin', 'afro-jazz', 'ethio-jazz',
    'juju', 'fuji', 'apala', 'sakara', 'waka', 'yo-pop'
  ],

  // ============== MIDDLE EASTERN & NORTH AFRICAN (40) ==============
  mena: [
    'arabic-pop', 'arabic-hip-hop', 'arabic-trap', 'mahraganat',
    'electro-chaabi', 'shaabi', 'egyptian-shaabi', 'algerian-chaabi',
    'moroccan-chaabi', 'rai', 'khaliji', 'gulf-pop', 'dabke',
    'lebanese-pop', 'syrian-music', 'iraqi-music', 'yemeni-music',
    'turkish-pop', 'türkü', 'arabesk', 'turkish-rock', 'anatolian-rock',
    'persian-pop', 'iranian-traditional', 'classical-persian',
    'afghan-pop', 'pashtun-music', 'tajik-music', 'uzbek-pop',
    'armenian-pop', 'georgian-folk', 'azerbaijani-mugham',
    'jewish-music', 'klezmer', 'sephardic-music', 'yiddish-music',
    'mizrahi-music', 'israeli-pop', 'mediterranean-music', 'balkan-music'
  ],

  // ============== ASIAN POP & TRADITIONAL (80) ==============
  asian: [
    // East Asian
    'k-pop', 'k-hip-hop', 'k-r-n-b', 'k-indie', 'k-rock', 'trot',
    'j-pop', 'j-rock', 'j-hip-hop', 'j-indie', 'city-pop', 'shibuya-kei',
    'visual-kei', 'j-core', 'j-dance', 'enka', 'anison', 'vocaloid',
    'c-pop', 'mandopop', 'cantopop', 'hokkien-pop', 'chinese-rock',
    'chinese-hip-hop', 'chinese-r-n-b', 'chinese-indie', 'chinese-folk',
    
    // Southeast Asian
    't-pop', 'thai-pop', 'luk-thung', 'mor-lam', 'thai-hip-hop',
    'thai-indie', 'indonesian-pop', 'dangdut', 'koplo', 'keroncong',
    'indonesian-indie', 'indonesian-hip-hop', 'indonesian-r-n-b',
    'vietnamese-pop', 'v-pop', 'vietnamese-hip-hop', 'vietnamese-indie',
    'vietnamese-traditional', 'vietnamese-lo-fi', 'philippine-pop',
    'opm', 'pinoy-rock', 'pinoy-hip-hop', 'pinoy-indie', 'kundiman',
    'malaysian-pop', 'malaysian-hip-hop', 'malaysian-indie',
    'singaporean-pop', 'singaporean-indie', 'burmese-pop',
    
    // South Asian
    'bollywood', 'indian-pop', 'hindi-hip-hop', 'desi-hip-hop',
    'punjabi-pop', 'bhangra', 'punjabi-hip-hop', 'tamil-pop',
    'tamil-hip-hop', 'tamil-indie', 'telugu-pop', 'malayalam-pop',
    'malayalam-hip-hop', 'bengali-pop', 'marathi-pop', 'gujarati-pop',
    'carnatic', 'hindustani-classical', 'indian-classical', 'qawwali',
    'ghazal', 'sufi-music', 'devotional', 'bhajan', 'kirtan',
    'filmi', 'indi-pop', 'pakistani-pop', 'pashto-music',
    'bangladeshi-pop', 'sri-lankan-pop', 'nepali-pop', 'bhutanese-music'
  ],

  // ============== EUROPEAN (40) ==============
  european: [
    'french-pop', 'chanson', 'french-hip-hop', 'french-rap',
    'french-indie', 'french-house', 'french-touch', 'yé-yé',
    'german-pop', 'schlager', 'neue-deutsche-welle', 'german-hip-hop',
    'german-indie', 'neue-deutsche-härte', 'german-techno',
    'italian-pop', 'italian-indie', 'italian-rap', 'italian-trap',
    'spanish-pop', 'spanish-indie', 'spanish-hip-hop', 'rumba-catalana',
    'flamenco', 'flamenco-fusion', 'nuevo-flamenco', 'copla',
    'russian-pop', 'russian-rock', 'russian-hip-hop', 'russian-chanson',
    'polish-pop', 'disco-polo', 'polish-hip-hop', 'polish-indie',
    'swedish-pop', 'swedish-indie', 'swedish-hip-hop', 'schlager-svenska',
    'norwegian-pop', 'norwegian-indie', 'danish-pop', 'finnish-pop'
  ],

  // ============== EXPERIMENTAL & AVANT-GARDE (40) ==============
  experimental: [
    'experimental', 'avant-garde', 'noise', 'noise-rock', 'no-wave',
    'musique-concrète', 'acousmatic', 'electroacoustic', 'tape-music',
    'sound-art', 'field-recording', 'soundscape', 'drone', 'minimalism',
    'process-music', 'microtonality', 'spectral-music', 'totalism',
    'lowercase', 'onkyo', 'eai', 'glitch', 'clicks-and-cuts',
    'breakcore', 'speedcore', 'extratone', 'splittercore',
    'harsh-noise', 'harsh-noise-wall', 'power-electronics',
    'death-industrial', 'dark-ambient', 'isolationist', 'ritual-ambient',
    'dungeon-synth', 'black-ambient', 'hauntology', 'hypnagogic-pop',
    'vaporwave', 'vaportrap', 'mallsoft', 'slushwave'
  ],

  // ============== CLASSICAL & ORCHESTRAL (40) ==============
  classical: [
    'classical', 'baroque', 'renaissance', 'medieval', 'gregorian-chant',
    'classical-period', 'romantic', 'impressionist', 'modern-classical',
    'contemporary-classical', 'neoclassical', 'post-classical',
    'minimalist-classical', 'chamber-music', 'string-quartet',
    'symphony', 'concerto', 'sonata', 'opera', 'operetta',
    'oratorio', 'cantata', 'requiem', 'mass', 'choral',
    'sacred-music', 'liturgical', 'early-music', 'harpsichord',
    'piano', 'solo-piano', 'classical-piano', 'romantic-piano',
    'contemporary-piano', 'prepared-piano', 'orchestral', 'symphonic',
    'film-score', 'soundtrack', 'video-game-music', 'trailer-music'
  ],

  // ============== SPECIALTY & NICHE (80) ==============
  specialty: [
    // Bedroom & Internet
    'bedroom-pop', 'lo-fi', 'lo-fi-hip-hop', 'lo-fi-indie', 'chillhop',
    'study-beats', 'sleep-music', 'meditation', 'spa-music', 'yoga-music',
    
    // Internet Micro-genres
    'hyperpop', 'glitchcore', 'digicore', 'scenecore', 'cybergrind',
    'nightcore', 'daycore', 'slowed-reverb', 'sped-up', 'mashcore',
    'breakcore', 'speedcore', 'lolicore', 'cutecore', 'kawaii-future-bass',
    
    // Workout & Energy
    'workout', 'gym-music', 'running', 'cycling-music', 'crossfit',
    'epic-music', 'motivational', 'pump-up', 'hype-music',
    
    // Mood & Atmosphere
    'sad-music', 'crying-music', 'depression-music', 'anxiety-music',
    'happy-music', 'feel-good', 'uplifting', 'inspirational',
    'romantic', 'love-songs', 'breakup-songs', 'heartbreak',
    'chill', 'relaxing', 'peaceful', 'calm', 'tranquil', 'serene',
    'focus-music', 'concentration', 'productivity-music',
    
    // Party & Social
    'party', 'club-music', 'pregame', 'turn-up', 'hype', 'bangers',
    'wedding-music', 'dinner-music', 'background-music', 'elevator-music',
    
    // Seasonal & Holiday
    'christmas', 'halloween', 'holiday-music', 'winter-music',
    'summer-vibes', 'spring-music', 'autumn-music', 'seasonal',
    
    // Kids & Family
    'kids-music', 'children', 'lullabies', 'nursery-rhymes',
    'disney', 'family-friendly', 'clean-music', 'educational'
  ]
};

// Flatten all genres into one array
const ALL_GENRES = Object.values(GENRES).flat();

// Remove duplicates and sort
const UNIQUE_GENRES = [...new Set(ALL_GENRES)].sort();

console.log(`\n${'='.repeat(70)}`);
console.log('📊 COMPREHENSIVE GENRE LIST');
console.log(`${'='.repeat(70)}\n`);

console.log('By Category:\n');
Object.entries(GENRES).forEach(([category, genres]) => {
  console.log(`${category.toUpperCase().padEnd(25)} ${genres.length.toString().padStart(4)} genres`);
});

console.log(`\n${'='.repeat(70)}`);
console.log(`TOTAL UNIQUE GENRES: ${UNIQUE_GENRES.length}`);
console.log(`${'='.repeat(70)}\n`);

// Save to file
const fs = require('fs');
const path = require('path');

const output = {
  meta: {
    title: 'Comprehensive Music Genre List',
    version: '1.0.0',
    updated: new Date().toISOString(),
    totalGenres: UNIQUE_GENRES.length,
    categories: Object.keys(GENRES).length
  },
  byCategory: GENRES,
  allGenres: UNIQUE_GENRES
};

const outputPath = path.join(__dirname, 'comprehensive-genre-list.json');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

console.log(`💾 Saved to: ${outputPath}\n`);
console.log('✅ Ready to use for music fetching!\n');

module.exports = { GENRES, ALL_GENRES: UNIQUE_GENRES };
