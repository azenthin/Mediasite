# Vercel Deployment Checklist

## Pre-Deployment Steps

### 1. Create Production Migration
Since your Vercel instance uses PostgreSQL (not SQLite), we need to generate a migration:

```bash
# Temporarily update schema.prisma datasource to postgresql
# Change: provider = "sqlite"
# To: provider = "postgresql"

npx prisma migrate dev --name add_verified_tracks_and_enrichment

# Then change back to sqlite for local dev
```

### 2. Verify Environment Variables in Vercel

Make sure these are set in your Vercel project settings:

**Database:**
- `DATABASE_URL` - Your PostgreSQL connection string (from Vercel Postgres)

**NextAuth:**
- `NEXTAUTH_URL` - Your production URL (e.g., https://your-app.vercel.app)
- `NEXTAUTH_SECRET` - A secure random string (generate with: `openssl rand -base64 32`)

**OAuth:**
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GITHUB_ID`
- `GITHUB_SECRET`

**Cloudinary:**
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

**Email (if using):**
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`

**AI Playlist:**
- `OPENAI_API_KEY`
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REDIRECT_URI` - Update to production URL
- `YOUTUBE_API_KEY`
- `GOOGLE_REDIRECT_URI` - Update to production URL
- `NEXT_PUBLIC_APP_URL` - Your production URL

**Production Flag:**
- `NODE_ENV=production`

### 3. Update OAuth Redirect URIs

Update your OAuth app settings to include production URLs:

**Google OAuth:**
- Add: `https://your-app.vercel.app/api/auth/callback/google`

**GitHub OAuth:**
- Add: `https://your-app.vercel.app/api/auth/callback/github`

**Spotify OAuth:**
- Add: `https://your-app.vercel.app/api/ai/auth/spotify`

**YouTube OAuth:**
- Add: `https://your-app.vercel.app/api/ai/auth/youtube`

### 4. Check Build Configuration

In `vercel.json`, verify:
- Build command is set
- Output directory is correct
- Environment variables are referenced
- Function timeouts are appropriate (especially for API routes)

## Deployment Commands

### Option 1: Push to Main Branch (Auto-Deploy)
```bash
git add .
git commit -m "feat: add verified tracks and music enrichment system"
git push origin main
```

### Option 2: Manual Vercel CLI Deploy
```bash
# Install Vercel CLI if not already
npm i -g vercel

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

## Post-Deployment Steps

### 1. Run Database Migration on Production

**Option A: Using Vercel CLI**
```bash
# Connect to your production database
vercel env pull .env.production

# Run migration
DATABASE_URL="your-production-postgres-url" npx prisma migrate deploy
```

**Option B: Using Vercel Dashboard**
- Go to your Vercel project
- Navigate to the Postgres database
- Run the migration SQL manually

### 2. Verify Deployment

Check these endpoints:
- `https://your-app.vercel.app` - Homepage loads
- `https://your-app.vercel.app/api/health` - Health check (if you have one)
- `https://your-app.vercel.app/auth/signin` - Auth pages work
- `https://your-app.vercel.app/browse` - Media browsing works
- `https://your-app.vercel.app/ai` - AI playlist generator works

### 3. Test New Features

- Music search functionality
- Genre filtering
- AI playlist generation with verified tracks
- Spotify/YouTube integration

## Rollback Plan

If something breaks:

```bash
# Rollback to previous deployment
vercel rollback

# Or revert the last commit
git revert HEAD
git push origin main
```

## Common Issues

### Issue: Database Connection Fails
**Fix:** Verify `DATABASE_URL` in Vercel environment variables

### Issue: OAuth Redirect Fails
**Fix:** Check redirect URIs in OAuth provider dashboards

### Issue: API Routes Timeout
**Fix:** Increase function timeout in `vercel.json`:
```json
{
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 60
    }
  }
}
```

### Issue: Missing Environment Variables
**Fix:** Check all required env vars are set in Vercel dashboard

### Issue: Build Fails
**Fix:** Check build logs in Vercel dashboard, likely missing dependencies or type errors

## Notes

- SQLite is used for local development
- PostgreSQL is used in production (via Vercel Postgres)
- The schema supports both via Prisma's provider switching
- Local database has 49k songs, production starts fresh (will populate via API)
- Music data is fetched from Spotify API on-demand, not seeded initially
