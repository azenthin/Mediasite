import { NextRequest, NextResponse } from 'next/server';
import { safeAuth } from '@/lib/safe-auth';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    console.log('📊 Profile Stats API: Starting request...');
    
    const session = await safeAuth();
    const userId = session?.user?.id;
    
    console.log('👤 Profile Stats API: User session:', { userId: userId || 'not authenticated' });

    if (!userId) {
      console.log('❌ Profile Stats API: No authenticated user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user statistics
    const [
      uploadsCount,
      totalViews,
      totalLikes,
      subscribersCount
    ] = await Promise.all([
      // Count of user's uploads
      prisma.media.count({
        where: { uploaderId: userId }
      }),
      
      // Sum of views across all user's media
      prisma.media.aggregate({
        where: { uploaderId: userId },
        _sum: { views: true }
      }),
      
      // Count of likes on user's media
      prisma.like.count({
        where: {
          media: {
            uploaderId: userId
          }
        }
      }),
      
      // Count of subscribers
      prisma.subscription.count({
        where: {
          subscribedToId: userId
        }
      })
    ]);

    const stats = {
      uploadsCount,
      totalViews: totalViews._sum.views || 0,
      totalLikes,
      subscribersCount
    };

    console.log('✅ Profile Stats API: Returning stats:', stats);
    
    return NextResponse.json(stats);

  } catch (error) {
    console.error('❌ Profile Stats API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
