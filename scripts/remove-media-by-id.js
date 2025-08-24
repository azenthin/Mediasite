const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function removeMediaById(mediaId) {
  try {
    console.log(`🔍 Searching for media with ID: ${mediaId}`);
    
    // Find the specific media item
    const mediaToDelete = await prisma.media.findUnique({
      where: { id: mediaId },
      include: {
        uploader: {
          select: {
            username: true,
            displayName: true
          }
        }
      }
    });

    if (!mediaToDelete) {
      console.log('❌ No media found with that ID');
      return;
    }

    console.log(`📋 Found media to delete:`);
    console.log(`  - ID: ${mediaToDelete.id}`);
    console.log(`  - Title: ${mediaToDelete.title}`);
    console.log(`  - Type: ${mediaToDelete.type}`);
    console.log(`  - URL: ${mediaToDelete.url}`);
    console.log(`  - Uploader: ${mediaToDelete.uploader.username}`);
    console.log('  ---');

    // Delete the media item
    const deleteResult = await prisma.media.delete({
      where: { id: mediaId }
    });

    console.log(`✅ Successfully deleted media item`);
    
    // Also check if there are any related records to clean up
    const relatedLikes = await prisma.like.count({
      where: { mediaId: mediaId }
    });

    const relatedComments = await prisma.comment.count({
      where: { mediaId: mediaId }
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

// Get media ID from command line argument
const mediaId = process.argv[2];

if (!mediaId) {
  console.log('❌ Please provide a media ID to remove');
  console.log('Usage: node scripts/remove-media-by-id.js <mediaId>');
  console.log('Example: node scripts/remove-media-by-id.js cme1pddgn00075xaxh4bfugjf');
  process.exit(1);
}

removeMediaById(mediaId);
