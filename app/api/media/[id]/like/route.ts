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
      try {
        await prisma.like.delete({
          where: {
            id: existingLike.id
          }
        });
        console.log('💔 Like API: Unliked media');
      } catch (deleteError) {
        console.log('⚠️ Like API: Like record already deleted, continuing...');
        // Record might have been deleted by another request, continue as if unliked
      }
      
      // Decrement the media's likes count
      const updatedMedia = await prisma.media.update({
        where: { id: mediaId },
        data: {
          likes: {
            decrement: 1
          }
        },
        select: { likes: true }
      });

      return NextResponse.json({ 
        liked: false, 
        likeCount: updatedMedia.likes,
        message: 'Media unliked' 
      });
    } else {
      // Like - add new like
      try {
        await prisma.like.create({
          data: {
            userId,
            mediaId
          }
        });
        console.log('❤️ Like API: Liked media');
      } catch (createError: any) {
        // Handle unique constraint violation (user already liked this media)
        if (createError.code === 'P2002') {
          console.log('⚠️ Like API: Like already exists, continuing...');
        } else {
          throw createError; // Re-throw other errors
        }
      }

      // Increment the media's likes count
      const updatedMedia = await prisma.media.update({
        where: { id: mediaId },
        data: {
          likes: {
            increment: 1
          }
        },
        select: { likes: true }
      });

      return NextResponse.json({ 
        liked: true, 
        likeCount: updatedMedia.likes,
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
