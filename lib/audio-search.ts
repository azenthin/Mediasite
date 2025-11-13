import { prisma } from './database';
import fetch from 'node-fetch';
import { parseQuery, moodToGenres } from './query-interpreter';

// Minimal types used by the playlist generator
export type TempoRange = { min: number; max: number };
export type SeedTrack = { title?: string; artist?: string; spotifyId?: string; youtubeUrl?: string };

export type TargetSignature = {
  tempo: TempoRange;
  keys?: string[];
  energy?: number; // 0-1
  danceability?: number; // 0-1
  mood?: string[];
  genres?: string[];
  instrumentation?: string[];
  seedTracks?: SeedTrack[];
  diversity?: { maxPerArtist?: number; maxSameGenrePercent?: number };
  confidence?: number;
};

export type Candidate = {
  id: string;
  filename?: string;
  title?: string;
  artist?: string;
  mbid?: string;
  isrc?: string;
  spotifyId?: string | null;
  youtubeUrl?: string | null;
  bpm?: number | null;
  energy?: number | null;
  danceability?: number | null;
  key?: string | null;
  genres?: string[] | null;
  tags?: string;
  score?: number;
  release_year?: number | null;
};

/**
 * Parse user prompt using Query Interpreter + convert to TargetSignature
 * This is the NEW primary method that uses intelligent query parsing
 */
export async function parsePromptWithInterpreter(prompt: string): Promise<TargetSignature> {
  try {
    // Parse user intent using Query Interpreter
    const parsed = parseQuery(prompt);
    console.log('[audio-search] Query Interpreter analysis:', {
      type: parsed.queryType,
      genres: parsed.genres,
      artists: parsed.artists,
      moods: parsed.moods,
      confidence: parsed.confidence,
    });

    // Map moods to genres for compound queries
    const moodGenres = parsed.moods.length > 0
      ? parsed.moods.flatMap(m => moodToGenres(m))
      : [];

    // Combine genres + mood-derived genres
    const allGenres = [...new Set([...parsed.genres, ...moodGenres])];

    // Map moods to tempo hints
    let tempoMin = 80;
    let tempoMax = 120;
    if (parsed.moods.includes('energetic') || parsed.moods.includes('hype') || parsed.moods.includes('aggressive')) {
      tempoMin = 120;
      tempoMax = 160;
    } else if (parsed.moods.includes('chill') || parsed.moods.includes('ambient') || parsed.moods.includes('lofi')) {
      tempoMin = 70;
      tempoMax = 100;
    }

    // Handle explicit BPM ranges
    if (parsed.bpmRange) {
      tempoMin = parsed.bpmRange.min;
      tempoMax = parsed.bpmRange.max;
    }

    return {
      tempo: { min: tempoMin, max: tempoMax },
      genres: allGenres.length > 0 ? allGenres : parsed.genres,
      mood: parsed.moods,
      energy: parsed.moods.includes('energetic') || parsed.moods.includes('aggressive') ? 0.7 : 0.5,
      danceability: parsed.moods.includes('party') || parsed.moods.includes('groovy') ? 0.7 : 0.4,
      diversity: { maxPerArtist: 2, maxSameGenrePercent: 0.6 },
      confidence: parsed.confidence,
    };
  } catch (err) {
    console.error('[audio-search] Query Interpreter failed, falling back to heuristics:', err);
    return parsePromptToSignature(prompt);
  }
}

