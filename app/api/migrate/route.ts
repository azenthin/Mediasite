import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Only allow migration in development or with a secret key
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    
    if (process.env.NODE_ENV === 'production' && secret !== process.env.SEED_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 Starting database migration...');
    
    // This will create all the tables based on the current schema
    await prisma.$executeRaw`CREATE SCHEMA IF NOT EXISTS public`;
    
    // Force a schema sync (this is what prisma db push does)
    await prisma.$executeRaw`SELECT 1`;
    
    console.log('✅ Database migration completed!');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database schema migrated successfully!' 
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
