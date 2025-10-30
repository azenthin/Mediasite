'use client';

import { useRef, useCallback, useEffect, useState } from 'react';
import { logStartPlay } from '@/lib/analytics';

interface UseVideoControlsProps {
  currentMediaIndex: number;
  currentRelatedIndex: number;
  mediaData: any[];
  resumeProgress: number | null;
  onResumeProgressCleared: () => void;
}

export const useVideoControls = ({
  currentMediaIndex,
  currentRelatedIndex,
  mediaData,
  resumeProgress,
  onResumeProgressCleared,
}: UseVideoControlsProps) => {
  const currentVideoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Function to manually trigger video play/pause logic
  const triggerVideoPlayPause = useCallback(() => {
    if (currentVideoRef.current) {
      if (currentVideoRef.current.paused) {
        currentVideoRef.current.play().catch(() => {});
        setIsPlaying(true);
        const currentMedia = mediaData[currentMediaIndex];
        if (currentMedia?.type === 'VIDEO') {
          logStartPlay(currentMedia.id);
        }
      } else {
        currentVideoRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, [currentMediaIndex, mediaData]);

  // Pause current video helper function
  const pauseAllVideos = useCallback(() => {
    if (currentVideoRef.current && !currentVideoRef.current.paused) {
      currentVideoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  // Video observer to ensure play/pause logic is robust
  useEffect(() => {
    const currentMedia = mediaData[currentMediaIndex];
    const allContent = currentMedia ? [currentMedia, ...(currentMedia.relatedMedia || [])] : [];
    const currentContent = allContent[currentRelatedIndex];


    // Pause current video if playing
    if (currentVideoRef.current && !currentVideoRef.current.paused) {
      currentVideoRef.current.pause();
    }

    // Play the video of the currently visible slide
    if (currentContent?.type === 'VIDEO') {
      if (currentVideoRef.current) {
        // Apply resume functionality if available
        if (resumeProgress && resumeProgress > 0.05 && resumeProgress < 0.95) {
          const handleLoadedMetadata = () => {
            if (currentVideoRef.current?.duration) {
              currentVideoRef.current.currentTime = currentVideoRef.current.duration * resumeProgress;
              onResumeProgressCleared(); // Clear resume progress after applying
            }
            currentVideoRef.current?.removeEventListener('loadedmetadata', handleLoadedMetadata);
          };
          
          if (currentVideoRef.current?.readyState >= 1) {
            // Metadata already loaded
            handleLoadedMetadata();
          } else {
            currentVideoRef.current?.addEventListener('loadedmetadata', handleLoadedMetadata);
          }
        }
        
        currentVideoRef.current?.play().catch(() => {});
        setIsPlaying(true);
        logStartPlay(currentContent.id);

        // Focus the container so keyboard controls work immediately (like YouTube Shorts)
        setTimeout(() => {
          const container = document.querySelector('.recommended-container');
          if (container) {
            (container as HTMLElement).focus();
          }
        }, 100);

        // Add watch progress tracking for this video
        const trackProgress = (video: HTMLVideoElement, mediaId: string) => {
          if (video.duration) {
            const progress = video.currentTime / video.duration;
            if (!isNaN(progress) && progress > 0.01) {
              fetch('/api/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mediaId, progress }),
                keepalive: true,
              }).catch(() => {});
            }
          }
        };

        // Add event listeners for this specific video
        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => {
          setIsPlaying(false);
          if (currentVideoRef.current) {
            trackProgress(currentVideoRef.current, currentContent.id);
          }
        };
        const handleEnded = () => {
          setIsPlaying(false);
          if (currentVideoRef.current) {
            trackProgress(currentVideoRef.current, currentContent.id);
          }
        };
        
        currentVideoRef.current?.addEventListener('play', handlePlay);
        currentVideoRef.current?.addEventListener('pause', handlePause);
        currentVideoRef.current?.addEventListener('ended', handleEnded);
      }
    }
  }, [currentMediaIndex, currentRelatedIndex, mediaData, resumeProgress, onResumeProgressCleared]);

  return {
    currentVideoRef,
    triggerVideoPlayPause,
    pauseAllVideos,
    isPlaying,
  };
};


