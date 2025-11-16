import { NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

export async function GET() {
  try {
    // Check database connection
    const trackCount = await prisma.verifiedTrack.count();
    const identifierCount = await prisma.trackIdentifier.count();
    
    // Get a sample pop track with identifiers
    const sampleTrack = await prisma.verifiedTrack.findFirst({
      where: {
        primaryGenre: 'pop',
      },
      include: {
        identifiers: true,
      },
    });
    
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
          hasValue: !!i.value,
        })),
      } : null,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
      environment: process.env.NODE_ENV,
      databaseUrl: process.env.DATABASE_URL?.substring(0, 50) + '...',
    }, { status: 500 });
  }
}
