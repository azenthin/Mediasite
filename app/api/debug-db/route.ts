import { NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    console.log('🔍 Debug endpoint called');
    console.log('📊 Environment:', process.env.NODE_ENV);
    console.log('🔗 DATABASE_URL exists:', !!process.env.DATABASE_URL);
    console.log('🔗 DATABASE_URL prefix:', process.env.DATABASE_URL?.substring(0, 20));
    
    // Check database connection
    console.log('🔍 Attempting to count tracks...');
    const trackCount = await prisma.verifiedTrack.count();
    console.log('✅ Track count:', trackCount);
    
    console.log('🔍 Attempting to count identifiers...');
    const identifierCount = await prisma.trackIdentifier.count();
    console.log('✅ Identifier count:', identifierCount);
    
    // Get a sample pop track with identifiers
    console.log('🔍 Fetching sample track...');
    const sampleTrack = await prisma.verifiedTrack.findFirst({
      where: {
        primaryGenre: 'pop',
      },
      include: {
        identifiers: true,
      },
    });
    console.log('✅ Sample track found:', !!sampleTrack);
    console.log('✅ Sample track identifiers:', sampleTrack?.identifiers?.length || 0);
    
    // Check environment
    const dbUrl = process.env.DATABASE_URL?.substring(0, 50) + '...';
    
    return NextResponse.json({
      success: true,
      environment: process.env.NODE_ENV,
      databaseUrl: dbUrl,
      counts: {
        tracks: trackCount,
        identifiers: identifierCount,
      },
      sampleTrack: sampleTrack ? {
        title: sampleTrack.title,
        artist: sampleTrack.artist,
        genre: sampleTrack.primaryGenre,
        identifierCount: sampleTrack.identifiers?.length || 0,
        identifiers: sampleTrack.identifiers?.map(i => ({
          type: i.type,
          value: i.value?.substring(0, 20) + '...',
        })),
      } : null,
    });
  } catch (error: any) {
    console.error('❌ Debug endpoint error:', error);
    console.error('❌ Error stack:', error.stack);
    return NextResponse.json({
      success: false,
      error: error.message,
      errorName: error.name,
      stack: error.stack,
      environment: process.env.NODE_ENV,
      databaseUrl: process.env.DATABASE_URL?.substring(0, 50) + '...',
      databaseUrlExists: !!process.env.DATABASE_URL,
    }, { status: 500 });
  }
}
