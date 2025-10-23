import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

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
    
    // Create tables one by one
    try {
      // Create User table
      await prisma.$executeRawUnsafe(`
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
        )
      `);
      console.log('✅ User table created');
      
      // Create Media table
      await prisma.$executeRawUnsafe(`
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
        )
      `);
      console.log('✅ Media table created');
      
      // Create Subscription table
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Subscription" (
          "id" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "subscriberId" TEXT NOT NULL,
          "subscribedToId" TEXT NOT NULL,
          CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
        )
      `);
      console.log('✅ Subscription table created');
      
      // Create Like table
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Like" (
          "id" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "userId" TEXT NOT NULL,
          "mediaId" TEXT NOT NULL,
          CONSTRAINT "Like_pkey" PRIMARY KEY ("id")
        )
      `);
      console.log('✅ Like table created');
      
      // Create Comment table
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Comment" (
          "id" TEXT NOT NULL,
          "content" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          "userId" TEXT NOT NULL,
          "mediaId" TEXT NOT NULL,
          CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
        )
      `);
      console.log('✅ Comment table created');
      
      // Create indexes
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "User_username_idx" ON "User"("username")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Media_uploaderId_idx" ON "Media"("uploaderId")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Like_userId_mediaId_idx" ON "Like"("userId", "mediaId")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Comment_userId_idx" ON "Comment"("userId")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Comment_mediaId_idx" ON "Comment"("mediaId")`);
      console.log('✅ Indexes created');
      
    } catch (tableError) {
      console.log('Some tables may already exist, continuing...');
    }
    
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
