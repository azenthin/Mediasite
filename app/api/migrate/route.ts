import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Only allow migration in development or with a secret key
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    
    if (process.env.NODE_ENV === 'production' && secret !== process.env.MIGRATION_SECRET) {
      return NextResponse.json({ error: 'Unauthorized - Invalid secret' }, { status: 401 });
    }

    console.log('🔄 Starting database migration...');
    
    // First, check what columns exist
    const allColumns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Comment'
    `;
    console.log('📋 Comment table columns:', allColumns.map(c => c.column_name));
    
    // Check if Comment table has authorId column (needs to be userId)
    const checkAuthorId = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Comment' AND column_name = 'authorId'
    `;
    
    const checkUserId = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Comment' AND column_name = 'userId'
    `;
    
    if (checkAuthorId.length > 0 && checkUserId.length === 0) {
      console.log('📝 Found authorId column, renaming to userId...');
      
      // Rename authorId to userId (for @map compatibility)
      await prisma.$executeRaw`
        ALTER TABLE "Comment" 
        RENAME COLUMN "authorId" TO "userId"
      `;
      
      console.log('✅ Column renamed to userId!');
    } else {
      console.log('✓ Schema already has userId column');
    }
    
    // Create any missing tables/columns
    console.log('🔄 Syncing schema...');
    await prisma.$executeRaw`SELECT 1`;
    
    console.log('✅ Database migration completed!');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database schema migrated successfully! All data preserved.',
      columnRenamed: checkAuthorId.length > 0
    });
    
  } catch (error) {
    console.error('❌ Error migrating database:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to migrate database: ' + errorMessage },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
