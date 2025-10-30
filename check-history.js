const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkHistory() {
  try {
    console.log('🔍 Checking watch history...');
    console.log('📍 Connecting to database...');
    
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: 'joab.tesfai@gmail.com' }
    });
    
    if (!user) {
      console.log('❌ User not found with email: joab.tesfai@gmail.com');
      return;
    }
    
    console.log(`✅ Found user: ${user.username} (ID: ${user.id})`);
    
    // Check watch history for this user
    const history = await prisma.watchHistory.findMany({
      where: { userId: user.id },
      include: {
        media: {
          select: { title: true, type: true }
        }
      },
      orderBy: { watchedAt: 'desc' }
    });
    
    console.log(`📊 Watch history entries: ${history.length}`);
    
    if (history.length === 0) {
      console.log('❌ No watch history found for this user');
      console.log('💡 This means either:');
      console.log('   1. You haven\'t watched any videos yet');
      console.log('   2. The progress tracking isn\'t working');
      console.log('   3. There\'s an authentication issue');
    } else {
      console.log('✅ Watch history found:');
      history.forEach((h, i) => {
        console.log(`${i + 1}. "${h.media.title}" - ${Math.round(h.progress * 100)}% watched at ${h.watchedAt}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking history:', error);
    console.error('Full error:', error);
  } finally {
    console.log('🔌 Disconnecting from database...');
    await prisma.$disconnect();
  }
}

checkHistory();
