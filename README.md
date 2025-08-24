# MediaSite - Complete Media Platform

A full-stack media platform built with Next.js, PostgreSQL, and Cloudinary.

## 🚀 Features

- **User Authentication** - Secure login/signup with NextAuth.js
- **Media Upload** - Upload videos and images to Cloudinary
- **Database** - PostgreSQL with Prisma ORM
- **Real-time Player** - Video/image player with simplified scrolling
- **Responsive Design** - Mobile-first design with Tailwind CSS

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL database
- Cloudinary account
- npm or yarn

## 🛠️ Installation

### 1. Clone and Install Dependencies
```bash
git clone <repository-url>
cd mediasite
npm install
```

### 2. Environment Setup
```bash
# Copy environment template
cp env.example .env.local

# Edit .env.local with your credentials
```

### 3. Database Setup
```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# (Optional) Create migration
npm run db:migrate
```

### 4. Environment Variables
Create `.env.local` with:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/mediasite"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

# Cloudinary
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
```

### 5. Start Development Server
```bash
npm run dev
```

## 🗄️ Database Schema

The application uses PostgreSQL with the following main entities:

- **Users** - Authentication and profiles
- **Media** - Videos and images with metadata
- **Playlists** - User-created collections
- **Likes/Comments** - User engagement
- **Subscriptions** - User following system
- **Watch History** - User viewing tracking

## 🔐 Authentication

- NextAuth.js with JWT strategy
- Password hashing with bcryptjs
- Protected API routes
- Session management

## ☁️ Media Storage

- Cloudinary integration for video/image uploads
- Automatic thumbnail generation
- Optimized delivery with CDN
- Support for multiple formats

## 📁 Project Structure

```
mediasite/
├── app/
│   ├── api/           # API routes
│   ├── components/    # React components
│   └── auth/         # Authentication pages
├── lib/
│   ├── database.ts   # Prisma client
│   ├── auth.ts       # NextAuth configuration
│   └── cloudinary.ts # Media upload utilities
├── prisma/
│   └── schema.prisma # Database schema
└── public/           # Static assets
```

## 🚀 API Endpoints

- `POST /api/auth/signup` - User registration
- `POST /api/media/upload` - Media upload
- `GET /api/media` - Fetch media with filters

## 🔧 Development

```bash
# Database operations
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema changes
npm run db:studio    # Open Prisma Studio

# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm run start        # Start production server
```

## 📝 Next Steps

1. **Set up PostgreSQL database**
2. **Create Cloudinary account**
3. **Configure environment variables**
4. **Run database migrations**
5. **Test authentication flow**
6. **Upload first media file**

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details
