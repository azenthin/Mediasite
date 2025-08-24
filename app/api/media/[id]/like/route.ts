import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/database';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    console.log('👍 Like API: Starting request...');
    
    const session = await auth();
    const userId = session?.user?.id;
    
    console.log('👤 Like API: User session:', { userId: userId || 'not authenticated' });

    if (!userId) {
      console.log('❌ Like API: No authenticated user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const mediaId = params.id;
    console.log('🎬 Like API: Media ID:', mediaId);

    // Check if media exists
    const media = await prisma.media.findUnique({
      where: { id: mediaId }
    });

    if (!media) {
      console.log('❌ Like API: Media not found');
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    // Check if user already liked this media
    const existingLike = await prisma.like.findFirst({
      where: {
        userId,
        mediaId
      }
    });

    if (existingLike) {
      // Unlike - remove the like
      await prisma.like.delete({
        where: {
          id: existingLike.id
        }
      });
      console.log('💔 Like API: Unliked media');
      
      // Get updated count
      const likeCount = await prisma.like.count({
        where: { mediaId }
      });

      return NextResponse.json({ 
        liked: false, 
        likeCount,
        message: 'Media unliked' 
      });
    } else {
      // Like - add new like
      await prisma.like.create({
        data: {
          userId,
          mediaId
        }
      });
      console.log('❤️ Like API: Liked media');

      // Get updated count
      const likeCount = await prisma.like.count({
        where: { mediaId }
      });

      return NextResponse.json({ 
        liked: true, 
        likeCount,
        message: 'Media liked' 
      });
    }

  } catch (error) {
    console.error('❌ Like API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    const mediaId = params.id;

    // Get like status and count
    const [likeCount, userLike] = await Promise.all([
      prisma.like.count({
        where: { mediaId }
      }),
      userId ? prisma.like.findFirst({
        where: {
          userId,
          mediaId
        }
      }) : null
    ]);

    return NextResponse.json({
      liked: !!userLike,
      likeCount
    });

  } catch (error) {
    console.error('❌ Like GET API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error'
    }, { status: 500 });
  }
}