// Simple prompt -> signature heuristics (falls back to LLM if OPENAI_API_KEY provided)
export async function parsePromptToSignature(prompt: string): Promise<TargetSignature> {
  const p = prompt.toLowerCase();
  // If user provided an explicit signature JSON we could parse it; for now map a few common genres
  if (process.env.OPENAI_API_KEY) {
    // Attempt to use OpenAI to create a structured signature
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Return a single JSON object with keys: tempo, keys, energy, danceability, mood, genres, instrumentation, seedTracks, diversity, confidence' },
            { role: 'user', content: `Create a playlist signature for: ${prompt}` },
          ],
          temperature: 0.3,
          max_tokens: 300,
        }),
      });
      const json = await res.json();
      const text = json?.choices?.[0]?.message?.content;
      if (text) {
        try {
          const parsed = JSON.parse(text);
          return parsed as TargetSignature;
        } catch (e) {
          // ignore and fall back to heuristic
        }
      }
    } catch (e) {
      // silent fallback
    }
  }

  // Heuristic mappings
  if (p.includes('phonk')) {
    return {
      tempo: { min: 130, max: 155 },
      keys: ['A', 'Am', 'C#'],
      energy: 0.6,
      danceability: 0.5,
      mood: ['moody', 'gritty', 'nostalgic'],
      genres: ['phonk', 'lo-fi hip-hop', 'trap'],
      instrumentation: ['synth', '808 bass', 'vocal chops', 'lo-fi drums'],
      diversity: { maxPerArtist: 2, maxSameGenrePercent: 0.5 },
      confidence: 0.9,
    };
  }

  if (p.includes('synthwave') || p.includes('retro') || p.includes('80s')) {
    return {
      tempo: { min: 90, max: 120 },
      keys: ['C', 'Am'],
      energy: 0.5,
      danceability: 0.4,
      mood: ['nostalgic', 'driving'],
      genres: ['synthwave', 'retrowave'],
      instrumentation: ['synth', 'drums', 'bass'],
      diversity: { maxPerArtist: 2, maxSameGenrePercent: 0.6 },
      confidence: 0.85,
    };
  }

  // default mellow signature
  return {
    tempo: { min: 80, max: 120 },
    energy: 0.5,
    danceability: 0.45,
    mood: ['chill'],
    genres: [],
    diversity: { maxPerArtist: 3, maxSameGenrePercent: 0.6 },
    confidence: 0.5,
  };
}

// Helper: build a vector literal for Postgres pgvector from a JS array
function vectorLiteral(vec: number[]): string {
  // pgvector accepts the '[v1,v2,...]'::vector notation
  const s = '[' + vec.map((v) => v.toFixed(6)).join(',') + ']';
  return `'${s}'::vector`;
}

// Resolve seed track embeddings (average) using stored audio_vectors table
async function resolveSeedEmbedding(seedTracks?: SeedTrack[]): Promise<number[] | null> {
  if (!seedTracks || seedTracks.length === 0) return null;
  const parts: number[][] = [];
  for (const seed of seedTracks) {
    // try to find a matching SongCache row by spotifyId or title+artist
    const where: any = {};
    if (seed.spotifyId) where.spotifyId = seed.spotifyId;
    else if (seed.title && seed.artist) {
      where.title = seed.title;
      where.artist = seed.artist;
    } else {
      continue;
    }
    const sc = await prisma.songCache.findFirst({ where });
    if (!sc) continue;
    // pull vector from audio_vectors
    try {
      // audio_vectors table holds (id, embedding vector)
      const res: any = await prisma.$queryRawUnsafe(`SELECT embedding FROM audio_vectors WHERE id='${sc.id}' LIMIT 1`);
      if (res && res[0] && res[0].embedding) {
        // embedding may come back as array or string; normalize
        const emb = res[0].embedding;
        if (Array.isArray(emb)) parts.push(emb.map((n: any) => Number(n)));
        else if (typeof emb === 'string') {
          // string like '[0.1,0.2]'
          const parsed = emb.replace(/[^0-9eE+\-.,]/g, '').split(',').map((x) => Number(x));
          parts.push(parsed);
        }
      }
    } catch (e) {
      // ignore failures; continue
    }
  }
  if (parts.length === 0) return null;
  const dim = parts[0].length;
  const avg = new Array(dim).fill(0);
  for (const p of parts) {
    for (let i = 0; i < dim; i++) avg[i] += p[i] / parts.length;
  }
  return avg;
}

/**
 * Build WHERE clauses for different query types
 */
interface QueryFilters {
  whereClauses: string[];
  orderBy: string;
  artistScore?: string; // For compound scoring
}

