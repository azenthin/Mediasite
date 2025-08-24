import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/database';
import { z } from 'zod';
import { sanitizeForDisplay } from '@/lib/sanitize';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const uploadSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().default(true),
});

// Simple local file storage (fallback when Cloudinary not configured)
async function saveFileLocally(file: Buffer, fileName: string): Promise<string> {
  const uploadDir = join(process.cwd(), 'public', 'uploads');
  
  // Create uploads directory if it doesn't exist
  try {
    await mkdir(uploadDir, { recursive: true });
  } catch (error) {
    console.log('Uploads directory already exists');
  }
  
  const filePath = join(uploadDir, fileName);
  await writeFile(filePath, file);
  
  return `/uploads/${fileName}`;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const metadata = formData.get('metadata') as string;
    const groupId = formData.get('groupId') as string; // For grouping related media

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Parse metadata
    const metadataObj = JSON.parse(metadata);
    const { title, description, category, tags, isPublic } = uploadSchema.parse(metadataObj);

    // Sanitize inputs
    const sanitizedTitle = sanitizeForDisplay(title);
    const sanitizedDescription = description ? sanitizeForDisplay(description) : '';
    const sanitizedCategory = category ? sanitizeForDisplay(category) : '';
    const sanitizedTags = tags ? tags.map(tag => sanitizeForDisplay(tag)).filter(Boolean) : [];

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Enhanced file type validation
    const allowedMimeTypes = [
        'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
        'image/jpeg', 'image/png', 'image/webp', 'image/gif'
    ];
    
    if (!allowedMimeTypes.includes(file.type)) {
        return NextResponse.json({ 
            error: 'Invalid file type. Only MP4, WebM, OGG, QuickTime videos and JPEG, PNG, WebP, GIF images are allowed.' 
        }, { status: 400 });
    }

    // File size validation (100MB max for videos, 10MB for images)
    const maxSize = file.type.startsWith('video/') ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
        const maxSizeMB = maxSize / (1024 * 1024);
        return NextResponse.json({ 
            error: `File too large. Maximum size: ${maxSizeMB}MB for ${file.type.startsWith('video/') ? 'videos' : 'images'}` 
        }, { status: 400 });
    }

    // Determine file type
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');
    const isImage = file.type.startsWith('image/');
    
    // Generate unique filename
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop() || 'bin';
    const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
    
    // Save file locally
    const fileUrl = await saveFileLocally(buffer, fileName);
    
    // Determine media type for database
    let mediaType = 'IMAGE';
    if (isVideo) mediaType = 'VIDEO';
    else if (isAudio) mediaType = 'AUDIO';

    // Save to database
    const media = await prisma.media.create({
      data: {
        title: sanitizedTitle,
        description: sanitizedDescription,
        type: mediaType,
        url: fileUrl,
        thumbnailUrl: fileUrl, // For now, use same URL as thumbnail
        duration: null, // We'll add duration detection later
        category: sanitizedCategory,
        tags: JSON.stringify(sanitizedTags),
        isPublic,
        uploaderId: session.user.id,
        groupId: groupId || null, // Link related media together
      },
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

    return NextResponse.json({
      message: 'Media uploaded successfully',
      media
    }, { status: 201 });

  } catch (error) {
    console.error('Upload error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 