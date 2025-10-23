import { NextRequest, NextResponse } from 'next/server';
import { safeAuth } from '@/lib/safe-auth';
import { prisma } from '@/lib/database';

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
