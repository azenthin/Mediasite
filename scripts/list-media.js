const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function listAllMedia() {
  try {
    console.log('📋 Listing all media in database...\n');
    
    const allMedia = await prisma.media.findMany({
      include: {
        uploader: {
          select: {
            username: true,
            displayName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (allMedia.length === 0) {
      console.log('❌ No media found in database');
      return;
    }

    console.log(`✅ Found ${allMedia.length} media item(s):\n`);
    
    for (const media of allMedia) {
      console.log(`📁 ID: ${media.id}`);
      console.log(`📝 Title: ${media.title}`);
      console.log(`🎬 Type: ${media.type}`);
      console.log(`🔗 URL: ${media.url}`);
      console.log(`🖼️  Thumbnail: ${media.thumbnailUrl}`);
      console.log(`👤 Uploader: ${media.uploader.username}`);
      console.log(`📅 Created: ${media.createdAt}`);
      console.log('---');
    }

  } catch (error) {
    console.error('❌ Error listing media:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listAllMedia();

