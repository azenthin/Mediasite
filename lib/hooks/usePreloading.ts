'use client';

import { useState, useCallback, useEffect } from 'react';

interface UsePreloadingProps {
  mediaData: any[];
}

export const usePreloading = ({ mediaData }: UsePreloadingProps) => {
  // Preloading state for smooth transitions
  const [isPreloading, setIsPreloading] = useState(false);

  // Preload next few videos for smooth transitions (YouTube Shorts style)
  // This prevents the "stuck on previous page" feeling by preloading:
  // - Thumbnail images
  // - Video metadata (duration, etc.)
  // - Page structure for instant transitions
  const preloadNextVideos = useCallback(async (startIndex: number, count: number = 3) => {
    if (isPreloading || mediaData.length === 0) return;
    
    setIsPreloading(true);
    
    try {
      for (let i = 0; i < count; i++) {
        const index = startIndex + i;
        if (index >= mediaData.length) break;
        
        const media = mediaData[index];
        if (!media) continue;
        
        // Preload thumbnail image
        if (media.thumbnailUrl) {
          const img = new Image();
          img.src = media.thumbnailUrl;
          await new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve; // Continue even if image fails
          });
        }
        
        // Preload video metadata (duration, etc.)
        if (media.type === 'VIDEO' && media.url) {
          try {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.src = media.url;
            await new Promise((resolve) => {
              video.onloadedmetadata = resolve;
              video.onerror = resolve;
              // Timeout after 2 seconds to avoid blocking
              setTimeout(resolve, 2000);
            });
          } catch (e) {
            // Continue if video preloading fails
          }
        }
      }
    } catch (e) {
      // Continue even if preloading fails
    } finally {
      setIsPreloading(false);
    }
  }, [mediaData, isPreloading]);

  // Trigger preloading when media data changes
  useEffect(() => {
    if (mediaData.length > 0) {
      preloadNextVideos(0, 5); // Preload first 5 videos
    }
  }, [mediaData.length]); // Only depend on mediaData.length to prevent infinite loops

  return {
    isPreloading,
    preloadNextVideos,
  };
};






