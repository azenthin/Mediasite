import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function importLocalData() {
  try {
    console.log('📥 Importing local database data to Postgres...');
    
    // Read export file
    const exportPath = path.join(__dirname, 'local-database-export.json');
    const exportData = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));
    
    console.log(`📊 Total items to import: ${exportData.totalItems}`);
    
    // Import users
    console.log(`\n👥 Importing ${exportData.users.length} users...`);
    for (const user of exportData.users) {
      await prisma.user.upsert({
        where: { id: user.id },
        update: {},
        create: {
          id: user.id,
          email: user.email,
          username: user.username,
          password: user.password,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          emailVerified: user.emailVerified,
          emailVerificationToken: user.emailVerificationToken,
          emailVerificationExpires: user.emailVerificationExpires ? new Date(user.emailVerificationExpires) : null,
          createdAt: new Date(user.createdAt),
          updatedAt: new Date(user.updatedAt),
        }
      });
    }
    console.log('✅ Users imported');
    
    // Import media
    console.log(`\n🖼️ Importing ${exportData.media.length} media items...`);
    for (const media of exportData.media) {
      await prisma.media.upsert({
        where: { id: media.id },
        update: {},
        create: {
          id: media.id,
          title: media.title,
          description: media.description,
          url: media.url,
          thumbnailUrl: media.thumbnailUrl,
          type: media.type,
          category: media.category,
          tags: media.tags,
          duration: media.duration,
          isPublic: media.isPublic,
          views: media.views,
          likes: media.likes,
          groupId: media.groupId,
          uploaderId: media.uploaderId,
          createdAt: new Date(media.createdAt),
          updatedAt: new Date(media.updatedAt),
        }
      });
    }
    console.log('✅ Media imported');
    
    // Import subscriptions
    console.log(`\n🔗 Importing ${exportData.subscriptions.length} subscriptions...`);
    for (const sub of exportData.subscriptions) {
      await prisma.subscription.upsert({
        where: { id: sub.id },
        update: {},
        create: {
          id: sub.id,
          subscriberId: sub.subscriberId,
          subscribedToId: sub.subscribedToId,
          createdAt: new Date(sub.createdAt),
        }
      });
    }
    console.log('✅ Subscriptions imported');
    
    // Import likes
    console.log(`\n❤️ Importing ${exportData.likes.length} likes...`);
    for (const like of exportData.likes) {
      await prisma.like.upsert({
        where: { id: like.id },
        update: {},
        create: {
          id: like.id,
          userId: like.userId,
          mediaId: like.mediaId,
          createdAt: new Date(like.createdAt),
        }
      });
    }
    console.log('✅ Likes imported');
    
    // Import comments with new schema mapping (userId -> authorId)
    console.log(`\n💬 Importing ${exportData.comments.length} comments...`);
    for (const comment of exportData.comments) {
      await prisma.comment.upsert({
        where: { id: comment.id },
        update: {},
        create: {
          id: comment.id,
          content: comment.content,
          authorId: comment.userId, // Map old userId to new authorId
          mediaId: comment.mediaId,
          parentId: comment.parentId,
          createdAt: new Date(comment.createdAt),
          updatedAt: new Date(comment.updatedAt),
        }
      });
    }
    console.log('✅ Comments imported');
    
    console.log(`\n🎉 Successfully imported all data!`);
    console.log(`📊 Total: ${exportData.totalItems} items`);
    
  } catch (error) {
    console.error('❌ Error importing data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

importLocalData();
