const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function clearDatabase() {
  try {
    console.log('Clearing media database...');
    
    // Clear all media records
    const deletedMedia = await prisma.media.deleteMany({});
    console.log(`Deleted ${deletedMedia.count} media records`);
    
    // Clear any related records (likes, comments, etc.)
    const deletedLikes = await prisma.likeRecord.deleteMany({});
    console.log(`Deleted ${deletedLikes.count} like records`);
    
    const deletedComments = await prisma.comment.deleteMany({});
    console.log(`Deleted ${deletedComments.count} comment records`);
    
    console.log('Database cleared successfully!');
  } catch (error) {
    console.error('Error clearing database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearDatabase();
