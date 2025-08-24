import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { createRateLimit } from '@/lib/rate-limit';
import { auth } from '@/lib/auth';

// Rate limiting: 80 requests per minute for recommendations
const recsRateLimit = createRateLimit({
  windowMs: 60 * 1000,
  maxRequests: 80,
  message: 'Too many recommendation requests. Please try again shortly.'
});

// Ensure DATABASE_URL for local sqlite
if (!process.env.DATABASE_URL) {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('DATABASE_URL is required in production');
    }
    process.env.DATABASE_URL = 'file:./prisma/dev.db';
}

type MediaWithMeta = Awaited<ReturnType<typeof getCandidateMedia>> extends Array<infer U> ? U : never;

async function getCandidateMedia(take: number) {
  return prisma.media.findMany({
    where: { isPublic: true },
    include: {
      uploader: {
        select: { id: true, username: true, displayName: true, avatarUrl: true }
      },
      _count: { select: { likeRecords: true, comments: true } }
    },
    orderBy: { createdAt: 'desc' },
    take
  });
}

function daysSince(date: Date): number {
  const ms = Date.now() - date.getTime();
  return Math.max(0, ms / (1000 * 60 * 60 * 24));
}

function scoreItem(
  item: MediaWithMeta,
  userAffinity: {
    subscribedUploaderIds: Set<string>;
    likedUploaderIds: Set<string>;
    likedCategories: Set<string>;
  }
) {
  const likes = item.likes ?? 0;
  const views = item.views ?? 0;
  const recencyBoost = 1 / (1 + daysSince(item.createdAt) / 2); // half-life ~2 days
  const popularityScore = likes * 3 + views * 1;

  let affinity = 0;
  if (item.uploaderId && userAffinity.subscribedUploaderIds.has(item.uploaderId)) affinity += 120;
  if (item.uploaderId && userAffinity.likedUploaderIds.has(item.uploaderId)) affinity += 60;
  if (item.category && userAffinity.likedCategories.has(item.category)) affinity += 25;

  // Light type preference: prioritize videos slightly
  const typeBonus = item.type === 'VIDEO' ? 10 : 0;

  return popularityScore * recencyBoost + affinity + typeBonus;
}

