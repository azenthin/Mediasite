# Music Search & Browse System

## Overview

This system provides intelligent music search and discovery with **built-in deduplication** to prevent seeing the same songs repeatedly.

## Key Features

### 🎯 **Smart Deduplication**
- **Session-based tracking** - Remembers songs you've seen (lasts 1-2 hours)
- **Weighted randomization** - Higher quality tracks appear more often, but still varied
- **Shuffle mode** - Get different results each time
- **Auto-exclusion** - Previously shown tracks are filtered out by default

### 🔍 **Powerful Search**
- Search by **title, artist, or album**
- Filter by **genre** and **mood**
- Combine multiple filters
- Pagination support
- High-quality results (canonicality scored)

### 🌐 **Browse/Discover**
- Explore music without specific search terms
- Weighted random sampling (better songs appear more often)
- Track viewing history per session
- Genre and mood filters
- Quality threshold filtering

## API Endpoints

### 1. Search: `/api/music/search`

**Query Parameters:**
- `q` - Search query (title, artist, album)
- `genre` - Filter by genre
- `mood` - Filter by mood
- `artist` - Filter by artist name
- `limit` - Results per page (default: 20, max: 100)
- `offset` - Pagination offset
- `shuffle` - Enable randomization (`true`/`false`)
- `excludeRecent` - Exclude recently shown tracks (default: `true`)
- `sessionId` - Session identifier (auto-generated)

**Example:**
```javascript
// Search for rock songs
GET /api/music/search?q=rock&limit=20&sessionId=session_xyz&shuffle=true

// Search for specific artist
GET /api/music/search?artist=Travis%20Scott&limit=10&sessionId=session_xyz

// Search with genre filter
GET /api/music/search?q=love&genre=pop&limit=30&sessionId=session_xyz
```

**Response:**
```json
{
  "tracks": [
    {
      "id": "track_123",
      "title": "Song Title",
      "artist": "Artist Name",
      "album": "Album Name",
      "duration": 240,
      "genre": "pop",
      "mood": "happy",
      "canonicalityScore": 0.85,
      "spotify": {
        "id": "spotify_id",
        "url": "https://open.spotify.com/track/..."
      },
      "isrc": "USUM12345678",
      "mbid": "musicbrainz_id"
    }
  ],
  "pagination": {
    "total": 1500,
    "offset": 0,
    "limit": 20,
    "hasMore": true
  },
  "session": {
    "id": "session_xyz",
    "excludedCount": 45
  }
}
```

### 2. Browse: `/api/music/browse`

**Query Parameters:**
- `genre` - Filter by genre
- `mood` - Filter by mood
- `minScore` - Minimum canonicality score (default: 0.7)
- `limit` - Results per request (default: 20, max: 50)
- `excludeViewed` - Exclude previously viewed tracks (default: `true`)
- `sessionId` - Session identifier

**Example:**
```javascript
// Discover pop music
GET /api/music/browse?genre=pop&limit=20&sessionId=session_xyz

// High-quality tracks only
GET /api/music/browse?minScore=0.85&limit=15&sessionId=session_xyz

// Browse by mood
GET /api/music/browse?mood=energetic&limit=25&sessionId=session_xyz
```

**Response:** Same format as search endpoint

## React Hook Usage

### `useMusicSearch()`

```typescript
import { useMusicSearch } from '@/lib/hooks/use-music-search';

function MyComponent() {
  const { search, browse, resetSession, sessionId, loading, error } = useMusicSearch();

  // Search for songs
  const handleSearch = async () => {
    const result = await search({
      q: 'love songs',
      genre: 'pop',
      limit: 20,
      shuffle: true,
      excludeRecent: true,
    });
    
    if (result) {
      console.log('Found tracks:', result.tracks);
      console.log('Excluded count:', result.session.excludedCount);
    }
  };

  // Browse/discover
  const handleBrowse = async () => {
    const result = await browse({
      genre: 'rock',
      minScore: 0.75,
      limit: 30,
    });
    
    if (result) {
      console.log('Discovered tracks:', result.tracks);
      console.log('Viewed so far:', result.session.viewedCount);
    }
  };

  // Reset session (start fresh)
  const handleReset = () => {
    resetSession();
  };

  return (
    <div>
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      <button onClick={handleSearch}>Search</button>
      <button onClick={handleBrowse}>Browse</button>
      <button onClick={handleReset}>Reset Session</button>
    </div>
  );
}
```

