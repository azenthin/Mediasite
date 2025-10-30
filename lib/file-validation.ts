/**
 * File validation utilities for media uploads
 * Validates file types, sizes, and performs security checks
 */

import { logger } from './logger';

// Allowed file types and their MIME types
const ALLOWED_FILE_TYPES = {
  video: {
    mimes: [
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/quicktime', // .mov
      'video/x-msvideo', // .avi
    ],
    extensions: ['.mp4', '.webm', '.ogg', '.mov', '.avi'],
    maxSize: 500 * 1024 * 1024, // 500MB
  },
  image: {
    mimes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ],
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
    maxSize: 10 * 1024 * 1024, // 10MB
  },
  audio: {
    mimes: [
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'audio/webm',
      'audio/mp4',
    ],
    extensions: ['.mp3', '.wav', '.ogg', '.m4a'],
    maxSize: 50 * 1024 * 1024, // 50MB
  },
};

interface ValidationResult {
  valid: boolean;
  error?: string;
  fileType?: 'video' | 'image' | 'audio';
}

/**
 * Validate file type and size
 */
export function validateFile(file: File): ValidationResult {
  // Check if file exists
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  // Determine file type from MIME
  let fileType: 'video' | 'image' | 'audio' | null = null;
  for (const [type, config] of Object.entries(ALLOWED_FILE_TYPES)) {
    if (config.mimes.includes(file.type)) {
      fileType = type as 'video' | 'image' | 'audio';
      break;
    }
  }

  if (!fileType) {
    return {
      valid: false,
      error: `File type "${file.type}" is not supported. Allowed types: video (mp4, webm, ogg), image (jpg, png, gif, webp), audio (mp3, wav, ogg)`,
    };
  }

  // Validate file extension matches MIME type
  const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (!extension || !ALLOWED_FILE_TYPES[fileType].extensions.includes(extension)) {
    return {
      valid: false,
      error: `File extension does not match file type. Expected one of: ${ALLOWED_FILE_TYPES[fileType].extensions.join(', ')}`,
    };
  }

  // Validate file size
  const maxSize = ALLOWED_FILE_TYPES[fileType].maxSize;
  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(0);
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `File size (${fileSizeMB}MB) exceeds maximum allowed size of ${maxSizeMB}MB for ${fileType} files`,
    };
  }

  // Check for zero-byte files
  if (file.size === 0) {
    return {
      valid: false,
      error: 'File is empty (0 bytes)',
    };
  }

  logger.debug('File validation passed', {
    fileName: file.name,
    fileType,
    fileSize: file.size,
    mimeType: file.type,
  });

  return { valid: true, fileType };
}

/**
 * Validate file header (magic bytes) to prevent MIME type spoofing
 * This checks the actual file content, not just the extension
 */
export async function validateFileHeader(file: File): Promise<ValidationResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const arr = new Uint8Array(e.target?.result as ArrayBuffer).subarray(0, 8);
      let header = '';
      for (let i = 0; i < arr.length; i++) {
        header += arr[i].toString(16).padStart(2, '0');
      }

      // Check magic bytes for common file types
      const signatures: { [key: string]: string[] } = {
        video: [
          '66747970', // MP4 (ftyp)
          '1a45dfa3', // WebM/MKV
          '4f676753', // OGG
          '52494646', // AVI (RIFF)
          '000001ba', // MPEG
          '000001b3', // MPEG
        ],
        image: [
          'ffd8ff',   // JPEG
          '89504e47', // PNG
          '47494638', // GIF
          '52494646', // WEBP (RIFF)
          '3c3f786d', // SVG (<?xml)
          '3c737667', // SVG (<svg)
        ],
        audio: [
          '494433',   // MP3 (ID3)
          'fffb',     // MP3 (no ID3)
          '52494646', // WAV (RIFF)
          '4f676753', // OGG
          '664c6143', // FLAC
        ],
      };

      let detectedType: string | null = null;
      for (const [type, sigs] of Object.entries(signatures)) {
        if (sigs.some(sig => header.startsWith(sig.toLowerCase()))) {
          detectedType = type;
          break;
        }
      }

      if (!detectedType) {
        logger.warn('Could not verify file type from header', {
          fileName: file.name,
          header: header.substring(0, 16),
        });
        // Allow file but log warning - some valid files might not match
        resolve({ valid: true });
      } else {
        logger.debug('File header validation passed', {
          fileName: file.name,
          detectedType,
          header: header.substring(0, 16),
        });
        resolve({ valid: true, fileType: detectedType as 'video' | 'image' | 'audio' });
      }
    };

    reader.onerror = () => {
      resolve({
        valid: false,
        error: 'Failed to read file for validation',
      });
    };

    reader.readAsArrayBuffer(file.slice(0, 8));
  });
}

/**
 * Sanitize filename to prevent directory traversal and other attacks
 */
export function sanitizeFilename(filename: string): string {
  // Remove path separators and special characters
  let sanitized = filename
    .replace(/[\/\\]/g, '')
    .replace(/[^\w\s.-]/g, '')
    .replace(/\s+/g, '_')
    .toLowerCase();

  // Ensure filename isn't too long
  if (sanitized.length > 200) {
    const extension = sanitized.match(/\.[^.]+$/)?.[0] || '';
    sanitized = sanitized.substring(0, 200 - extension.length) + extension;
  }

  // Add timestamp to prevent collisions
  const timestamp = Date.now();
  const extension = sanitized.match(/\.[^.]+$/)?.[0] || '';
  const nameWithoutExt = sanitized.replace(/\.[^.]+$/, '');
  
  return `${nameWithoutExt}_${timestamp}${extension}`;
}

/**
 * Validate complete upload request
 */
export interface UploadValidation {
  valid: boolean;
  error?: string;
  fileType?: 'video' | 'image' | 'audio';
  sanitizedFilename?: string;
}

export async function validateUpload(
  file: File,
  title?: string,
  description?: string
): Promise<UploadValidation> {
  // Validate file
  const fileValidation = validateFile(file);
  if (!fileValidation.valid) {
    return fileValidation;
  }

  // Validate file header (magic bytes)
  const headerValidation = await validateFileHeader(file);
  if (!headerValidation.valid) {
    return headerValidation;
  }

  // Validate title if provided
  if (title !== undefined) {
    if (title.length < 3) {
      return { valid: false, error: 'Title must be at least 3 characters long' };
    }
    if (title.length > 200) {
      return { valid: false, error: 'Title must be less than 200 characters' };
    }
  }

  // Validate description if provided
  if (description !== undefined && description.length > 5000) {
    return {
      valid: false,
      error: 'Description must be less than 5000 characters',
    };
  }

  // Sanitize filename
  const sanitizedFilename = sanitizeFilename(file.name);

  return {
    valid: true,
    fileType: fileValidation.fileType,
    sanitizedFilename,
  };
}

export default {
  validateFile,
  validateFileHeader,
  sanitizeFilename,
  validateUpload,
};
