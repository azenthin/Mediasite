const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testHistoryAPI() {
  try {
    console.log('🧪 Testing Watch History API...');
    
    // First, let's find your user
    const user = await prisma.user.findUnique({
      where: { email: 'joab.tesfai@gmail.com' }
    });
    
    if (!user) {
      console.log('❌ User not found with email: joab.tesfai@gmail.com');
      console.log('💡 Make sure you\'re signed in with this email');
      return;
    }
    
    console.log(`✅ Found user: ${user.username} (ID: ${user.id})`);
    
    // Get some media to test with
    const media = await prisma.media.findFirst({
      where: { type: 'VIDEO' }
    });
    
    if (!media) {
      console.log('❌ No video media found in database');
      return;
    }
    
    console.log(`📹 Testing with video: "${media.title}" (ID: ${media.id})`);
    
    // Check if there's already history for this user and media
    const existingHistory = await prisma.watchHistory.findUnique({
      where: { 
        userId_mediaId: { 
          userId: user.id, 
          mediaId: media.id 
        } 
      }
    });
    
    if (existingHistory) {
      console.log(`📊 Existing history found: ${Math.round(existingHistory.progress * 100)}% watched`);
    } else {
      console.log('📊 No existing history found');
    }
    
    // Now let's manually create/update a watch history entry
    console.log('🔧 Creating test watch history entry...');
    
    const testProgress = 0.25; // 25% watched
    const historyEntry = await prisma.watchHistory.upsert({
      where: { 
        userId_mediaId: { 
          userId: user.id, 
          mediaId: media.id 
        } 
      },
      create: { 
        userId: user.id, 
        mediaId: media.id, 
        progress: testProgress 
      },
      update: { 
        progress: testProgress, 
        watchedAt: new Date() 
      }
    });
    
    console.log(`✅ Created/updated history entry: ${Math.round(historyEntry.progress * 100)}% watched`);
    
    // Now let's fetch the history like the API would
    const history = await prisma.watchHistory.findMany({
      where: { userId: user.id },
      include: {
        media: {
          include: {
            uploader: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
            _count: { select: { likeRecords: true, comments: true } }
          }
        }
      },
      orderBy: { watchedAt: 'desc' },
      take: 20
    });
    
    console.log(`🎬 Total history entries: ${history.length}`);
    
    if (history.length > 0) {
      console.log('📋 Recent history:');
      history.slice(0, 5).forEach((h, i) => {
        console.log(`  ${i + 1}. "${h.media.title}" - ${Math.round(h.progress * 100)}% watched`);
      });
      console.log('\n✅ Watch history is working! The issue might be:');
      console.log('   1. You need to actually watch videos to generate history');
      console.log('   2. The frontend isn\'t calling the tracking API correctly');
      console.log('   3. There might be a session/auth issue');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testHistoryAPI();
