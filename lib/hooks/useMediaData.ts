'use client';

import { useState, useCallback, useEffect } from 'react';
import { pagePreloader } from '@/lib/preloader';

interface MediaData {
  id: string;
  type: 'VIDEO' | 'IMAGE' | 'AUDIO';
  url: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  uploader: {
    username: string;
    displayName?: string;
    avatarUrl?: string;
  };
  views: number;
  likes: number;
  _count: {
    likeRecords: number;
    comments: number;
  };
  userLiked?: boolean; // Whether the current user has liked this media
  relatedMedia?: MediaData[];
}

export const useMediaData = () => {
  const [mediaData, setMediaData] = useState<MediaData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resumeProgress, setResumeProgress] = useState<number | null>(null);

  // Fetch media data from API (use recommendations for consistency)
  const fetchMedia = useCallback(async () => {
    try {
      setLoading(true);
      // Respect deep link to a specific mediaId
      const url = new URL(window.location.href);
      const mediaId = url.searchParams.get('v');
      const resumeTime = url.searchParams.get('t'); // Resume time as percentage
      // Generate a new seed each time for variety, or use existing one if deep-linked
      const existingSeed = url.searchParams.get('seed') || (typeof window !== 'undefined' ? window.sessionStorage.getItem('rec_seed') : null);
      const seedParam = existingSeed || Math.floor(Math.random() * 1000000).toString();
      
      // Store the seed for this session
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('rec_seed', seedParam);
      }
      const categoryParam = url.searchParams.get('category');
      
      // Store resume progress for later use
      if (resumeTime) {
        setResumeProgress(parseInt(resumeTime, 10) / 100); // Convert percentage to decimal
      }
      const params = new URLSearchParams();
      params.set('limit', '500'); // Increased to maximum for more variety
      if (seedParam) params.set('seed', seedParam);
      if (categoryParam) params.set('category', categoryParam);
      
      // Exclude recently seen content to avoid repetition
      const recentlySeen = mediaData.slice(0, 10).map((m: MediaData) => m.id);
      if (recentlySeen.length > 0) {
        params.set('exclude', recentlySeen.join(','));
      }
      const response = await fetch(`/api/media/recommendations?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch media');
      }
      const data = await response.json();
      
      // YouTube-style: Use only API data, no mock processing
      const apiMediaData = (data.media || []).map((m: any) => ({
        id: m.id,
        type: m.type,
        url: m.url,
        title: m.title,
        description: m.description,
        thumbnailUrl: m.thumbnailUrl,
        uploader: m.uploader,
        views: m.views,
        likes: m.likes,
        _count: m._count,
        userLiked: m.userLiked || false,
      }));
      
      // Shuffle the content for variety (Fisher-Yates shuffle)
      for (let i = apiMediaData.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [apiMediaData[i], apiMediaData[j]] = [apiMediaData[j], apiMediaData[i]];
      }

      // If a mediaId is present, ensure it's in the list
      if (mediaId && !apiMediaData.some((m: any) => m.id === mediaId)) {
        try {
          const res = await fetch(`/api/media/${mediaId}`);
          if (res.ok) {
            const item = await res.json();
            const normalized = {
              id: item.id,
              type: item.type,
              url: item.url,
              title: item.title,
              description: item.description,
              thumbnailUrl: item.thumbnailUrl,
              uploader: item.uploader,
              views: item.views,
              likes: item.likes,
              _count: item._count,
              userLiked: item.userLiked || false,
            } as MediaData;
            apiMediaData.unshift(normalized);
          }
        } catch (error) {
          console.error('Failed to fetch specific media:', error);
        }
      }

      
      setMediaData(apiMediaData);
    } catch (err) {
      console.error('Error fetching media:', err);
      setError('Failed to load media');
    } finally {
      setLoading(false);
    }
  }, [mediaData]);

  // Check if page was preloaded from home page
  useEffect(() => {
    const preloadedData = pagePreloader.getPreloadedData('recommended');
    if (preloadedData) {
      // Use preloaded data for instant page load
      setMediaData(preloadedData.mediaData);
      setLoading(false);
      // Clear the preloaded data after use
      pagePreloader.clearPreloadedData('recommended');
    } else {
      // Normal loading if no preloaded data
      fetchMedia();
    }
  }, []);

  const clearResumeProgress = useCallback(() => {
    setResumeProgress(null);
  }, []);

  return {
    mediaData,
    loading,
    error,
    resumeProgress,
    clearResumeProgress,
    fetchMedia,
  };
};






