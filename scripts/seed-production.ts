import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedProduction() {
  try {
    console.log('🌱 Seeding production database...');
    
    // Clear existing data
    await prisma.analyticsEvent.deleteMany();
    await prisma.watchHistory.deleteMany();
    await prisma.like.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.playlistMedia.deleteMany();
    await prisma.playlist.deleteMany();
    await prisma.media.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.user.deleteMany();
    
    console.log('🧹 Cleared existing data');
    
    // Create test users
    const users = await Promise.all([
      prisma.user.create({
        data: {
          email: 'testuser@example.com',
          username: 'testuser',
          password: 'hashedpassword',
          displayName: 'Test User',
          avatarUrl: 'https://placehold.co/40x40/555555/ffffff?text=TU'
        }
      }),
      prisma.user.create({
        data: {
          email: 'progear@example.com',
          username: 'ProGear',
          password: 'hashedpassword',
          displayName: 'ProGear Sports',
          avatarUrl: 'https://placehold.co/40x40/555555/ffffff?text=PG'
        }
      }),
      prisma.user.create({
        data: {
          email: 'courtkings@example.com',
          username: 'CourtKings',
          password: 'hashedpassword',
          displayName: 'Court Kings',
          avatarUrl: 'https://placehold.co/40x40/555555/ffffff?text=CK'
        }
      })
    ]);
    
    console.log('👥 Created test users');
    
    // Import and run the main seeding logic
    const { seedDatabase } = await import('./seed-database');
    await seedDatabase();
    
    console.log('✅ Production database seeded successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding production database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedProduction();
