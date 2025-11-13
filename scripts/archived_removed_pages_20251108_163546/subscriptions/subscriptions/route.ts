import { NextRequest, NextResponse } from 'next/server';
import { safeAuth } from '@/lib/safe-auth';
import { prisma } from '@/lib/database';

export const dynamic = 'force-dynamic';

// GET - Get user's subscriptions
export async function GET(request: NextRequest) {
  try {
    const session = await safeAuth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscriptions = await prisma.subscription.findMany({
      where: { subscriberId: userId },
      include: {
        subscribedTo: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            _count: {
              select: {
                subscribers: true,
                media: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      subscriptions: subscriptions.map(sub => ({
        id: sub.id,
        createdAt: sub.createdAt,
        channel: {
          id: sub.subscribedTo.id,
          username: sub.subscribedTo.username,
          displayName: sub.subscribedTo.displayName,
          avatarUrl: sub.subscribedTo.avatarUrl,
          subscribersCount: sub.subscribedTo._count.subscribers,
          uploadsCount: sub.subscribedTo._count.media
        }
      }))
    });

  } catch (error) {
    console.error('Subscriptions API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Subscribe to a user
export async function POST(request: NextRequest) {
  try {
    const session = await safeAuth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { subscribedToId } = body;

    if (!subscribedToId) {
      return NextResponse.json({ error: 'subscribedToId required' }, { status: 400 });
    }

    if (subscribedToId === userId) {
      return NextResponse.json({ error: 'Cannot subscribe to yourself' }, { status: 400 });
    }

    // Check if already subscribed
    const existing = await prisma.subscription.findUnique({
      where: {
        subscriberId_subscribedToId: {
          subscriberId: userId,
          subscribedToId
        }
      }
    });

    if (existing) {
      return NextResponse.json({ message: 'Already subscribed' });
    }

    const subscription = await prisma.subscription.create({
      data: {
        subscriberId: userId,
        subscribedToId
      }
    });

    return NextResponse.json({ success: true, subscription });

  } catch (error) {
    console.error('Subscribe error:', error);
    return NextResponse.json(
      { error: 'Failed to subscribe' },
      { status: 500 }
    );
  }
}

// DELETE - Unsubscribe from a user
export async function DELETE(request: NextRequest) {
  try {
    const session = await safeAuth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { subscribedToId } = body;

    if (!subscribedToId) {
      return NextResponse.json({ error: 'subscribedToId required' }, { status: 400 });
    }

    await prisma.subscription.delete({
      where: {
        subscriberId_subscribedToId: {
          subscriberId: userId,
          subscribedToId
        }
      }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Unsubscribe error:', error);
    return NextResponse.json(
      { error: 'Failed to unsubscribe' },
      { status: 500 }
    );
  }
}
