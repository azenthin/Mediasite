import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/database';

interface RouteParams {
  params: {
    id: string;
  };
}

// POST - Toggle like on a comment
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const commentId = params.id;

    // Check if comment exists
    const comment = await prisma.comment.findUnique({
      where: { id: commentId }
    });

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Check if user already liked this comment
    const existingLike = await prisma.commentLike.findFirst({
      where: {
        userId,
        commentId
      }
    });

    if (existingLike) {
      // Unlike - remove the like
      await prisma.commentLike.delete({
        where: {
          id: existingLike.id
        }
      });

      // Get updated count
      const likeCount = await prisma.commentLike.count({
        where: { commentId }
      });

      return NextResponse.json({ 
        liked: false, 
        likeCount,
        message: 'Comment unliked' 
      });
    } else {
      // Like - add new like
      await prisma.commentLike.create({
        data: {
          userId,
          commentId
        }
      });

      // Get updated count
      const likeCount = await prisma.commentLike.count({
        where: { commentId }
      });

      return NextResponse.json({ 
        liked: true, 
        likeCount,
        message: 'Comment liked' 
      });
    }

  } catch (error) {
    console.error('❌ Comment Like API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// GET - Get like status for a comment
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const commentId = params.id;

    // Get like status and count
    const [likeCount, userLike] = await Promise.all([
      prisma.commentLike.count({
        where: { commentId }
      }),
      userId ? prisma.commentLike.findFirst({
        where: {
          userId,
          commentId
        }
      }) : null
    ]);

    return NextResponse.json({
      liked: !!userLike,
      likeCount
    });

  } catch (error) {
    console.error('❌ Comment Like GET API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error'
    }, { status: 500 });
  }
}










