# Testing Guide: AI Playlist Song Storage

This guide will help you verify that the song storage fix is working correctly.

## Quick Verification Steps

### Step 1: Generate a Playlist
1. Navigate to `http://localhost:3000/ai` (AI Playlist Generator page)
2. Make sure you're **logged in** (top right corner shows your profile)
3. Type a prompt like: "Chill study music"
4. Press Enter or click the search button
5. Wait for the AI to generate a playlist
6. You should see a list of songs with Spotify/YouTube icons

### Step 2: Check Server Logs
1. Look at your terminal where `npm run dev` is running
2. Search for one of these messages:
   - ✅ `Saved AI playlist to database` → Success!
   - ❌ `Failed to save AI playlist to database` → Failure (now visible in logs)

If you see neither message, it might mean:
- User is not authenticated (`userId` is null)
- Playlist generation failed before reaching save

### Step 3: Query the Database
```bash
# Connect to your database (adjust connection string as needed)
psql postgresql://postgres:postgres@localhost:5432/mediasite

# Check if playlists were saved
SELECT id, "userId", name, "createdAt" FROM "AIPlaylist" 
ORDER BY "createdAt" DESC LIMIT 5;

# Check the songs JSON
SELECT id, songs FROM "AIPlaylist" 
WHERE "userId" = '<your-user-id>' LIMIT 1;

# Parse and view the songs
SELECT 
  id, 
  name,
  CAST(songs AS jsonb) as parsed_songs
FROM "AIPlaylist"
WHERE "userId" = '<your-user-id>'
LIMIT 1;
```

### Step 4: Check Retrieval API
```bash
# Make sure you're logged in first, then:
curl -X GET "http://localhost:3000/api/ai-playlists?page=1&limit=10" \
  -H "Cookie: <your-auth-cookie>"

# You should see your generated playlists in the response
```

## Detailed Test Scenarios

### Scenario 1: Authenticated User Creates Playlist
**Expected Behavior**: Playlist is saved to database and appears in user's history

**Test Steps**:
1. Sign in to the application
2. Go to `/ai` page
3. Generate playlist with prompt "Best of 2024"
4. Check logs for `Saved AI playlist to database`
5. Query database: should see 1 new row in `AIPlaylist` table
6. Visit `/ai-playlists` or profile to verify playlist appears

**Success Criteria**:
- ✅ Playlist appears on screen
- ✅ Log message shows successful save
- ✅ Database query returns the playlist
- ✅ Can retrieve playlist via `GET /api/ai-playlists`

### Scenario 2: Unauthenticated User Attempts Save
**Expected Behavior**: Playlist is shown but not saved (no `userId`)

**Test Steps**:
1. Sign out of the application
2. Go to `/ai` page (should redirect to login)
3. Try to generate a playlist without signing in
4. Check logs - should see something related to authentication

**Success Criteria**:
- App requires login before accessing `/ai`

### Scenario 3: Database Connection Failure
**Expected Behavior**: Error is logged visibly

**Test Steps**:
1. Stop your database (e.g., `sudo systemctl stop postgresql`)
2. Generate a playlist while logged in
3. Check server logs - should see `Failed to save AI playlist to database` with ERROR level
4. Restart database

**Success Criteria**:
- ✅ Error appears in logs with ERROR level (not WARN)
- ✅ Error message includes Prisma error details

### Scenario 4: Multiple Playlist Types
The `/api/ai/playlist` route saves playlists from 4 sources. Verify all work:

**Test 4a: Audio Features Match**
```bash
# Generate playlist with prompt matching your audio library
# Example: if you have metal tracks stored
curl -X POST http://localhost:3000/api/ai/playlist \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"prompt": "metal music", "conversationHistory": []}'

# Should save via audio feature matching path
```

**Test 4b: Spotify Recommendations**
```bash
# Generate playlist with common music prompt
curl -X POST http://localhost:3000/api/ai/playlist \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"prompt": "jazz for coding", "conversationHistory": []}'

# Should save via Spotify recommendations path
```

