# Database Ingestion & Production Debug Log

## Issue Summary
Production AI playlists not showing Spotify icons/links (showing AI fallback instead), while localhost works perfectly with full database integration.

---

## Session Timeline

### Phase 1: Initial Investigation
**Problem**: Vercel production showing plain text playlists instead of Spotify-integrated results
**Root Cause #1**: Vercel Postgres database was completely empty (0 tracks)
**Solution**: Migrate 334,643 tracks from local SQLite to Vercel Postgres

### Phase 2: Database Migration
**Created**: `scripts/migrate-to-postgres.js`
- Initial version: 2 tracks/sec (would take 54 hours)
- **Optimized**: Bulk INSERT with 2000 tracks/batch → 630 tracks/sec
- **Duration**: ~9 minutes total
- **Result**: ✅ 334,643 tracks migrated successfully

**Issue**: Only 3,572 of 639,000 identifiers transferred
**Created**: `scripts/fix-identifiers.js`
- Deduplication logic: Map by `${trackId}:${type}` key
- **Result**: ✅ 608,238 unique identifiers migrated

### Phase 3: Prisma Schema Provider Mismatch
**Problem**: Production still broken despite data being present
**Created**: `app/api/debug-db/route.ts` to diagnose
**Root Cause #2**: Prisma Client generated with `provider = "sqlite"` but production DATABASE_URL is Postgres
**Error**: `"the URL must start with the protocol 'file:'"`
**Solution**: Changed `prisma/schema.prisma` from `provider = "sqlite"` to `provider = "postgresql"`
- Ran `npx prisma generate` locally
- Committed and pushed (commit: dba874f)

### Phase 4: Build Failures
**Problem**: Next.js trying to statically generate `/api/debug-db` at build time
**Error**: "Static page generation timeout after 3 attempts"
**Solution**: Added `export const dynamic = 'force-dynamic'` to prevent static generation
- Commit: c018180

**Problem**: Import error - `'@/lib/database' has no default export`
**Solution**: Changed from `import prisma from` to `import { prisma } from`
- Commit: 91b5f13

### Phase 5: PostgreSQL Case-Sensitivity Issue
**Problem**: User confirmed DATABASE_URL was set, but still no results
**Root Cause #3**: PostgreSQL `contains` filter is case-sensitive (unlike SQLite)
- Prompt: "pop" (lowercase)
- Database: "Pop", "POP", etc. (mixed case)
**Solution**: Added `mode: 'insensitive'` to all Prisma query filters
```typescript
{ primaryGenre: { contains: promptLower, mode: 'insensitive' } }
```
- Commit: 26b5be1

### Phase 6: Query Performance & Timeout Issues (CURRENT)
**Problem**: "Failed to connect to AI service" - request timing out completely
**Console Error**: `AI request timed out — retrying with faster model`
**Console Error**: `AbortError: signal is aborted without reason`

**Hypothesis**: Database query with `mode: 'insensitive'` may be slow on 334k+ rows without proper indexes

**Actions Taken** (Commit: 5c6f58a):
1. Added 5-second timeout wrapper on database query to prevent hanging
2. Enhanced console.log statements throughout `queryVerifiedTracks`:
   - Start time tracking
   - Query duration measurement
   - Track count logging
3. Better error logging in catch blocks
4. Added console logging in AI playlist route to track flow

**Next Steps**:
- Wait for deployment to complete
- Check Vercel function logs for console output
- Verify `/api/debug-db` endpoint accessibility
- Identify if query is timing out or returning 0 results
- May need to add database indexes or optimize query structure

---

## Database Stats
- **Source (SQLite)**: 334,643 tracks, 639,000 identifiers
- **Target (Postgres)**: 334,643 tracks, 608,238 unique identifiers
- **Deduplication**: Removed 30,762 duplicate identifier records
- **Migration Speed**: 630 tracks/sec with bulk inserts

## Connection Details
- **Vercel Postgres URL**: `postgres://...@db.prisma.io:5432/?sslmode=require`
- **Environment Variable**: DATABASE_URL (confirmed set in Vercel dashboard)
- **Prisma Schema Provider**: postgresql (fixed from sqlite)
- **Prisma Client Version**: v5.22.0

## Key Files Modified
- `prisma/schema.prisma` - Changed provider to postgresql
- `lib/music-search.ts` - Added case-insensitive mode + timeout + logging
- `app/api/ai/playlist/route.ts` - Enhanced error logging
- `app/api/debug-db/route.ts` - Diagnostic endpoint with detailed logging
- `scripts/migrate-to-postgres.js` - Bulk migration script
- `scripts/fix-identifiers.js` - Identifier deduplication script

## Current Status
❌ **CRITICAL ISSUE IDENTIFIED**: Prisma queries failing silently in production
🔍 **Evidence**: `searchLocalDatabase()` is being called (sqlite3 error), meaning `queryVerifiedTracks()` returned empty array
📊 **DATABASE_URL**: Confirmed set and correct (postgres://...@db.prisma.io:5432)
🎯 **Root Cause**: Prisma client connecting but queries failing without logging errors

### Latest Findings (Phase 7)
- ✅ DATABASE_URL environment variable is set correctly in Vercel
- ✅ Prisma client is being created with PostgreSQL URL at build time
- ✅ Build completes successfully with no errors
- ❌ Runtime: NO logging from `queryVerifiedTracks()` appears
- ❌ Runtime: Falls back to `searchLocalDatabase()` immediately
- ❌ sqlite3 CLI not available on Vercel (expected)
- ❌ AI generates fallback playlist because no database results

**Next Action**: Add connection test and error boundary at Prisma query level
