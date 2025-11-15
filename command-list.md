# MediaSite Command List

## 🚀 Most Used Commands

**Start Server**
```bash
npm run dev
```

**Run Tests**
```bash
npm test
```

**Run Tests Once**
```bash
npm run test:ci
```

**Check Test Coverage**
```bash
npm run test:coverage
```

**Kill All Servers**
```bash
taskkill /f /im node.exe
```

**Kill Only Prisma Studio (Port 5555)**
```bash
# Find the PID
netstat -ano | findstr ":5555"
# Kill that PID
taskkill /f /pid XXXX
```

**Check Ports**
```bash
netstat -ano | findstr ":300"
```

---

## 🛠️ Database Commands

**Generate Client**
```bash
npm run db:generate
```

**Migrate Local SQLite to Vercel Postgres**
```bash
# Get your Postgres URL from Vercel dashboard: Settings > Storage > your-db > .env.local tab
# Copy the POSTGRES_URL value
POSTGRES_URL="postgresql://user:pass@host/db" node scripts/migrate-to-postgres.js

# Example:
# POSTGRES_URL="postgresql://default:xxx@ep-xxx.us-east-1.aws.neon.tech/verceldb" node scripts/migrate-to-postgres.js
```

**Push Changes**
```bash
npm run db:push
```

**Open Database UI**
```bash
npm run db:studio
```

**Create Migration**
```bash
npm run db:migrate
```

**Seed Data**
```bash
npm run db:seed
```

**Import Music (Turbo Mode)**
```bash
# Test with sample (100 tracks)
node scripts/turbo-upsert.js scripts/ingest/sample-100-tracks.json

# Full import (280k tracks)
node scripts/turbo-upsert.js scripts/ingest/staging-results-500k.json
```

**Fetch Music from Spotify**
```bash
# Mega fetch: 1000 songs × 6,238 genres = up to 6M songs
node scripts/fetch-mega-1000-per-genre.js

# Check progress
cat scripts/ingest/checkpoint-mega.json
```

---

## 📦 Package Management

**Install All**
```bash
npm install
```

**Add Package**
```bash
npm install package-name
```

**Add Dev Package**
```bash
npm install --save-dev package-name
```

---

## 🔧 Build & Deploy

**Build for Production**
```bash
npm run build
```

**Start Production**
```bash
npm run start
```

**Check Code**
```bash
npm run lint
```

---

## 🐛 Debugging

**List Node Processes**
```bash
tasklist | findstr node
```

**Kill by PID**
```bash
taskkill /f /pid XXXX
```

**Check All Ports**
```bash
netstat -ano
```

---

## 🔄 Quick Fixes

**Clear Cache**
```bash
rm -rf .next
npm run dev
```

**Reset Database**
```bash
npm run db:push --force-reset
```

**Reinstall Dependencies**
```bash
rm -rf node_modules
npm install
```

---

## 📁 File Commands

**List Files**
```bash
dir
```

**Change Directory**
```bash
cd folder-name
```

**Go Back**
```bash
cd ..
```

---

## 💡 Pro Tips

1. Use `taskkill /f /im node.exe` when multiple servers running
2. Check ports with `netstat -ano | findstr ":300"` before starting
3. Use `npm run db:studio` to view database
4. Keep this file open for quick reference
5. Use `npm run dev` for development

---

## 🚨 Emergency Commands

**Restart Everything**
```bash
taskkill /f /im node.exe
npm install
npm run dev
```

**Complete Reset**
```bash
taskkill /f /im node.exe
rm -rf node_modules .next
npm install
npm run dev
``` 