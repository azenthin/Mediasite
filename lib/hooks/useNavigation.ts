'use client';

import { useState, useCallback, useRef } from 'react';

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
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Debounce vertical scrolling to prevent rapid firing
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollTimeRef = useRef<number>(0);

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

  // Handle vertical scroll for main content with debouncing
  const handleVerticalScroll = useCallback((direction: 'up' | 'down') => {
    const now = Date.now();
    const timeSinceLastScroll = now - lastScrollTimeRef.current;
    
    // Different debounce times for mobile vs desktop
    // Mobile (touch): 300ms for better swipe responsiveness
    // Desktop (wheel): 500ms to prevent accidental rapid scrolling
    const isMobile = typeof window !== 'undefined' && 'ontouchstart' in window;
    const debounceTime = isMobile ? 300 : 500;
    
    // Only block if currently transitioning AND not enough time has passed
    if (isTransitioning && timeSinceLastScroll < debounceTime) {
      return;
    }
    
    let nextIndex = currentMediaIndex;
    if (direction === 'down' && currentMediaIndex < mediaData.length - 1) {
      nextIndex = currentMediaIndex + 1;
    } else if (direction === 'up' && currentMediaIndex > 0) {
      nextIndex = currentMediaIndex - 1;
    }

    if (nextIndex !== currentMediaIndex) {
      lastScrollTimeRef.current = now;
      setIsTransitioning(true);
      pauseAllVideos();
      setVerticalSlideDirection(direction);
      setCurrentMediaIndex(nextIndex);
      setCurrentRelatedIndex(0); // Reset related index when moving to a new post
      
      // Reset transition state after animation completes
      setTimeout(() => {
        setIsTransitioning(false);
      }, 300);
    }
  }, [currentMediaIndex, mediaData.length, pauseAllVideos, isTransitioning]);

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
    isTransitioning,
    setCurrentMediaIndex,
    setCurrentRelatedIndex,
    handleHorizontalScroll,
    handleVerticalScroll,
    navigateToMediaIndex,
  };
};


