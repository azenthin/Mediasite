'use client';

import { useCallback, useEffect } from 'react';

interface UseKeyboardControlsProps {
  currentMediaIndex: number;
  currentRelatedIndex: number;
  mediaData: any[];
  pauseAllVideos: () => void;
  preloadNextVideos: (startIndex: number, count: number) => void;
  onVerticalNavigation: (direction: 'up' | 'down') => void;
  onHorizontalNavigation: (direction: 'left' | 'right') => void;
  onVideoSeek: (direction: 'left' | 'right') => void;
  onVideoPlayPause: () => void;
}

export const useKeyboardControls = ({
  currentMediaIndex,
  currentRelatedIndex,
  mediaData,
  pauseAllVideos,
  preloadNextVideos,
  onVerticalNavigation,
  onHorizontalNavigation,
  onVideoSeek,
  onVideoPlayPause,
}: UseKeyboardControlsProps) => {
  
  // Handle keyboard navigation with useCallback to avoid stale closures
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        // Go to previous video
        if (currentMediaIndex > 0) {
          pauseAllVideos();
          onVerticalNavigation('up');
          
          // Update URL to reflect current video
          const newIndex = currentMediaIndex - 1;
          const currentVideo = mediaData[newIndex];
          if (currentVideo) {
            history.pushState({}, '', `/recommended?v=${currentVideo.id}`);
          }
          
          // Preload next few videos for smooth navigation
          preloadNextVideos(newIndex, 3);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        // Go to next video
        if (currentMediaIndex < mediaData.length - 1) {
          pauseAllVideos();
          onVerticalNavigation('down');
          
          // Update URL to reflect current video
          const newIndex = currentMediaIndex + 1;
          const currentVideo = mediaData[newIndex];
          if (currentVideo) {
            history.pushState({}, '', `/recommended?v=${currentVideo.id}`);
          }
          
          // Preload next few videos for smooth navigation
          preloadNextVideos(newIndex, 3);
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        // Seek backward 10 seconds in current video
        onVideoSeek('left');
        break;
      case 'ArrowRight':
        e.preventDefault();
        // Seek forward 10 seconds in current video
        onVideoSeek('right');
        break;
      case ' ':
      case 'Space':
        e.preventDefault();
        // Toggle play/pause for current video
        onVideoPlayPause();
        break;
    }
  }, [currentMediaIndex, currentRelatedIndex, mediaData, pauseAllVideos, preloadNextVideos, onVerticalNavigation, onHorizontalNavigation, onVideoSeek, onVideoPlayPause]);

  // Set up keyboard controls after handleKeyDown is defined
  useEffect(() => {
    // Global keyboard controls - work anywhere on the page
    window.addEventListener('keydown', handleKeyDown);
    
    // Click anywhere on the page to enable keyboard controls
    const handlePageClick = () => {
      const container = document.querySelector('.recommended-container');
      if (container) {
        (container as HTMLElement).focus();
      }
    };
    document.addEventListener('click', handlePageClick);
    
    // Auto-focus container on mount for development
    setTimeout(() => {
      const container = document.querySelector('.recommended-container');
      if (container) {
        (container as HTMLElement).focus();
      }
    }, 100);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handlePageClick);
    };
  }, [handleKeyDown]); // Add handleKeyDown as dependency

  return {
    handleKeyDown,
  };
};






