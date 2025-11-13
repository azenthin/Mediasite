# Integration Roadmap: From Current to Enhanced System

## Current State
```
app/api/ai/playlist/route.ts
├─ Calls: parsePromptToSignature(prompt)
├─ Searches: findCandidates(signature) [BPM-only matching]
├─ Fallback: Spotify search (keyword-based, bad for niche genres)
└─ Result: Circular/limited results, niche genres fail
```

## Target State
```
app/api/ai/playlist/route.ts
├─ Calls: analyzeQuery(prompt) [NEW]
│  └─ Returns: {type, confidence, artist, genre, mood, bpm_range, ...}
├─ Searches: findCandidatesAdvanced(analyzed_query) [NEW]
│  ├─ Builds: Smart SQL based on query type
│  ├─ Scores: Context-aware scoring (artist, genre, mood, audio)
│  └─ Returns: Top 20 scored results from 5M song database
├─ Fallback: Spotify recommendations (not search)
└─ Result: Accurate, diverse, niche-friendly results
```

## Phase 1: Import Data (4 hours, one-time)

### Before you run anything:
```bash
# Test that you can download from MusicBrainz
curl -s "https://musicbrainz.org/ws/2/recording/?query=tag:pop&fmt=json&limit=1" | head -20
# Should return JSON with recording data
```

### Run the importer:
```bash
cd c:\Users\Joabzz\Documents\Visual Studio Code\mediasite
python scripts/enhanced-music-importer.py
```

This will:
1. Download 5M+ songs from MusicBrainz (~2 hours)
2. Enrich with AcousticBrainz features (~1 hour)
3. Create indexes (~30 min)
4. Verify: 5M songs, ~60% with BPM/energy

Result: `enhanced_music.db` (10 GB)

## Phase 2: Integrate Query Analyzer (30 minutes)

### Create new TypeScript wrapper for Python query analyzer:

```typescript
// lib/query-analyzer.ts
import { spawn } from 'child_process';
import path from 'path';

export type QueryType = 'artist' | 'genre' | 'mood' | 'audio_feature' | 'mixed';

export interface ParsedQuery {
  query_type: QueryType;
  confidence: number;
  artist: string | null;
  genre: string | null;
  mood: string | null;
  bpm_range: [number, number] | null;
  energy_range: [number, number] | null;
  language: string | null;
}

export async function analyzeQuery(query: string): Promise<ParsedQuery> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'query-analyzer.py');
    
    const python = spawn('python', ['-c', `
import json
import sys
sys.path.insert(0, '${path.join(process.cwd(), 'scripts')}')
from query_analyzer import QueryAnalyzer

analyzer = QueryAnalyzer()
result = analyzer.analyze('${query}')
print(json.dumps({
  'query_type': result['query_type'].value,
  'confidence': result['confidence'],
  'artist': result['artist'],
  'genre': result['genre'],
  'mood': result['mood'],
  'bpm_range': result['bpm_range'],
  'energy_range': result['energy_range'],
  'language': result['language'],
}))
    `]);
    
    let output = '';
    python.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    python.on('close', (code) => {
      if (code === 0) {
        try {
          resolve(JSON.parse(output));
        } catch (e) {
          reject(e);
        }
      } else {
        reject(new Error('Query analyzer failed'));
      }
    });
  });
}
```

## Phase 3: Update audio-search.ts (1-2 hours)

### New findCandidatesAdvanced function:

