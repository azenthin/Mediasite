import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

interface RouteParams {
  params: {
    id: string;
  };
}

// GET - Fetch replies for a specific comment
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const commentId = params.id;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 20);
    const skip = (page - 1) * limit;

    // Check if parent comment exists
    const parentComment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, mediaId: true }
    });

    if (!parentComment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Fetch replies with pagination
    const [replies, totalCount] = await Promise.all([
      prisma.comment.findMany({
        where: { parentId: commentId },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
        include: {
          author: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true
            }
          },
          _count: {
            select: {
              likes: true
            }
          }
        }
      }),
      prisma.comment.count({
        where: { parentId: commentId }
      })
    ]);

    // Format replies for response
    const formattedReplies = replies.map(reply => ({
      id: reply.id,
      content: reply.content,
      author: reply.author,
      createdAt: reply.createdAt.toISOString(),
      likes: reply._count.likes
    }));

    return NextResponse.json({
      replies: formattedReplies,
      pagination: {
        page,
        limit,
        total: totalCount,
        hasMore: skip + limit < totalCount
      }
    });

  } catch (error) {
    console.error('❌ Comment Replies GET API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error'
    }, { status: 500 });
  }
}










