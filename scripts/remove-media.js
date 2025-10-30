const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function removeMediaByFilename(filename) {
  try {
    console.log(`🔍 Searching for media with filename: ${filename}`);
    
    // Find media that contains the filename in the URL
    const mediaToDelete = await prisma.media.findMany({
      where: {
        OR: [
          { url: { contains: filename } },
          { thumbnailUrl: { contains: filename } }
        ]
      },
      include: {
        uploader: {
          select: {
            username: true,
            displayName: true
          }
        }
      }
    });

    if (mediaToDelete.length === 0) {
      console.log('❌ No media found with that filename');
      return;
    }

    console.log(`📋 Found ${mediaToDelete.length} media item(s) to delete:`);
    
    for (const media of mediaToDelete) {
      console.log(`  - ID: ${media.id}`);
      console.log(`  - Title: ${media.title}`);
      console.log(`  - Type: ${media.type}`);
      console.log(`  - URL: ${media.url}`);
      console.log(`  - Uploader: ${media.uploader.username}`);
      console.log('  ---');
    }

    // Delete the media items
    const deleteResult = await prisma.media.deleteMany({
      where: {
        OR: [
          { url: { contains: filename } },
          { thumbnailUrl: { contains: filename } }
        ]
      }
    });

    console.log(`✅ Successfully deleted ${deleteResult.count} media item(s)`);
    
    // Also check if there are any related records to clean up
    const relatedLikes = await prisma.like.count({
      where: {
        mediaId: { in: mediaToDelete.map(m => m.id) }
      }
    });

    const relatedComments = await prisma.comment.count({
      where: {
        mediaId: { in: mediaToDelete.map(m => m.id) }
      }
    });

    if (relatedLikes > 0 || relatedComments > 0) {
      console.log(`🗑️  Also cleaned up ${relatedLikes} likes and ${relatedComments} comments`);
    }

  } catch (error) {
    console.error('❌ Error removing media:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get filename from command line argument
const filename = process.argv[2];

if (!filename) {
  console.log('❌ Please provide a filename to remove');
  console.log('Usage: node scripts/remove-media.js <filename>');
  console.log('Example: node scripts/remove-media.js pexels-soldiervip-1308881.jpg');
  process.exit(1);
}

removeMediaByFilename(filename);
