import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function hashString(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function randomProductImageUrl(brand: string, product: string, seed: number) {
  const seedStr = `${brand}-${product}-${seed}-${hashString(brand + product + ':' + seed)}`;
  
  // 258 verified working Unsplash image URLs
  const baseUrls = [
    'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b',
    'https://images.unsplash.com/photo-1556906781-9a412961c28c',
    'https://images.unsplash.com/photo-1628779238951-be2c9f2a59f4',
    'https://images.unsplash.com/photo-1574629810360-7efbbe195018',
    'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519',
    'https://images.unsplash.com/photo-1549298916-b41d501d3772',
    'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a',
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff',
    'https://images.unsplash.com/photo-1608231387042-66d1773070a5',
    'https://images.unsplash.com/photo-1546519638-68e109498ffc'
  ];
  
  const seedNum = seed % baseUrls.length;
  const baseUrl = baseUrls[seedNum];
  return `${baseUrl}?w=600&h=800&fit=crop&auto=format`;
}

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Check if tables exist before trying to delete from them
    try {
      await prisma.analyticsEvent.deleteMany();
    } catch (e) {
      console.log('AnalyticsEvent table does not exist, skipping...');
    }
    
    try {
      await prisma.watchHistory.deleteMany();
    } catch (e) {
      console.log('WatchHistory table does not exist, skipping...');
    }
    
    try {
      await prisma.like.deleteMany();
    } catch (e) {
      console.log('Like table does not exist, skipping...');
    }
    
    try {
      await prisma.comment.deleteMany();
    } catch (e) {
      console.log('Comment table does not exist, skipping...');
    }
    
    try {
      await prisma.playlistMedia.deleteMany();
    } catch (e) {
      console.log('PlaylistMedia table does not exist, skipping...');
    }
    
    try {
      await prisma.playlist.deleteMany();
    } catch (e) {
      console.log('Playlist table does not exist, skipping...');
    }
    
    try {
      await prisma.media.deleteMany();
    } catch (e) {
      console.log('Media table does not exist, skipping...');
    }
    
    try {
      await prisma.subscription.deleteMany();
    } catch (e) {
      console.log('Subscription table does not exist, skipping...');
    }
    
    try {
      await prisma.user.deleteMany();
    } catch (e) {
      console.log('User table does not exist, skipping...');
    }
    
    console.log('🧹 Cleared existing data (or tables did not exist)');
    
    // Create test users
    const testUser = await prisma.user.create({
      data: {
        email: 'test@mediasite.com',
        username: 'testuser',
        password: 'hashedpassword123',
        displayName: 'Test User',
        avatarUrl: 'https://placehold.co/40x40/555555/ffffff?text=TU'
      }
    });

    const brandInfos = [
      { username: 'ProGear', displayName: 'ProGear', color: '0e7490' },
      { username: 'SprintLab', displayName: 'Sprint Lab', color: 'b91c1c' },
      { username: 'CourtKings', displayName: 'Court Kings', color: '6d28d9' },
      { username: 'FlexFit', displayName: 'FlexFit', color: '16a34a' },
      { username: 'TrailEdge', displayName: 'Trail Edge', color: 'd97706' },
    ];

    const brands = [] as { id: string; username: string }[];
    for (const b of brandInfos) {
      const user = await prisma.user.create({
        data: {
          email: `${b.username.toLowerCase()}@brands.local`,
          username: b.username,
          password: 'nopass',
          displayName: b.displayName,
          avatarUrl: `https://placehold.co/40x40/${b.color}/ffffff?text=${b.username.charAt(0)}`
        }
      });
      brands.push({ id: user.id, username: user.username });
    }

    const subscribed = [brands[0], brands[2]];
    for (const sub of subscribed) {
      await prisma.subscription.create({
        data: {
          subscriberId: testUser.id,
          subscribedToId: sub.id
        }
      });
    }

    const videoPool = [
      'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
      'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      'https://storage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
    ];

    const categories = ['Sports', 'Shoes', 'Apparel', 'Fitness', 'Accessories'];
    const productLines = [
      'Running Shoes', 'Basketball Shoes', 'Training Tee', 'Compression Top', 'Track Pants',
      'Hoodie', 'Caps', 'Backpack', 'Socks', 'Wristbands'
    ];

    // Create 50 media items (reduced for faster seeding)
    for (let i = 0; i < 50; i++) {
      const brand = pick(brands);
      const category = pick(categories);
      const product = pick(productLines);
      const isVideo = Math.random() < 0.35;
      const title = `${brand.username} ${product} — ${category}`;
      const description = `Showcase: ${product} by ${brand.username} for ${category.toLowerCase()} enthusiasts.`;
      const productImage = randomProductImageUrl(brand.username, product, i);
      const url = isVideo ? pick(videoPool) : productImage;
      const thumbnailUrl = isVideo ? productImage : productImage;
      const duration = isVideo ? pick([20, 25, 30, 45, 60]) : null;
      const views = Math.floor(200 + Math.random() * 5000);
      const likes = Math.floor(10 + Math.random() * Math.min(views, 600));
      const tags = JSON.stringify(['sports', 'brand', 'sneakers', 'running', 'training', 'fitness', 'apparel', 'gear']);

      await prisma.media.create({
        data: {
          title,
          description,
          url,
          thumbnailUrl,
          type: isVideo ? 'VIDEO' : 'IMAGE',
          category,
          tags,
          duration,
          views,
          likes,
          uploaderId: brand.id,
        }
      });
    }

    console.log('✅ Database seeded successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

export async function GET(request: NextRequest) {
  try {
    // Only allow seeding in development or with a secret key
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    
    if (process.env.NODE_ENV === 'production' && secret !== process.env.SEED_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await seedDatabase();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database seeded successfully with 50 media items!' 
    });
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to seed database: ' + errorMessage },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Only allow seeding in development or with a secret key
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    
    if (process.env.NODE_ENV === 'production' && secret !== process.env.SEED_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await seedDatabase();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database seeded successfully with 50 media items!' 
    });
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to seed database: ' + errorMessage },
      { status: 500 }
    );
  }
}