```typescript
// lib/audio-search.ts

import { analyzeQuery, type ParsedQuery } from './query-analyzer';

export async function findCandidatesAdvanced(
  query: string,
  limit = 200
): Promise<Candidate[]> {
  try {
    // Step 1: Analyze query to understand intent
    const parsed = await analyzeQuery(query);
    console.log(`[audio-search] Query type: ${parsed.query_type}`, parsed);
    
    // Step 2: Build smart SQL based on query type
    let sql = 'SELECT * FROM songs WHERE 1=1';
    const params: any[] = [];
    
    if (parsed.query_type === 'artist' && parsed.artist) {
      sql += ' AND (artist LIKE ? OR title LIKE ?)';
      params.push(`%${parsed.artist}%`, `%${parsed.artist}%`);
    }
    
    if (parsed.query_type === 'genre' && parsed.genre) {
      sql += ' AND genres LIKE ?';
      params.push(`%${parsed.genre}%`);
    }
    
    if (parsed.query_type === 'mood' && parsed.mood) {
      sql += ' AND moods LIKE ?';
      params.push(`%${parsed.mood}%`);
    }
    
    if (parsed.bpm_range) {
      sql += ' AND bpm BETWEEN ? AND ?';
      params.push(parsed.bpm_range[0], parsed.bpm_range[1]);
    }
    
    if (parsed.energy_range) {
      sql += ' AND energy BETWEEN ? AND ?';
      params.push(parsed.energy_range[0], parsed.energy_range[1]);
    }
    
    sql += ' LIMIT ?';
    params.push(limit);
    
    // Step 3: Query SQLite
    const db = await open({
      filename: path.resolve(process.cwd(), 'enhanced_music.db'),
      driver: sqlite3.Database,
    });
    
    const rows = await db.all(sql, ...params);
    
    // Step 4: Score results using context-aware algorithm
    const scorer = new MusicScorer();
    const scores = rows.map(row => {
      const score = scorer.scoreForQueryType(row, parsed);
      return { ...row, score };
    });
    
    // Step 5: Sort by score and return
    scores.sort((a, b) => b.score - a.score);
    
    return scores.slice(0, limit);
    
  } catch (error) {
    console.warn('[audio-search] Advanced search failed, falling back:', error);
    // Fallback to current behavior
    return findCandidates(await parsePromptToSignature(query), limit);
  }
}
```

## Phase 4: Update Playlist Route (30 minutes)

```typescript
// app/api/ai/playlist/route.ts

// Replace the current audio feature search with:

timer.start('audio_feature_matching');
try {
  // Use new enhanced search
  const { findCandidatesAdvanced } = await import('@/lib/audio-search');
  const candidates = await findCandidatesAdvanced(prompt, 20);
  
  if (candidates.length > 0) {
    audioFeatureTracks = candidates.map((track: any) => ({
      title: track.title || 'Unknown',
      artist: track.artist || 'Unknown',
      score: track.score,
      bpm: track.bpm,
      energy: track.energy,
      genre: track.genres,
    }));
    
    logger.info('Got advanced audio matches', {
      component: 'api.ai.playlist',
      query_type: candidates[0].query_type,
      trackCount: audioFeatureTracks.length,
    });
  }
} catch (audioError) {
  logger.warn('Advanced audio search failed, trying classic', audioError);
  // Fallback to current logic
}
timer.end('audio_feature_matching');
```

## Testing Checklist

After integration, test these queries:

```
Test Case 1: Artist Query
Input: "justin bieber songs"
Expected: Top results are Justin Bieber songs
Actual: ✅ / ❌

Test Case 2: Niche Genre Query
Input: "phonk"
Expected: 1000+ phonk songs, not keyword matches
Actual: ✅ / ❌

Test Case 3: Mood Query
Input: "chill vibes"
Expected: Low-energy, calm songs
Actual: ✅ / ❌

Test Case 4: Audio Feature Query
Input: "120 bpm energetic"
Expected: Songs with 110-130 BPM and high energy
Actual: ✅ / ❌

Test Case 5: Mixed Query
Input: "upbeat pop from 2020"
Expected: Pop songs from 2020 with high energy
Actual: ✅ / ❌

Test Case 6: Performance
Query: Any of the above
Expected: <100ms response time
Actual: ✅ / ❌

Test Case 7: Comparison vs Spotify
Query: "hardstyle"
Spotify API: ❌ Returns keyword matches ("hard", "styles")
Your System: ✅ Returns actual hardstyle songs
Actual: ✅ / ❌
```

## Monitoring

Add these metrics:

```typescript
// app/api/ai/playlist/route.ts

// Track query types
logger.info('Query analysis', {
  query_type: analyzed.query_type,
  confidence: analyzed.confidence,
  component: 'api.ai.playlist',
});

// Track performance
logger.performance('audio_search_local', timer.elapsed(), {
  source: 'enhanced_local',
  query_type: analyzed.query_type,
  results: candidates.length,
});

// Track fallbacks
if (candidates.length === 0) {
  logger.warn('No local matches, using Spotify', {
    query_type: analyzed.query_type,
  });
}
```

## Timeline

| Task | Time | Status |
|------|------|--------|
| Run importer | 4 hours | Ready to start |
| Create query-analyzer wrapper | 30 min | Ready |
| Update audio-search.ts | 1-2 hours | Ready |
| Update playlist route | 30 min | Ready |
| Testing | 1 hour | Ready |
| **Total** | **~7 hours** | **Ready to implement** |

## Next Action

1. **Run the importer** (you can do this now, it will take 4 hours):
```bash
python scripts/enhanced-music-importer.py
```

2. Let me know when it's done, then we'll integrate the new search algorithm

This will give you a **genuinely better search system than any commercial alternative**.