## How Deduplication Works

### Session Tracking
1. **Auto-generated session ID** - Created when user first visits
2. **Stored in sessionStorage** - Persists across page refreshes
3. **Server-side cache** - Tracks shown/viewed songs per session
4. **Auto-expiry** - Sessions expire after 1-2 hours of inactivity

### Search Deduplication
- Excludes tracks shown in **previous search results**
- Works across different search queries in same session
- Can be disabled with `excludeRecent=false`

### Browse Deduplication
- Tracks all **viewed/browsed** tracks
- Longer session duration (2 hours)
- Perfect for discovery/exploration

### Randomization Strategies

**Shuffle Mode (Search):**
- Fetches 3x requested amount
- Randomly shuffles results
- Returns requested limit
- Different results each time

**Weighted Random (Browse):**
- Higher canonicality score = higher probability
- Uses squared weight: `(score * 100)²`
- Ensures quality while maintaining variety
- Random offset for starting position

## Database Schema

Queries use the `VerifiedTrack` table:

```prisma
model VerifiedTrack {
  id           String   @id @default(cuid())
  internalUuid String   @unique @default(uuid())
  title        String
  artist       String
  album        String?
  isrc         String?  @unique
  mbid         String?  @unique
  spotifyId    String?  @unique
  durationMs   Int?     // milliseconds
  releaseDate  DateTime?
  verifiedAt   DateTime @default(now())
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  
  identifiers  TrackIdentifier[]
}
```

**Note:** Genre, mood, and canonicality scoring are planned for future implementation. Current ordering uses `verifiedAt` and simple shuffle for variety.

## Performance Considerations

### Memory Usage
- Session cache is in-memory (server RAM)
- Auto-cleanup every 5-10 minutes
- Each session: ~few KB per 1000 tracked songs

### Scaling
- **Single server**: Handles thousands of concurrent sessions
- **Multi-server**: Need Redis/shared cache for session sync
- **High traffic**: Consider moving to database-backed session tracking

## Migration Guide

### From Old Search API

**Before:**
```javascript
fetch('/api/search?q=rock&limit=20')
```

**After:**
```javascript
fetch('/api/music/search?q=rock&limit=20&sessionId=session_xyz&shuffle=true')
```

### Key Differences
1. **Add sessionId** - Enable deduplication
2. **Use shuffle=true** - Get varied results
3. **Higher quality** - Only verified tracks with canonicality scores
4. **Better filtering** - Genre, mood, artist filters
5. **No duplicates** - Automatically excluded in same session

## Troubleshooting

### "Same songs appearing repeatedly"
- Ensure `sessionId` is included in requests
- Check `excludeRecent=true` (default)
- Try `shuffle=true` for more variation
- Call `resetSession()` to start fresh

### "Too few results"
- Lower `minScore` threshold (browse)
- Disable `excludeRecent` temporarily
- Increase `limit` parameter
- Broaden search query or remove filters

### "Session not persisting"
- Check sessionStorage is enabled
- Verify not in incognito/private mode
- Check session hasn't expired (1-2 hours)

## Future Enhancements

- [ ] Collaborative filtering (user preferences)
- [ ] Time-decay weighting (recent plays less likely)
- [ ] Cross-session recommendations
- [ ] Playlist-based discovery
- [ ] Audio feature similarity matching
- [ ] Persistent user history (database)

## License

Part of the Mediasite project.