**Test 4c: AI Generation**
```bash
# Generate playlist with unique/specific prompt
curl -X POST http://localhost:3000/api/ai/playlist \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"prompt": "music for midnight bonfires", "conversationHistory": []}'

# Should save via AI generation path
```

For each test, verify:
- ✅ Correct log message appears (e.g., "Saved audio feature playlist to database")
- ✅ Playlist appears in database query
- ✅ Can retrieve via `GET /api/ai-playlists`

## Monitoring & Troubleshooting

### If Playlists Don't Appear in Database

**Check 1: Authentication**
```typescript
// Look in server logs for:
// "session retrieved: true User ID: <id>"  ✅ Good
// "session retrieved: false User ID: undefined"  ❌ Bad
```

**Check 2: Database Connection**
```bash
# Test Prisma connection
npx prisma studio

# Should open interactive database browser
```

**Check 3: Error Logs**
```bash
# Search logs for ERROR level messages
grep "ERROR" <your-log-file>
grep "Failed to save" <your-log-file>
```

**Check 4: Verify Table Exists**
```bash
# Connect to database
psql postgresql://postgres:postgres@localhost:5432/mediasite

# List tables
\dt

# Check AIPlaylist table schema
\d "AIPlaylist"

# Should show: id, name, prompt, songs, createdAt, userId
```

### If You See "Failed to save" Errors

**Common Issues**:

1. **Foreign Key Constraint**: User ID doesn't exist in User table
   ```bash
   SELECT id FROM "User" WHERE id = '<your-user-id>';
   ```

2. **Invalid JSON**: `songs` field contains invalid JSON
   ```bash
   # Try to parse the songs field
   SELECT songs FROM "AIPlaylist" LIMIT 1;
   # Should be valid JSON like: [{"title":"...","artist":"..."}]
   ```

3. **Column Mismatch**: Schema changed but migration wasn't run
   ```bash
   npm run db:push  # Apply pending schema changes
   ```

## Performance Testing

### Test Load on AI Playlist Generation

```bash
# Generate 10 playlists in sequence
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/ai/playlist \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <token>" \
    -d "{\"prompt\": \"playlist number $i\", \"conversationHistory\": []}"
  sleep 2  # Wait 2 seconds between requests
done

# Verify all 10 appear in database
SELECT COUNT(*) FROM "AIPlaylist" WHERE "userId" = '<your-user-id>';
# Should return 10 (or more if you had existing playlists)
```

## Debugging with Console Logs

If you need deeper insight, add temporary logging to `/app/api/ai/playlist/route.ts`:

```typescript
// After getting the session
const session = await safeAuth();
const userId = session?.user?.id;
console.log('🔍 DEBUG: session=%O, userId=%s', session, userId);

// Before saving
if (userId && verifiedSongs.length > 0) {
  console.log('💾 Attempting to save:', {
    userId,
    songCount: verifiedSongs.length,
    playlistName,
    firstSong: verifiedSongs[0],
  });
  
  try {
    // ... save attempt
  } catch (dbError) {
    console.log('❌ Save failed:', {
      error: dbError.message,
      code: dbError.code,
    });
  }
}
```

## Expected Outcomes After Fix

### Before Fix ❌
- Generate playlist → appears on screen
- Check database → NO RECORD
- Check logs → no save-related messages or only WARN level

### After Fix ✅
- Generate playlist → appears on screen
- Check database → RECORD EXISTS with songs JSON
- Check logs → "Saved AI playlist to database" (INFO level)
- If save fails → "Failed to save AI playlist to database" (ERROR level)

## Rollback Plan

If you need to revert the fix:

```bash
git diff app/api/ai/playlist/route.ts
git checkout app/api/ai/playlist/route.ts
```

Changes made:
1. Upgraded `logger.warn()` to `logger.error()` in 4 catch blocks
2. Simplified error object passing to logger (removed `.message` property extraction)

## Next Session Checklist

- [ ] Verify authentication is returning valid `userId`
- [ ] Check database connection status
- [ ] Run at least 3 playlists through and confirm database saves
- [ ] Set up log aggregation to monitor for "Failed to save" errors
- [ ] Consider making authentication mandatory for playlist saving
- [ ] Set up monitoring alerts for ERROR-level logs
