import { NextRequest, NextResponse } from 'next/server';
import { safeAuth } from '@/lib/safe-auth';
import { prisma } from '@/lib/database';
import { REGION_MAP } from '@/lib/regional-recommendations';

/**
 * GET /api/profile - Get current user profile including regional preference
 */
export async function GET(request: NextRequest) {
  try {
    const session = await safeAuth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        preferredRegion: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        ...user,
        regionName: user.preferredRegion 
          ? REGION_MAP[user.preferredRegion as keyof typeof REGION_MAP]?.name 
          : null,
      },
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/profile - Update user profile including regional preference
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await safeAuth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { displayName, preferredRegion } = body;

    // Validate region if provided
    if (preferredRegion && !REGION_MAP[preferredRegion as keyof typeof REGION_MAP]) {
      return NextResponse.json(
        { error: `Invalid region: ${preferredRegion}. Must be one of: ${Object.keys(REGION_MAP).join(', ')}` },
        { status: 400 }
      );
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(displayName !== undefined && { displayName }),
        ...(preferredRegion !== undefined && { preferredRegion: preferredRegion || null }),
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        preferredRegion: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    console.log(`✅ Updated user ${session.user.id} profile`, {
      displayName: updatedUser.displayName,
      preferredRegion: updatedUser.preferredRegion,
    });

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        ...updatedUser,
        regionName: updatedUser.preferredRegion 
          ? REGION_MAP[updatedUser.preferredRegion as keyof typeof REGION_MAP]?.name 
          : null,
      },
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