function rerankForDiversity(items: MediaWithMeta[], maxPerUploader = 3) {
  const result: MediaWithMeta[] = [];
  const uploaderCounts = new Map<string, number>();
  for (const item of items) {
    const uid = item.uploaderId ?? 'unknown';
    const count = uploaderCounts.get(uid) ?? 0;
    if (count < maxPerUploader) {
      result.push(item);
      uploaderCounts.set(uid, count + 1);
    }
  }
  return result;
}

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const limited = recsRateLimit(request);
  if (limited) return limited;

  try {
    const session = await auth();
    const userId = session?.user?.id;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const category = searchParams.get('category');
    const epsilon = Math.max(0, Math.min(parseFloat(searchParams.get('epsilon') || '0.1'), 0.5));
    const exclude = (searchParams.get('exclude') || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const seed = searchParams.get('seed') || Math.floor(Date.now() / (1000 * 60)).toString();
    const cursor = searchParams.get('cursor');

    // Attempt database-backed recommendations; fallback to mock if unavailable
    try {
      // Build user affinity from likes and subscriptions
      let subscribedUploaderIds = new Set<string>();
      let likedUploaderIds = new Set<string>();
      let likedCategories = new Set<string>();

      if (userId) {
        const [subs, likes] = await Promise.all([
          prisma.subscription.findMany({
            where: { subscriberId: userId },
            select: { subscribedToId: true }
          }),
          prisma.like.findMany({
            where: { userId },
            select: { media: { select: { uploaderId: true, category: true } } }
          })
        ]);

        subscribedUploaderIds = new Set(subs.map(s => s.subscribedToId));
        likedUploaderIds = new Set(likes.map(l => l.media.uploaderId).filter(Boolean) as string[]);
        likedCategories = new Set(
          likes.map(l => l.media.category).filter((c): c is string => Boolean(c))
        );
      }

      // Fetch a pool of recent items (optionally filter by category)
      const poolSize = Math.max(limit * 8, 80);
      const pool = await prisma.media.findMany({
        where: {
          isPublic: true,
          ...(category && category !== 'All' ? { category } : {})
        },
        include: {
          uploader: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          _count: { select: { likeRecords: true, comments: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: poolSize
      });

      // Filter excluded IDs (recently seen)
      const filteredPool = exclude.length ? pool.filter(p => !exclude.includes(p.id)) : pool;

      // Bayesian smoothing on likes/views to reduce cold-start bias
      const aLikes = 5; // prior likes
      const bViews = 50; // prior views

      const scored = filteredPool
        .map(item => ({
          item,
          score: scoreItem(
            { ...item, likes: (item.likes ?? 0) + aLikes, views: (item.views ?? 0) + bViews } as any,
            { subscribedUploaderIds, likedUploaderIds, likedCategories }
          )
        }))
        .sort((a, b) => b.score - a.score)
        .map(s => s.item);

      // Dynamic diversity cap based on number of unique uploaders and requested limit
      const uniqueUploaders = new Set(scored.map(i => i.uploaderId ?? 'unknown'));
      const perUploaderCap = Math.max(5, Math.ceil(limit / Math.max(1, uniqueUploaders.size)));
      const diversified = rerankForDiversity(scored, perUploaderCap);

      // Trending/explore set: age-normalized popularity
      const withAges = filteredPool.map(item => {
        const ageHours = Math.max(1, (Date.now() - item.createdAt.getTime()) / (1000 * 60 * 60));
        const trendingScore = ((item.likes ?? 0) + 1) / Math.pow(ageHours + 2, 0.8)
          + ((item.views ?? 0) + 10) / Math.pow(ageHours + 2, 0.9);
        return { item, trendingScore };
      });
      const trendingSorted = withAges.sort((a, b) => b.trendingScore - a.trendingScore).map(t => t.item);

      // Exploration: pick K items from trending not already in top
      const exploreCount = Math.max(0, Math.min(limit, Math.round(limit * epsilon)));
      const baseCount = limit - exploreCount;
      const topBase = diversified.slice(0, baseCount);
      const alreadyIds = new Set(topBase.map(i => i.id));
      const explorePool = trendingSorted.filter(i => !alreadyIds.has(i.id));

      // Stable per-session shuffling based on seed
      function seededRandom(seedStr: string) {
        let h = 2166136261 >>> 0;
        for (let i = 0; i < seedStr.length; i++) {
          h ^= seedStr.charCodeAt(i);
          h = Math.imul(h, 16777619);
        }
        return () => {
          h += 0x6D2B79F5;
          let t = Math.imul(h ^ (h >>> 15), 1 | h);
          t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      }

      const rand = seededRandom(seed);
      const explore = explorePool
        .map(value => ({ value, key: rand() }))
        .sort((a, b) => a.key - b.key)
        .slice(0, exploreCount)
        .map(({ value }) => value);

      const merged = [...topBase, ...explore];

      // Cursor-based pagination over merged list
      let startIndex = 0;
      if (cursor) {
        const idx = merged.findIndex(m => m.id === cursor);
        startIndex = idx >= 0 ? idx + 1 : 0;
      }
      const pageItems = merged.slice(startIndex, startIndex + limit);
      const nextCursor = pageItems.length === limit ? pageItems[pageItems.length - 1].id : null;

      return NextResponse.json({ media: pageItems, pagination: { limit, nextCursor, seed } });
    } catch (dbError) {
      console.log('Recommendations DB error, serving mock:', dbError);
      // Minimal mock fallback (reuse a subset similar to /api/media)
      const mock = [
        {
          id: '1',
          type: 'VIDEO',
          url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
          title: 'For Bigger Joyrides - Recommended',
          description: 'An exciting ride through the city',
          thumbnailUrl: 'https://placehold.co/720x1280/282828/ffffff?text=Video+1',
          uploader: {
            id: '1', username: 'Sample Videos', displayName: 'Sample Videos',
            avatarUrl: 'https://placehold.co/40x40/555555/ffffff?text=SV'
          },
          views: 1200, likes: 150,
          _count: { likeRecords: 150, comments: 45 }
        },
        {
          id: '2', type: 'IMAGE', url: 'https://placehold.co/720x1280/282828/ffffff?text=Image+1',
          title: 'Sunset Over the City - Recommended',
          description: 'Beautiful cityscape at golden hour',
          thumbnailUrl: 'https://placehold.co/720x1280/282828/ffffff?text=Image+1',
          uploader: {
            id: '2', username: 'City Adventures', displayName: 'City Adventures',
            avatarUrl: 'https://placehold.co/40x40/555555/ffffff?text=CA'
          },
          views: 800, likes: 89,
          _count: { likeRecords: 89, comments: 23 }
        }
      ];
      return NextResponse.json({ media: mock, pagination: { limit: mock.length } });
    }
  } catch (error) {
    console.error('Recommendations error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