function buildQueryFilters(
  genres: string[],
  artists: string[],
  moods: string[],
  bpmMin: number,
  bpmMax: number
): QueryFilters {
  const whereClauses: string[] = [];
  let orderBy = 'ASC';
  let artistScore = '';

  // GENRE filtering
  if (genres && genres.length > 0) {
    // Match exact genre in JSON array format: ["genre"] or ["genre","other"]
    // Match as a complete word in JSON: either "genre" or ,"genre", or ["genre"]
    const genreConditions = genres.map(g => {
      const escaped = g.replace(/'/g, "''");
      // Match genre as a complete JSON array element (surrounded by ", [ or ,)
      return `(genres LIKE '[\"${escaped}\"]' OR genres LIKE '%, \"${escaped}\"%' OR genres LIKE '%\"${escaped}\",%')`;
    }).join(' OR ');
    whereClauses.push(`(${genreConditions})`);
  }

  // ARTIST filtering
  if (artists && artists.length > 0) {
    const artistConditions = artists.map(a => `artist LIKE '%${a.replace(/'/g, "''")}%'`).join(' OR ');
    whereClauses.push(`(${artistConditions})`);
    
    // Scoring bonus for artist matches
    const artistScores = artists.map(a => {
      return `CASE 
        WHEN artist = '${a.replace(/'/g, "''")}' THEN 1.0
        WHEN artist LIKE '${a.replace(/'/g, "''")}%' THEN 0.8
        WHEN artist LIKE '%${a.replace(/'/g, "''")}' THEN 0.8
        WHEN artist LIKE '%${a.replace(/'/g, "''")}%' THEN 0.6
        ELSE 0.0
      END`;
    }).join(' + ');
    artistScore = `(${artistScores}) as artist_match_score`;
  }

  // MOOD filtering (map moods to genres and search)
  if (moods && moods.length > 0) {
    const moodGenres = moods.flatMap(m => moodToGenres(m));
    if (moodGenres.length > 0) {
      // Match genre as a complete JSON array element
      const moodGenreConditions = moodGenres.map(g => {
        const escaped = g.replace(/'/g, "''");
        return `(genres LIKE '[\"${escaped}\"]' OR genres LIKE '%, \"${escaped}\"%' OR genres LIKE '%\"${escaped}\",%')`;
      }).join(' OR ');
      whereClauses.push(`(${moodGenreConditions})`);
    }
  }

  // BPM filtering
  if (bpmMin > 0 || bpmMax > 0) {
    if (bpmMin > 0 && bpmMax > 0) {
      whereClauses.push(`(bpm IS NULL OR (bpm BETWEEN ${bpmMin} AND ${bpmMax}))`);
    } else if (bpmMin > 0) {
      whereClauses.push(`(bpm IS NULL OR bpm >= ${bpmMin})`);
    }
  }

  return {
    whereClauses,
    orderBy,
    artistScore,
  };
}

// Main search: return candidate rows ordered by combined score
export async function findCandidates(signature: TargetSignature, limit = 200): Promise<Candidate[]> {
  // Try local SQLite DB first (seeded from MusicBrainz or local audio files)
  let rows: any[] = [];
  let queryVec: number[] | null = null;
  
  try {
    const sqlite3 = require('sqlite3').verbose();
    const { open } = require('sqlite');
    const path = require('path');
    
    const dbPath = path.resolve(process.cwd(), 'enhanced_music.db');
    console.log('[audio-search] Opening database at:', dbPath);
    
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    
    // Query by BPM range and order by how close to target
    const { min, max } = signature.tempo;
    const centerBpm = (min + max) / 2;
    
    console.log(`[audio-search] Querying songs with BPM between ${min}-${max}, genres:`, signature.genres);
    
    // Build query filters based on signature
    const filters = buildQueryFilters(
      signature.genres || [],
      [],  // No artist filtering via query (handled separately)
      signature.mood || [],
      min,
      max
    );

    // Build SQL WHERE clause from filters
    let whereClause = '';
    if (filters.whereClauses.length > 0) {
      whereClause = 'WHERE ' + filters.whereClauses.join(' AND ');
    } else {
      // Default: just require valid BPM or allow NULL
      whereClause = 'WHERE (bpm IS NULL OR bpm >= 0)';
    }

    const maxPerArtist = signature.diversity?.maxPerArtist || 2;
    
    // Fetch all matching songs and apply diversity in application code
    // Sort by artist first (for diversity), then by release year (newest first), then BPM distance
    // This gives freshness preference while maintaining diversity
    const query = `
      SELECT 
        id, mbid, title, artist, album, genres, bpm, key, energy, danceability, tags, moods,
        release_year,
        CASE WHEN bpm IS NOT NULL THEN ABS(bpm - ?) ELSE 999999 END as bpm_distance
      FROM songs
      ${whereClause}
      ORDER BY artist ASC, release_year DESC, bpm_distance ASC
      LIMIT 500
    `;

    console.log('[audio-search] Executing query with diversity & freshness (max', maxPerArtist, 'per artist)');
    
    const allRows = await db.all(query, [centerBpm]) || [];
    
    // Apply diversity filter in application code: max N per artist
    const artistCounts: Record<string, number> = {};
    const diverseRows: any[] = [];
    
    for (const row of allRows) {
      const artistCount = artistCounts[row.artist] || 0;
      if (artistCount < maxPerArtist) {
        diverseRows.push(row);
        artistCounts[row.artist] = artistCount + 1;
      }
      if (diverseRows.length >= limit) break;
    }
    
    const sqliteRows = diverseRows;
    
    await db.close();
    
    console.log(`[audio-search] SQLite query returned ${sqliteRows?.length || 0} candidates from local DB (with diversity)`);
    
    if (sqliteRows && sqliteRows.length > 0) {
      rows = sqliteRows.map((r: any, index: number) => {
        // Calculate freshness score (0-1, where 1 is newest)
        let freshnessScore = 0;
        if (r.release_year && r.release_year > 0) {
          // Songs from 1995+ get scored, anything before gets 0
          // 2025 = 1.0, 1995 = 0, linear interpolation
          freshnessScore = Math.max(0, Math.min(1.0, (r.release_year - 1995) / (2025 - 1995)));
        }
        
        // Score: freshness (70%) + position bonus (30%)
        // Position bonus: earlier in list = higher score (helps with diversity + BPM match)
        const positionBonus = Math.max(0, 1 - index / sqliteRows.length);
        const score = (freshnessScore * 0.7) + (positionBonus * 0.3);
        
        return {
          id: r.id || r.mbid,
          filename: r.title,
          title: r.title,
          artist: r.artist,
          mbid: r.mbid,
          isrc: null,
          bpm: r.bpm,
          key: r.key,
          energy: r.energy,
          danceability: r.danceability,
          genres: r.genres ? JSON.parse(r.genres) : [],
          tags: r.tags || r.moods,
          spotifyId: null,
          youtubeUrl: null,
          score: score,
          release_year: r.release_year,
        };
      });
    }
  } catch (sqliteError) {
    // SQLite DB doesn't exist or query failed - fall back to Postgres
    console.warn('[audio-search] Local DB query failed, will try Postgres:', sqliteError instanceof Error ? sqliteError.message : String(sqliteError));
  }
  
  // If SQLite didn't return results, try Postgres (production/remote DB)
  if (rows.length === 0) {
    // Attempt to compute a query embedding from seedTracks
    queryVec = await resolveSeedEmbedding(signature.seedTracks);

    // If OpenAI key is provided and no seed embedding, compute text embedding
    if (!queryVec && process.env.OPENAI_API_KEY) {
      try {
        const embRes = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: { 'content-type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
          body: JSON.stringify({ model: 'text-embedding-3-small', input: (signature.genres || []).join(' ') || 'playlist' }),
        });
        const j = await embRes.json();
        const data = j?.data?.[0]?.embedding;
        if (Array.isArray(data)) queryVec = data.map((n: any) => Number(n));
      } catch (e) {
        // ignore
      }
    }

    // If we have a query vector and audio_vectors table exists, use pgvector nearest neighbor
    if (queryVec) {
      const vecLit = vectorLiteral(queryVec);
      const sql = `SELECT af.id, af.filename, af.bpm, af.energy, af.danceability, sc.spotifyId, sc.youtubeUrl, av.embedding
                   FROM audio_features af
                   JOIN audio_vectors av ON af.id = av.id
                   LEFT JOIN "SongCache" sc ON sc.id = af.songCacheId
                   ORDER BY av.embedding <-> ${vecLit}
                   LIMIT ${limit}`;
      try {
        rows = await prisma.$queryRawUnsafe(sql) as any[];
      } catch (e) {
        // fallback: empty
        rows = [];
      }
    } else {
      // fallback: select by scalar filters (tempo range)
      try {
        rows = await prisma.$queryRawUnsafe(`SELECT af.id, af.filename, af.bpm, af.energy, af.danceability, sc.spotifyId, sc.youtubeUrl FROM audio_features af LEFT JOIN "SongCache" sc ON sc.id = af.songCacheId WHERE (af.bpm IS NULL OR (af.bpm BETWEEN ${signature.tempo.min} AND ${signature.tempo.max})) LIMIT ${limit}`) as any[];
      } catch (e) {
        rows = [];
      }
    }
  }

  // Score candidates with simple weighted metrics
  const candidates: Candidate[] = rows.map((r) => ({
    id: r.id,
    filename: r.filename,
    title: r.title,
    artist: r.artist,
    mbid: r.mbid,
    isrc: r.isrc,
    spotifyId: r.spotifyId ?? null,
    youtubeUrl: r.youtubeUrl ?? null,
    bpm: r.bpm ?? null,
    energy: r.energy ?? null,
    danceability: r.danceability ?? null,
    tags: r.tags,
    release_year: r.release_year,
  }));

  // Scoring weights - HEAVILY FAVOR 2015+!
  const w_fresh = 0.65; // 65% weight on release year freshness (BOOSTED!)
  const w_emb = 0.15;   // 15% embedding proximity (reduced)
  const w_tempo = 0.1;  // 10% tempo match (reduced)
  const w_energy = 0.05; // 5% energy match (reduced)
  const w_dance = 0.03;  // 3% danceability (reduced)
  const w_genre = 0.02;  // 2% genre match (reduced)
  const tempoCenter = (signature.tempo.min + signature.tempo.max) / 2;
  const tempoWidth = Math.max(1, (signature.tempo.max - signature.tempo.min));

  for (const c of candidates) {
    let score = 0;
    
    // FRESHNESS: HEAVILY PRIORITIZE 2015+ SONGS
    if (typeof c.release_year === 'number' && c.release_year > 0) {
      // Use 2015 as baseline - songs before 2015 get much lower scores
      let freshnessScore;
      if (c.release_year >= 2015) {
        // 2015+ songs: scale from 0.3 (2015) to 1.0 (2025+)
        freshnessScore = Math.min(1.0, 0.3 + ((c.release_year - 2015) / 10) * 0.7);
      } else {
        // Pre-2015 songs: quickly drop to near 0
        freshnessScore = Math.max(0, ((c.release_year - 1995) / (2015 - 1995)) * 0.3);
      }
      score += w_fresh * freshnessScore;
    }
    
    // embedding contribution is implicit in ordering when queryVec present; give a base
    if (queryVec) score += w_emb * 0.9; // base for embedding proximity
    
    // tempo similarity
    if (c.bpm) {
      const diff = Math.abs((c.bpm as number) - tempoCenter);
      const tempoSim = 1 - Math.min(1, diff / (tempoWidth / 2 + 1));
      score += w_tempo * tempoSim;
    }
    
    // energy
    if (typeof c.energy === 'number' && typeof signature.energy === 'number') {
      score += w_energy * (1 - Math.abs((c.energy as number) - (signature.energy as number)));
    }
    
    // danceability
    if (typeof c.danceability === 'number' && typeof signature.danceability === 'number') {
      score += w_dance * (1 - Math.abs((c.danceability as number) - (signature.danceability as number)));
    }
    
    c.score = score;
  }

  // Sort by score (and preserve embedding order if present)
  candidates.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return candidates;
}
