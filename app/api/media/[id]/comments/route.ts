import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/database';

interface RouteParams {
  params: {
    id: string;
  };
}

// GET - Fetch comments for a media item with nested replies
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const mediaId = params.id;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
    const skip = (page - 1) * limit;

    // Check if media exists
    const media = await prisma.media.findUnique({
      where: { id: mediaId },
      select: { id: true, title: true }
    });

    if (!media) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    // Fetch top-level comments (no parent) with pagination
    const [topLevelComments, totalCount] = await Promise.all([
      prisma.comment.findMany({
        where: { 
          mediaId,
          parentId: null // Only top-level comments
        },
        orderBy: { createdAt: 'desc' },
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
              likes: true,
              replies: true
            }
          }
        }
      }),
      prisma.comment.count({
        where: { 
          mediaId,
          parentId: null
        }
      })
    ]);

    // For each top-level comment, fetch its replies (limited to 3 for performance)
    const commentsWithReplies = await Promise.all(
      topLevelComments.map(async (comment) => {
        const replies = await prisma.comment.findMany({
          where: { parentId: comment.id },
          orderBy: { createdAt: 'asc' },
          take: 3, // Limit replies for performance
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
        });

        return {
          id: comment.id,
          content: comment.content,
          author: comment.author,
          createdAt: comment.createdAt.toISOString(),
          likes: comment._count.likes,
          replies: comment._count.replies,
          recentReplies: replies.map(reply => ({
            id: reply.id,
            content: reply.content,
            author: reply.author,
            createdAt: reply.createdAt.toISOString(),
            likes: reply._count.likes
          }))
        };
      })
    );

    return NextResponse.json({
      comments: commentsWithReplies,
      pagination: {
        page,
        limit,
        total: totalCount,
        hasMore: skip + limit < totalCount
      }
    });

  } catch (error) {
    console.error('❌ Comments GET API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// POST - Create a new comment or reply
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const mediaId = params.id;
    const { content, parentId } = await request.json();

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Comment content is required' }, { status: 400 });
    }

    if (content.length > 500) {
      return NextResponse.json({ error: 'Comment too long (max 500 characters)' }, { status: 400 });
    }

    // Check if media exists
    const media = await prisma.media.findUnique({
      where: { id: mediaId },
      select: { id: true, title: true }
    });

    if (!media) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    // If it's a reply, check if parent comment exists
    if (parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentId },
        select: { id: true, mediaId: true }
      });

      if (!parentComment || parentComment.mediaId !== mediaId) {
        return NextResponse.json({ error: 'Parent comment not found' }, { status: 404 });
      }
    }

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        mediaId,
        authorId: userId,
        parentId: parentId || null
      },
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
            likes: true,
            replies: true
          }
        }
      }
    });

    // Format comment for response
    const formattedComment = {
      id: comment.id,
      content: comment.content,
      author: comment.author,
      createdAt: comment.createdAt.toISOString(),
      likes: comment._count.likes,
      replies: comment._count.replies,
      parentId: comment.parentId
    };

    return NextResponse.json({ 
      comment: formattedComment,
      message: parentId ? 'Reply created successfully' : 'Comment created successfully'
    });

  } catch (error) {
    console.error('❌ Comments POST API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error'
    }, { status: 500 });
  }
}
