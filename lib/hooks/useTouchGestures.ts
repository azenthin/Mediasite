'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

interface TouchPosition {
  x: number;
  y: number;
}

interface VideoTouchStart extends TouchPosition {
  time: number;
}

interface UseTouchGesturesProps {
  isImmersiveMode: boolean;
  currentMediaIndex: number;
  mediaDataLength: number;
  onVerticalSwipe: (direction: 'up' | 'down') => void;
  onHorizontalSwipe: (direction: 'left' | 'right') => void;
  onVideoTap: () => void;
  onVideoDoubleTap?: (direction: 'left' | 'right') => void; // mobile double-tap seek
}

export const useTouchGestures = ({
  isImmersiveMode,
  currentMediaIndex,
  mediaDataLength,
  onVerticalSwipe,
  onHorizontalSwipe,
  onVideoTap,
  onVideoDoubleTap,
}: UseTouchGesturesProps) => {
  // Touch state
  const [touchStart, setTouchStart] = useState<TouchPosition | null>(null);
  const [touchEnd, setTouchEnd] = useState<TouchPosition | null>(null);
  const [isVideoTouched, setIsVideoTouched] = useState(false);
  const [videoTouchStart, setVideoTouchStart] = useState<VideoTouchStart | null>(null);

  // Constants
  const minSwipeDistance = isImmersiveMode ? 30 : 30; // Lower threshold for better mobile responsiveness
  const swipeAngleBias = 1.2; // Slightly less strict to allow easier vertical swipes
  const videoTapThreshold = 220; // Max time for tap vs hold (ms)
  const doubleTapThreshold = 300; // ms between taps
  const doubleTapMoveTolerance = 30; // px

  // Double-tap tracking
  const lastTapTimeRef = useRef<number>(0);
  const lastTapPosRef = useRef<TouchPosition | null>(null);

  // Touch handling - different behavior for desktop vs mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.targetTouches[0];
    setTouchEnd(null);
    setTouchStart({
      x: touch.clientX,
      y: touch.clientY
    });
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.targetTouches[0];
    setTouchEnd({
      x: touch.clientX,
      y: touch.clientY
    });
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd) {
      return;
    }
    
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const totalDistance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    
    const isUpSwipe = distanceY > minSwipeDistance;
    const isDownSwipe = distanceY < -minSwipeDistance;
    const isLeftSwipe = distanceX > minSwipeDistance;
    const isRightSwipe = distanceX < -minSwipeDistance;
    
    // Only process if user actually swiped beyond minimum distance
    if (totalDistance < minSwipeDistance) {
      setTouchStart(null);
      setTouchEnd(null);
      return;
    }
    
    // Different behavior for mobile vs desktop
    if (isImmersiveMode) {
      // Mobile: YouTube Shorts style - only vertical swipes for video navigation
      if (Math.abs(distanceY) > Math.abs(distanceX) * swipeAngleBias) {
        if (isUpSwipe && currentMediaIndex < mediaDataLength - 1) {
          // Swipe up - next video
          onVerticalSwipe('down');
        } else if (isDownSwipe && currentMediaIndex > 0) {
          // Swipe down - previous video
          onVerticalSwipe('up');
        }
      }
    } else {
      // Desktop: Full functionality - both vertical and horizontal navigation
      if (Math.abs(distanceY) > Math.abs(distanceX) * swipeAngleBias) {
        // Vertical swipes - video navigation
        if (isUpSwipe && currentMediaIndex < mediaDataLength - 1) {
          onVerticalSwipe('down');
        } else if (isDownSwipe && currentMediaIndex > 0) {
          onVerticalSwipe('up');
        }
      } else {
        // Horizontal swipes - related content navigation
        if (isLeftSwipe) {
          onHorizontalSwipe('right');
        } else if (isRightSwipe) {
          onHorizontalSwipe('left');
        }
      }
    }
    
    // Clear touch state
    setTouchStart(null);
    setTouchEnd(null);
  }, [touchStart, touchEnd, isImmersiveMode, currentMediaIndex, mediaDataLength, onVerticalSwipe, onHorizontalSwipe, minSwipeDistance, swipeAngleBias]);

  // Handle mouse wheel events for desktop scrolling
  const handleWheel = useCallback((e: Event) => {
    const wheelEvent = e as WheelEvent;
    wheelEvent.preventDefault();
    
    const deltaY = wheelEvent.deltaY;
    const deltaX = wheelEvent.deltaX;
    
    // Only handle vertical scrolling
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      if (deltaY > 0 && currentMediaIndex < mediaDataLength - 1) {
        // Scroll down - next video
        onVerticalSwipe('down');
      } else if (deltaY < 0 && currentMediaIndex > 0) {
        // Scroll up - previous video
        onVerticalSwipe('up');
      }
    }
  }, [currentMediaIndex, mediaDataLength, onVerticalSwipe]);

  // Add wheel event listener with passive: false to allow preventDefault
  useEffect(() => {
    const container = document.querySelector('.recommended-container');
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        container.removeEventListener('wheel', handleWheel);
      };
    }
  }, [handleWheel]);

  // Mobile video-specific touch handlers
  const handleVideoTouchStart = useCallback((e: React.TouchEvent) => {
    // DON'T stop propagation here - we need swipes to work!
    // Only store the touch start for tap detection
    setIsVideoTouched(true);
    setVideoTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
      time: Date.now()
    });
  }, []);

  const handleVideoTouchEnd = useCallback((e: React.TouchEvent) => {
    setIsVideoTouched(false);
    
    if (!videoTouchStart) return;
    
    const touchDuration = Date.now() - videoTouchStart.time;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const distanceX = Math.abs(videoTouchStart.x - touchEndX);
    const distanceY = Math.abs(videoTouchStart.y - touchEndY);
    
    // If it's a quick tap (not a swipe), handle it and stop propagation
    if (touchDuration < videoTapThreshold && distanceX < 10 && distanceY < 10) {
      // This is a tap, not a swipe - stop propagation
      e.stopPropagation();
      
      const now = Date.now();
      const lastTime = lastTapTimeRef.current;
      const lastPos = lastTapPosRef.current;
      const isDouble = now - lastTime < doubleTapThreshold && lastPos &&
        Math.abs(lastPos.x - touchEndX) < doubleTapMoveTolerance &&
        Math.abs(lastPos.y - touchEndY) < doubleTapMoveTolerance;

      if (isDouble && onVideoDoubleTap) {
        const screenMid = (typeof window !== 'undefined') ? window.innerWidth / 2 : 0;
        const direction = touchEndX < screenMid ? 'left' : 'right';
        onVideoDoubleTap(direction);
        // reset last tap to avoid triple processing
        lastTapTimeRef.current = 0;
        lastTapPosRef.current = null;
      } else {
        onVideoTap();
        lastTapTimeRef.current = now;
        lastTapPosRef.current = { x: touchEndX, y: touchEndY };
      }
    }
    // If it's a swipe (distance > 10px), DON'T stop propagation - let it bubble up for navigation
    
    setVideoTouchStart(null);
  }, [videoTouchStart, onVideoTap, onVideoDoubleTap, videoTapThreshold, doubleTapThreshold, doubleTapMoveTolerance]);

  return {
    // State
    touchStart,
    touchEnd,
    isVideoTouched,
    videoTouchStart,
    
    // Handlers
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleVideoTouchStart,
    handleVideoTouchEnd,
  };
};


