import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Only allow setup in development or with a secret key
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    
    if (process.env.NODE_ENV === 'production' && secret !== process.env.SEED_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 Setting up database tables...');
    
    // Create all the necessary tables using raw SQL
    const createTablesSQL = `
      -- Create User table
      CREATE TABLE IF NOT EXISTS "User" (
        "id" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "username" TEXT NOT NULL,
        "password" TEXT NOT NULL,
        "displayName" TEXT,
        "avatarUrl" TEXT,
        "emailVerified" BOOLEAN NOT NULL DEFAULT false,
        "emailVerificationToken" TEXT,
        "emailVerificationExpires" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "User_pkey" PRIMARY KEY ("id")
      );

      -- Create Media table
      CREATE TABLE IF NOT EXISTS "Media" (
        "id" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "url" TEXT NOT NULL,
        "thumbnailUrl" TEXT,
        "type" TEXT NOT NULL,
        "category" TEXT,
        "tags" TEXT NOT NULL,
        "duration" INTEGER,
        "isPublic" BOOLEAN NOT NULL DEFAULT true,
        "views" INTEGER NOT NULL DEFAULT 0,
        "likes" INTEGER NOT NULL DEFAULT 0,
        "groupId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        "uploaderId" TEXT NOT NULL,
        CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
      );

      -- Create Subscription table
      CREATE TABLE IF NOT EXISTS "Subscription" (
        "id" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "subscriberId" TEXT NOT NULL,
        "subscribedToId" TEXT NOT NULL,
        CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
      );

      -- Create Like table
      CREATE TABLE IF NOT EXISTS "Like" (
        "id" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "userId" TEXT NOT NULL,
        "mediaId" TEXT NOT NULL,
        CONSTRAINT "Like_pkey" PRIMARY KEY ("id")
      );

      -- Create Comment table
      CREATE TABLE IF NOT EXISTS "Comment" (
        "id" TEXT NOT NULL,
        "content" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        "userId" TEXT NOT NULL,
        "mediaId" TEXT NOT NULL,
        CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");
      CREATE INDEX IF NOT EXISTS "User_username_idx" ON "User"("username");
      CREATE INDEX IF NOT EXISTS "Media_uploaderId_idx" ON "Media"("uploaderId");
      CREATE INDEX IF NOT EXISTS "Like_userId_mediaId_idx" ON "Like"("userId", "mediaId");
      CREATE INDEX IF NOT EXISTS "Comment_userId_idx" ON "Comment"("userId");
      CREATE INDEX IF NOT EXISTS "Comment_mediaId_idx" ON "Comment"("mediaId");
    `;
    
    // Execute the SQL to create tables
    await prisma.$executeRawUnsafe(createTablesSQL);
    
    console.log('✅ Database tables created successfully!');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database tables created successfully! You can now import data.' 
    });
    
  } catch (error) {
    console.error('❌ Error setting up database:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to setup database: ' + errorMessage },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
