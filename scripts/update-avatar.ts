import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateAvatar() {
  try {
    // Update user with email joab.tesfai@gmail.com
    const user = await prisma.user.update({
      where: {
        email: 'joab.tesfai@gmail.com'
      },
      data: {
        avatarUrl: '/avatars/hacker.jpg'
      }
    });

    console.log('✅ Avatar updated successfully for:', user.email);
    console.log('New avatar URL:', user.avatarUrl);
  } catch (error) {
    console.error('❌ Error updating avatar:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateAvatar();
