# MediaSite Deployment to Vercel

## 🚀 Quick Deployment Steps

### Option 1: GitHub Integration (Recommended)
1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial MediaSite commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/mediasite.git
   git push -u origin main
   ```

2. **Connect to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will auto-detect Next.js

### Option 2: Vercel CLI
1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Login and Deploy**:
   ```bash
   vercel login
   vercel --prod
   ```

## 🔧 Environment Variables Setup

In Vercel Dashboard > Project > Settings > Environment Variables, add:

```
NEXTAUTH_SECRET=your-super-long-random-secret-here
NEXTAUTH_URL=https://your-app-name.vercel.app
DATABASE_URL=your-database-connection-string
CLOUDINARY_CLOUD_NAME=your-cloudinary-name
CLOUDINARY_API_KEY=your-cloudinary-key
CLOUDINARY_API_SECRET=your-cloudinary-secret
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM=noreply@yourdomain.com
ADMIN_EMAIL=admin@yourdomain.com
```

## 📦 Database Options

### Option A: Vercel Postgres (Recommended)
1. In Vercel Dashboard > Storage > Create Database
2. Choose "Postgres"
3. Copy the DATABASE_URL to environment variables

### Option B: External Database
- Use Railway, PlanetScale, or Supabase
- Copy connection string to DATABASE_URL

## 🎯 Pre-deployment Checklist

- ✅ Environment variables configured
- ✅ Database ready
- ✅ Next.js config updated for production
- ✅ Vercel.json configuration added
- ✅ Dependencies in package.json

## 🔄 After Deployment

1. **Run database migrations**:
   ```bash
   npx prisma db push
   ```

2. **Seed the database** (optional):
   ```bash
   npm run db:seed
   ```

3. **Test the deployment** at your Vercel URL
