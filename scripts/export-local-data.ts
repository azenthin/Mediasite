import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function exportLocalData() {
  try {
    console.log('📤 Exporting local database data...');
    
    // Export users
    const users = await prisma.user.findMany();
    console.log(`👥 Found ${users.length} users`);
    
    // Export media
    const media = await prisma.media.findMany({
      include: {
        uploader: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          }
        }
      }
    });
    console.log(`🖼️ Found ${media.length} media items`);
    
    // Export subscriptions
    const subscriptions = await prisma.subscription.findMany();
    console.log(`🔗 Found ${subscriptions.length} subscriptions`);
    
    // Export likes
    const likes = await prisma.like.findMany();
    console.log(`❤️ Found ${likes.length} likes`);
    
    // Export comments
    const comments = await prisma.comment.findMany();
    console.log(`💬 Found ${comments.length} comments`);
    
    // Create export data
    const exportData = {
      users,
      media,
      subscriptions,
      likes,
      comments,
      exportDate: new Date().toISOString(),
      totalItems: users.length + media.length + subscriptions.length + likes.length + comments.length
    };
    
    // Save to file
    const exportPath = path.join(__dirname, 'local-database-export.json');
    fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
    
    console.log(`✅ Data exported to: ${exportPath}`);
    console.log(`📊 Total items exported: ${exportData.totalItems}`);
    
    return exportData;
    
  } catch (error) {
    console.error('❌ Error exporting data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

exportLocalData();
