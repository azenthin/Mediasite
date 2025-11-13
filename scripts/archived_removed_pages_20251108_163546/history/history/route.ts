import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { safeAuth } from '@/lib/safe-auth';

export async function GET(request: NextRequest) {
  try {
    console.log('📋 History API: Starting request...');
    
    const session = await safeAuth();
    const userId = session?.user?.id;
    
    console.log('👤 History API: User session:', { userId: userId || 'not authenticated' });
    
    if (!userId) {
      console.log('❌ History API: No authenticated user');
      return NextResponse.json({ items: [], hasMore: false });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const skip = (page - 1) * limit;

    console.log('📊 History API: Query params:', { page, limit, skip });

    const history = await prisma.watchHistory.findMany({
      where: { userId },
      orderBy: { watchedAt: 'desc' },
      skip,
      take: limit + 1, // Take one extra to check if there are more
      include: {
        media: {
          include: {
            uploader: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
            _count: { select: { likeRecords: true, comments: true } }
          }
        }
      }
    });

    console.log(`🎬 History API: Found ${history.length} history entries`);

    const hasMore = history.length > limit;
    const items = (hasMore ? history.slice(0, limit) : history).map(h => ({
      ...h.media,
      watchProgress: h.progress,
      watchedAt: h.watchedAt
    }));

    const response = { items, hasMore, page, limit };
    console.log('✅ History API: Returning response:', { itemCount: items.length, hasMore, page, limit });
    
    return NextResponse.json(response);
  } catch (e) {
    console.error('❌ History API error:', e);
    return NextResponse.json({ 
      items: [], 
      hasMore: false, 
      error: 'Internal server error',
      details: e instanceof Error ? e.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await safeAuth();
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ ok: true });

    const { mediaId, progress } = await request.json();
    if (!mediaId || typeof progress !== 'number') {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    await prisma.watchHistory.upsert({
      where: { userId_mediaId: { userId, mediaId } },
      create: { userId, mediaId, progress: Math.max(0, Math.min(1, progress)) },
      update: { progress: Math.max(0, Math.min(1, progress)), watchedAt: new Date() }
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    console.log('🗑️ History DELETE: Starting request...');
    
    const session = await safeAuth();
    const userId = session?.user?.id;
    
    console.log('👤 History DELETE: User session:', { userId: userId || 'not authenticated' });

    if (!userId) {
      console.log('❌ History DELETE: No authenticated user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    console.log('📋 History DELETE: Request body:', body);

    if (body.clearAll) {
      // Clear all history for user
      console.log('🧹 History DELETE: Clearing all history...');
      const deleted = await prisma.watchHistory.deleteMany({
        where: { userId }
      });
      console.log(`✅ History DELETE: Cleared ${deleted.count} history entries`);
      return NextResponse.json({ success: true, deletedCount: deleted.count });
    }

    if (body.mediaIds && Array.isArray(body.mediaIds)) {
      // Delete specific items
      console.log(`🎯 History DELETE: Deleting ${body.mediaIds.length} specific items...`);
      const deleted = await prisma.watchHistory.deleteMany({
        where: {
          userId,
          mediaId: { in: body.mediaIds }
        }
      });
      console.log(`✅ History DELETE: Deleted ${deleted.count} history entries`);
      return NextResponse.json({ success: true, deletedCount: deleted.count });
    }

    console.log('❌ History DELETE: Invalid request body');
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  } catch (error) {
    console.error('❌ History DELETE error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}




