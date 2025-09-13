'use client';

import { useState, useCallback } from 'react';

interface UseNavigationProps {
  mediaData: any[];
  pauseAllVideos: () => void;
  preloadNextVideos: (startIndex: number, count: number) => void;
}

export const useNavigation = ({
  mediaData,
  pauseAllVideos,
  preloadNextVideos,
}: UseNavigationProps) => {
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [currentRelatedIndex, setCurrentRelatedIndex] = useState(0);
  const [verticalSlideDirection, setVerticalSlideDirection] = useState<'up' | 'down'>('down');

  // Handle horizontal scroll for related content
  const handleHorizontalScroll = useCallback((direction: 'left' | 'right') => {
    const currentMedia = mediaData[currentMediaIndex];
    if (!currentMedia) return;

    const allContent = [currentMedia, ...(currentMedia.relatedMedia || [])];
    const nextIndex = direction === 'right' 
      ? (currentRelatedIndex + 1) % allContent.length
      : (currentRelatedIndex - 1 + allContent.length) % allContent.length;

    pauseAllVideos();
    setCurrentRelatedIndex(nextIndex);
  }, [currentMediaIndex, currentRelatedIndex, mediaData, pauseAllVideos]);

  // Handle vertical scroll for main content
  const handleVerticalScroll = useCallback((direction: 'up' | 'down') => {
    
    let nextIndex = currentMediaIndex;
    if (direction === 'down' && currentMediaIndex < mediaData.length - 1) {
      nextIndex = currentMediaIndex + 1;
    } else if (direction === 'up' && currentMediaIndex > 0) {
      nextIndex = currentMediaIndex - 1;
    }


    if (nextIndex !== currentMediaIndex) {
      pauseAllVideos();
      setVerticalSlideDirection(direction);
      setCurrentMediaIndex(nextIndex);
      setCurrentRelatedIndex(0); // Reset related index when moving to a new post
    } else {
    }
  }, [currentMediaIndex, mediaData.length, pauseAllVideos]);

  // Navigate to specific media index (for deep linking)
  const navigateToMediaIndex = useCallback((index: number) => {
    if (index >= 0 && index < mediaData.length) {
      setCurrentMediaIndex(index);
      setCurrentRelatedIndex(0);
    }
  }, [mediaData.length]);

  return {
    currentMediaIndex,
    currentRelatedIndex,
    verticalSlideDirection,
    setCurrentMediaIndex,
    setCurrentRelatedIndex,
    handleHorizontalScroll,
    handleVerticalScroll,
    navigateToMediaIndex,
  };
};


