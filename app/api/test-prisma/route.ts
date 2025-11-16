import { NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const log: string[] = [];
  
  try {
    log.push('🔍 TEST START');
    log.push(`📊 Environment: ${process.env.NODE_ENV}`);
    log.push(`🔗 DATABASE_URL exists: ${!!process.env.DATABASE_URL}`);
    log.push(`🔗 DATABASE_URL type: ${process.env.DATABASE_URL?.substring(0, 10)}`);
    
    log.push('\n🔍 Testing Prisma client...');
    log.push(`  - prisma object: ${!!prisma}`);
    log.push(`  - prisma.verifiedTrack: ${!!prisma.verifiedTrack}`);
    
    log.push('\n🔍 Attempting simple count query...');
    const countStart = Date.now();
    const trackCount = await prisma.verifiedTrack.count();
    const countTime = Date.now() - countStart;
    log.push(`✅ Count query succeeded in ${countTime}ms`);
    log.push(`📊 Total tracks: ${trackCount}`);
    
    log.push('\n🔍 Attempting findFirst with genre filter...');
    const queryStart = Date.now();
    const popTrack = await prisma.verifiedTrack.findFirst({
      where: {
        primaryGenre: { contains: 'pop', mode: 'insensitive' },
      },
      include: {
        identifiers: true,
      },
    });
    const queryTime = Date.now() - queryStart;
    log.push(`✅ Query succeeded in ${queryTime}ms`);
    log.push(`📊 Found track: ${popTrack ? 'YES' : 'NO'}`);
    
    if (popTrack) {
      log.push(`  - Title: ${popTrack.title}`);
      log.push(`  - Artist: ${popTrack.artist}`);
      log.push(`  - Genre: ${popTrack.primaryGenre}`);
      log.push(`  - Identifiers: ${popTrack.identifiers?.length || 0}`);
      
      if (popTrack.identifiers && popTrack.identifiers.length > 0) {
        popTrack.identifiers.forEach(id => {
          log.push(`    * ${id.type}: ${id.value?.substring(0, 20)}...`);
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      log: log.join('\n'),
      data: {
        trackCount,
        sampleTrack: popTrack ? {
          title: popTrack.title,
          artist: popTrack.artist,
          identifierCount: popTrack.identifiers?.length || 0,
        } : null,
      },
    });
    
  } catch (error: any) {
    log.push('\n❌ ERROR OCCURRED:');
    log.push(`  - Type: ${error?.constructor?.name}`);
    log.push(`  - Message: ${error?.message}`);
    log.push(`  - Stack: ${error?.stack?.substring(0, 500)}`);
    
    return NextResponse.json({
      success: false,
      log: log.join('\n'),
      error: {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
      },
    }, { status: 500 });
  }
}
