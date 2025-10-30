import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface UploadResult {
  url: string;
  publicId: string;
  duration?: number;
  width?: number;
  height?: number;
}

export async function uploadMedia(
  file: Buffer,
  folder: string = 'mediasite',
  resourceType: 'video' | 'image' = 'video'
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        format: resourceType === 'video' ? 'mp4' : 'auto',
        quality: 'auto',
        fetch_format: 'auto',
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else if (result) {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            duration: result.duration,
            width: result.width,
            height: result.height,
          });
        }
      }
    );

    uploadStream.end(file);
  });
}

export async function generateThumbnail(
  videoUrl: string,
  time: string = '00:00:01'
): Promise<string> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      videoUrl,
      {
        transformation: [
          { width: 400, height: 400, crop: 'fill' },
          { start_offset: time }
        ],
        format: 'jpg',
        quality: 'auto',
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else if (result) {
          resolve(result.secure_url);
        }
      }
    );
  });
}

export async function deleteMedia(publicId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
} 