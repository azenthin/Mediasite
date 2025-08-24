process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./prisma/dev.db';
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log('Checking database...');
    
    const media = await prisma.media.findMany({
      include: {
        uploader: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log(`Found ${media.length} media items:`);
    
    media.forEach((item, index) => {
      console.log(`\n${index + 1}. ID: ${item.id}`);
      console.log(`   Title: ${item.title}`);
      console.log(`   Type: ${item.type}`);
      console.log(`   GroupId: ${item.groupId || 'null'}`);
      console.log(`   Uploader: ${item.uploader.username}`);
      console.log(`   Created: ${item.createdAt}`);
    });
    
    // Check for groups
    const groups = await prisma.media.groupBy({
      by: ['groupId'],
      where: {
        groupId: { not: null }
      },
      _count: {
        id: true
      }
    });
    
    console.log('\n=== Groups ===');
    groups.forEach(group => {
      console.log(`GroupId: ${group.groupId} - ${group._count.id} items`);
    });
    
  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
