import { NextRequest, NextResponse } from 'next/server';
import { safeAuth } from '@/lib/safe-auth';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    console.log('❤️ Profile Liked API: Starting request...');
    
    const session = await safeAuth();
    const userId = session?.user?.id;
    
    console.log('👤 Profile Liked API: User session:', { userId: userId || 'not authenticated' });

    if (!userId) {
      console.log('❌ Profile Liked API: No authenticated user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '24', 10);
    const skip = (page - 1) * limit;

    console.log('📊 Profile Liked API: Query params:', { page, limit, skip });

    // Fetch user's liked media
    const likedMedia = await prisma.like.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit + 1, // Take one extra to check if there are more
      include: {
        media: {
          include: {
            uploader: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true
              }
            },
            _count: {
              select: {
                likeRecords: true,
                comments: true
              }
            }
          }
        }
      }
    });

    console.log(`💖 Profile Liked API: Found ${likedMedia.length} liked items`);

    const hasMore = likedMedia.length > limit;
    const items = (hasMore ? likedMedia.slice(0, limit) : likedMedia).map(like => ({
      id: like.media.id,
      title: like.media.title,
      description: like.media.description,
      type: like.media.type,
      url: like.media.url,
      thumbnailUrl: like.media.thumbnailUrl,
      views: like.media.views || 0,
      createdAt: like.media.createdAt,
      uploader: like.media.uploader,
      _count: {
        likeRecords: like.media._count.likeRecords,
        comments: like.media._count.comments
      }
    }));

    const response = {
      items,
      hasMore,
      page,
      limit
    };

    console.log('✅ Profile Liked API: Returning response:', { 
      itemCount: response.items.length, 
      hasMore, 
      page, 
      limit 
    });
    
    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Profile Liked API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
