import { NextRequest, NextResponse } from 'next/server';
import { safeAuth } from '@/lib/safe-auth';
import { prisma } from '@/lib/database';
import { z } from 'zod';
import { sanitizeForDisplay } from '@/lib/sanitize';
import { validateFile, validateFileHeader, sanitizeFilename } from '@/lib/file-validation';
import { validateCSRFMiddleware, csrfErrorResponse } from '@/lib/csrf';
import { logger } from '@/lib/logger';
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
  let userId: string | undefined;
  
  try {
    const session = await safeAuth();
    userId = session?.user?.id;
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // === CSRF PROTECTION ===
    const csrfValidation = await validateCSRFMiddleware(request, session.user.id);
    if (!csrfValidation.valid) {
      return csrfErrorResponse(csrfValidation.error || 'CSRF validation failed');
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

    // === COMPREHENSIVE FILE VALIDATION ===
    // Step 1: Basic validation (size, type, extension)
    const basicValidation = await validateFile(file);
    if (!basicValidation.valid) {
      logger.warn('File validation failed', {
        userId: session.user.id,
        fileName: file.name,
        error: basicValidation.error,
      });
      return NextResponse.json(
        { error: basicValidation.error || 'Invalid file' },
        { status: 400 }
      );
    }

    // Step 2: Magic byte validation (prevents MIME spoofing)
    const headerValidation = await validateFileHeader(file);
    if (!headerValidation.valid) {
      logger.warn('File header validation failed', {
        userId: session.user.id,
        fileName: file.name,
        error: headerValidation.error,
      });
      return NextResponse.json(
        { error: headerValidation.error || 'Invalid file format' },
        { status: 400 }
      );
    }

    // Step 3: Sanitize filename (prevents path traversal attacks)
    const safeFileName = sanitizeFilename(file.name);
    
    logger.info('File validation passed', {
      userId: session.user.id,
      fileName: file.name,
      safeFileName,
      fileType: basicValidation.fileType,
      size: file.size,
    });

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

    // Use validated file type from file-validation system
    const fileType = basicValidation.fileType || 'image';
    
    // Save file locally with sanitized filename
    const fileUrl = await saveFileLocally(buffer, safeFileName);
    
    // Determine media type for database
    let mediaType: 'VIDEO' | 'IMAGE' | 'AUDIO' = 'IMAGE';
    if (fileType === 'video') mediaType = 'VIDEO';
    else if (fileType === 'audio') mediaType = 'AUDIO';
    else if (fileType === 'image') mediaType = 'IMAGE';

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

    logger.info('Media uploaded successfully', {
      userId: session.user.id,
      mediaId: media.id,
      title: media.title,
      type: media.type,
    });

    return NextResponse.json({
      message: 'Media uploaded successfully',
      media
    }, { status: 201 });

  } catch (error) {
    logger.error(
      'Upload error',
      error instanceof Error ? error : undefined,
      { userId }
    );
    
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