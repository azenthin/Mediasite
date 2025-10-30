import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { createRateLimit } from '@/lib/rate-limit';

// Rate limiting: 100 requests per minute
const mediaRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  message: 'Too many requests. Please try again later.'
});

import { apiCache } from '@/lib/api-cache';
import { logger } from '@/lib/logger';

type MediaResult = Awaited<ReturnType<typeof prisma.media.findMany>>[0];

// Mock data for when database is not available
const mockMedia = [
  {
    id: '1',
    type: 'VIDEO',
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    title: 'For Bigger Joyrides - Vertical Edit',
    description: 'An exciting ride through the city',
    thumbnailUrl: 'https://placehold.co/720x1280/282828/ffffff?text=Video+1',
    uploader: {
      id: '1',
      username: 'Sample Videos',
      displayName: 'Sample Videos',
      avatarUrl: 'https://placehold.co/40x40/555555/ffffff?text=SV'
    },
    views: 1200,
    likes: 150,
    _count: {
      likeRecords: 150,
      comments: 45
    }
  },
  {
    id: '2',
    type: 'VIDEO',
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    title: 'For Bigger Blazes',
    description: 'Fire and excitement',
    thumbnailUrl: 'https://placehold.co/720x1280/282828/ffffff?text=Video+2',
    uploader: {
      id: '2',
      username: 'Epic Videos',
      displayName: 'Epic Videos',
      avatarUrl: 'https://placehold.co/40x40/555555/ffffff?text=EV'
    },
    views: 950,
    likes: 120,
    _count: {
      likeRecords: 120,
      comments: 34
    }
  },
  {
    id: '3',
    type: 'VIDEO',
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    title: 'For Bigger Escapes',
    description: 'Thrilling escape sequences',
    thumbnailUrl: 'https://placehold.co/720x1280/282828/ffffff?text=Video+3',
    uploader: {
      id: '3',
      username: 'Thrill Seekers',
      displayName: 'Thrill Seekers',
      avatarUrl: 'https://placehold.co/40x40/555555/ffffff?text=TS'
    },
    views: 1500,
    likes: 200,
    _count: {
      likeRecords: 200,
      comments: 67
    }
  },
  {
    id: '4',
    type: 'VIDEO',
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    title: 'For Bigger Fun',
    description: 'Pure entertainment and fun',
    thumbnailUrl: 'https://placehold.co/720x1280/282828/ffffff?text=Video+4',
    uploader: {
      id: '4',
      username: 'Fun Times',
      displayName: 'Fun Times',
      avatarUrl: 'https://placehold.co/40x40/555555/ffffff?text=FT'
    },
    views: 900,
    likes: 120,
    _count: {
      likeRecords: 120,
      comments: 34
    }
  },
  {
    id: '5',
    type: 'VIDEO',
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    title: 'For Bigger Meltdowns',
    description: 'Intense action sequences',
    thumbnailUrl: 'https://placehold.co/720x1280/282828/ffffff?text=Video+5',
    uploader: {
      id: '5',
      username: 'Action Central',
      displayName: 'Action Central',
      avatarUrl: 'https://placehold.co/40x40/555555/ffffff?text=AC'
    },
    views: 1100,
    likes: 180,
    _count: {
      likeRecords: 180,
      comments: 56
    }
  },
  {
    id: '6',
    type: 'IMAGE',
    url: "https://placehold.co/720x1280/282828/ffffff?text=Image+1",
    title: "Sunset Over the City",
    description: "Beautiful cityscape at golden hour",
    thumbnailUrl: "https://placehold.co/720x1280/282828/ffffff?text=Image+1",
    uploader: {
      id: '6',
      username: 'City Adventures',
      displayName: 'City Adventures',
      avatarUrl: 'https://placehold.co/40x40/555555/ffffff?text=CA'
    },
    views: 800,
    likes: 89,
    _count: {
      likeRecords: 89,
      comments: 23
    }
  }
];

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = mediaRateLimit(request);
  if (rateLimitResult) {
    return rateLimitResult;
  }

  // Add caching for instant responses like YouTube
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  response.headers.set('CDN-Cache-Control', 'public, max-age=300');

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const type = searchParams.get('type') as 'VIDEO' | 'IMAGE' | undefined;
    const uploaderId = searchParams.get('uploaderId');

    // Try to connect to database, fallback to mock data if it fails
    try {
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {
        isPublic: true,
      };

      if (category && category !== 'All') {
        where.category = category;
      }

      if (type) {
        where.type = type;
      }

      if (uploaderId) {
        where.uploaderId = uploaderId;
      }

      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { uploader: { username: { contains: search, mode: 'insensitive' } } },
        ];
      }

      // Get media with pagination
      const [media, total] = await Promise.all([
        prisma.media.findMany({
          where,
          include: {
            uploader: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              }
            },
            _count: {
              select: {
                likeRecords: true,
                comments: true,
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.media.count({ where })
      ]);

      // Group media by groupId or individual items
      const groupedMedia = [];
      const processedGroupIds = new Set();

      for (const item of media) {
        if (item.groupId && !processedGroupIds.has(item.groupId)) {
          // This is the first item in a group, get all related items
          const relatedItems = media.filter(m => m.groupId === item.groupId);
          processedGroupIds.add(item.groupId);
          
          // Create a main post with related media
          const mainPost = {
            ...item,
            relatedMedia: relatedItems.filter(m => m.id !== item.id) // Exclude the main item
          };
          groupedMedia.push(mainPost);
        } else if (!item.groupId) {
          // Individual item without group
          groupedMedia.push(item);
        }
        // Skip items that are part of a group but not the main item
      }

      // Get categories for filtering
      const categories = await prisma.media.findMany({
        where: { isPublic: true },
        select: { category: true },
        distinct: ['category'],
      });

      return NextResponse.json({
        media: groupedMedia,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        categories: categories.map(c => c.category).filter(Boolean),
      });

    } catch (dbError) {
      console.error('Database not available, using mock data:', dbError);
      console.error('Database URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
      console.error('Node ENV:', process.env.NODE_ENV);
      
      // Return mock data when database is not available
      return NextResponse.json({
        media: mockMedia,
        pagination: {
          page: 1,
          limit: 20,
          total: mockMedia.length,
          pages: 1,
        },
        categories: ['All', 'Entertainment', 'Sports'],
      });
    }

  } catch (error) {
    console.error('Media fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 