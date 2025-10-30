import { NextRequest, NextResponse } from 'next/server';
import { safeAuth } from '@/lib/safe-auth';
import { prisma } from '@/lib/database';

interface RouteParams {
  params: {
    id: string;
  };
}

// POST - Subscribe to a user
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await safeAuth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const targetUserId = params.id;

    // Cannot subscribe to yourself
    if (userId === targetUserId) {
      return NextResponse.json({ error: 'Cannot subscribe to yourself' }, { status: 400 });
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId }
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if already subscribed
    const existing = await prisma.subscription.findUnique({
      where: {
        subscriberId_subscribedToId: {
          subscriberId: userId,
          subscribedToId: targetUserId
        }
      }
    });

    if (existing) {
      return NextResponse.json({ 
        subscribed: true,
        message: 'Already subscribed'
      });
    }

    // Create subscription
    await prisma.subscription.create({
      data: {
        subscriberId: userId,
        subscribedToId: targetUserId
      }
    });

    // Log analytics event
    try {
      await prisma.analyticsEvent.create({
        data: {
          eventType: 'SUBSCRIBE',
          sessionId: 'web-session',
          userId
        }
      });
    } catch (e) {
      // Analytics failure shouldn't break the subscribe action
      console.error('Failed to log subscribe event:', e);
    }

    return NextResponse.json({ 
      subscribed: true,
      message: 'Successfully subscribed'
    });

  } catch (error) {
    console.error('Subscribe API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Unsubscribe from a user
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await safeAuth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const targetUserId = params.id;

    // Delete subscription
    await prisma.subscription.deleteMany({
      where: {
        subscriberId: userId,
        subscribedToId: targetUserId
      }
    });

    return NextResponse.json({ 
      subscribed: false,
      message: 'Successfully unsubscribed'
    });

  } catch (error) {
    console.error('Unsubscribe API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Check subscription status
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await safeAuth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ subscribed: false });
    }

    const targetUserId = params.id;

    const subscription = await prisma.subscription.findUnique({
      where: {
        subscriberId_subscribedToId: {
          subscriberId: userId,
          subscribedToId: targetUserId
        }
      }
    });

    return NextResponse.json({ 
      subscribed: !!subscription
    });

  } catch (error) {
    console.error('Check subscription API error:', error);
    return NextResponse.json({ subscribed: false });
  }
}
