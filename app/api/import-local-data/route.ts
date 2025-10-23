import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Only allow import in development or with a secret key
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    
    if (process.env.NODE_ENV === 'production' && secret !== process.env.SEED_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('📥 Starting import of local database data...');
    
    // Read the exported data
    const exportPath = path.join(process.cwd(), 'scripts', 'local-database-export.json');
    
    if (!fs.existsSync(exportPath)) {
      return NextResponse.json(
        { error: 'Export file not found. Run export-local-data.ts first.' },
        { status: 404 }
      );
    }
    
    const exportData = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
    console.log(`📊 Found ${exportData.totalItems} items to import`);
    
    // Clear existing data (if any)
    try {
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
    } catch (e) {
      console.log('Some tables may not exist, continuing...');
    }
    
    // Import users first
    console.log('👥 Importing users...');
    const userMap = new Map(); // Map old IDs to new IDs
    
    for (const user of exportData.users) {
      const newUser = await prisma.user.create({
        data: {
          email: user.email,
          username: user.username,
          password: user.password,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          emailVerified: user.emailVerified,
          emailVerificationToken: user.emailVerificationToken,
          emailVerificationExpires: user.emailVerificationExpires,
        }
      });
      userMap.set(user.id, newUser.id);
      console.log(`✅ Created user: ${newUser.username}`);
    }
    
    // Import media
    console.log('🖼️ Importing media...');
    for (const media of exportData.media) {
      await prisma.media.create({
        data: {
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
          uploaderId: userMap.get(media.uploaderId),
        }
      });
    }
    console.log(`✅ Imported ${exportData.media.length} media items`);
    
    // Import subscriptions
    console.log('🔗 Importing subscriptions...');
    for (const sub of exportData.subscriptions) {
      await prisma.subscription.create({
        data: {
          subscriberId: userMap.get(sub.subscriberId),
          subscribedToId: userMap.get(sub.subscribedToId),
        }
      });
    }
    console.log(`✅ Imported ${exportData.subscriptions.length} subscriptions`);
    
    // Import likes
    console.log('❤️ Importing likes...');
    for (const like of exportData.likes) {
      await prisma.like.create({
        data: {
          userId: userMap.get(like.userId),
          mediaId: like.mediaId, // We'll need to map media IDs too
        }
      });
    }
    console.log(`✅ Imported ${exportData.likes.length} likes`);
    
    // Import comments
    console.log('💬 Importing comments...');
    for (const comment of exportData.comments) {
      await prisma.comment.create({
        data: {
          content: comment.content,
          authorId: userMap.get(comment.userId) || comment.userId,
          mediaId: comment.mediaId, // We'll need to map media IDs too
        }
      });
    }
    console.log(`✅ Imported ${exportData.comments.length} comments`);
    
    console.log('✅ Import completed successfully!');
    
    return NextResponse.json({ 
      success: true, 
      message: `Successfully imported ${exportData.totalItems} items from local database!`,
      imported: {
        users: exportData.users.length,
        media: exportData.media.length,
        subscriptions: exportData.subscriptions.length,
        likes: exportData.likes.length,
        comments: exportData.comments.length
      }
    });
    
  } catch (error) {
    console.error('❌ Error importing data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to import data: ' + errorMessage },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
