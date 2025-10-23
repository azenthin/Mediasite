import { NextRequest, NextResponse } from 'next/server';
import { safeAuth } from '@/lib/safe-auth';
import { prisma } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await safeAuth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ isSubscribed: false });
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');

    if (!targetUserId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const subscription = await prisma.subscription.findUnique({
      where: {
        subscriberId_subscribedToId: {
          subscriberId: userId,
          subscribedToId: targetUserId
        }
      }
    });

    return NextResponse.json({ isSubscribed: !!subscription });

  } catch (error) {
    console.error('Check subscription error:', error);
    return NextResponse.json({ isSubscribed: false });
  }
}
