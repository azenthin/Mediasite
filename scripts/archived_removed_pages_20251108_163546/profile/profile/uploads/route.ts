import { NextRequest, NextResponse } from 'next/server';
import { safeAuth } from '@/lib/safe-auth';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    console.log('📁 Profile Uploads API: Starting request...');
    
    const session = await safeAuth();
    const userId = session?.user?.id;
    
    console.log('👤 Profile Uploads API: User session:', { userId: userId || 'not authenticated' });

    if (!userId) {
      console.log('❌ Profile Uploads API: No authenticated user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '24', 10);
    const skip = (page - 1) * limit;

    console.log('📊 Profile Uploads API: Query params:', { page, limit, skip });

    // Fetch user's uploads
    const uploads = await prisma.media.findMany({
      where: { uploaderId: userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit + 1, // Take one extra to check if there are more
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
    });

    console.log(`🎬 Profile Uploads API: Found ${uploads.length} uploads`);

    const hasMore = uploads.length > limit;
    const items = hasMore ? uploads.slice(0, limit) : uploads;

    const response = {
      items: items.map(upload => ({
        id: upload.id,
        title: upload.title,
        description: upload.description,
        type: upload.type,
        url: upload.url,
        thumbnailUrl: upload.thumbnailUrl,
        views: upload.views || 0,
        createdAt: upload.createdAt,
        _count: {
          likeRecords: upload._count.likeRecords,
          comments: upload._count.comments
        }
      })),
      hasMore,
      page,
      limit
    };

    console.log('✅ Profile Uploads API: Returning response:', { 
      itemCount: response.items.length, 
      hasMore, 
      page, 
      limit 
    });
    
    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Profile Uploads API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
