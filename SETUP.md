# MediaSite Setup Guide

## 🗄️ Database Setup

### 1. Install PostgreSQL
- Download from: https://www.postgresql.org/download/
- Create a database named `mediasite`

### 2. Environment Variables
Create `.env.local` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/mediasite"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

# Cloudinary (Optional for now)
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
```

### 3. Database Migration
```bash
npm run db:generate
npm run db:push
```

## 🚀 Quick Start

1. **Set up environment variables** (see above)
2. **Run database migration**:
   ```bash
   npm run db:generate
   npm run db:push
   ```
3. **Start the development server**:
   ```bash
   npm run dev
   ```
4. **Open http://localhost:3000**

## 🧪 Test the Features

### Authentication
- Click "Log In" in the navbar
- Create an account or sign in
- The system will use the database for user management

### Media Player
- Navigate to "Recommended" in the sidebar
- The player will fetch data from the database
- If no data exists, it will show fallback content

## 🔧 Current Status

✅ **Frontend**: Connected to backend APIs  
✅ **Authentication**: User signup/login working  
✅ **Media Player**: Fetches from database  
✅ **Database Schema**: Ready for use  
⚠️ **Database**: Needs to be set up (PostgreSQL)  
⚠️ **Environment**: Variables need to be configured  

## 📝 Next Steps

1. Set up PostgreSQL database
2. Configure environment variables
3. Run database migrations
4. Test user registration
5. Upload some test media

The application is ready to use once the database is configured! 