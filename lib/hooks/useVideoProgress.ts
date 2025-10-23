'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

interface UseVideoProgressProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isPlaying: boolean;
}

export const useVideoProgress = ({ videoRef, isPlaying }: UseVideoProgressProps) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekTime, setSeekTime] = useState(0);
  
  const animationFrameRef = useRef<number>();
  const lastUpdateTime = useRef<number>(0);

  // Smooth progress update using requestAnimationFrame with throttling
  const updateProgress = useCallback(() => {
    if (!videoRef.current || isSeeking) return;

    const now = performance.now();
    // Throttle updates to 60fps for smooth animation
    if (now - lastUpdateTime.current < 50) {
      animationFrameRef.current = requestAnimationFrame(updateProgress);
      return;
    }
    lastUpdateTime.current = now;

    const video = videoRef.current;
    if (video.duration && !isNaN(video.duration)) {
      const current = video.currentTime;
      const total = video.duration;
      const progressValue = (current / total) * 100;

      setCurrentTime(current);
      setDuration(total);
      setProgress(progressValue);
    }

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    }
  }, [videoRef, isPlaying, isSeeking]);

  // Start/stop progress tracking based on play state
  useEffect(() => {
    if (isPlaying && !isSeeking) {
      updateProgress();
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, isSeeking, updateProgress]);

  // Handle seeking
  const handleSeek = useCallback((clickX: number, barWidth: number) => {
    if (!videoRef.current || !duration) return;

    const clickPosition = clickX / barWidth;
    const newTime = clickPosition * duration;
    
    setIsSeeking(true);
    setSeekTime(newTime);
    
    // Instant seek like YouTube
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
    setCurrentTime(newTime);
    setProgress((newTime / duration) * 100);
    setIsSeeking(false);
    setSeekTime(0);
  }, [videoRef, duration, currentTime]);

  // Handle mouse/touch events for seeking
  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const barWidth = rect.width;
    handleSeek(clickX, barWidth);
  }, [handleSeek]);

  const handleProgressTouch = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0];
    const clickX = touch.clientX - rect.left;
    const barWidth = rect.width;
    handleSeek(clickX, barWidth);
  }, [handleSeek]);

  // Format time display
  const formatTime = useCallback((time: number) => {
    if (!time || isNaN(time)) return '0:00';
    
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Reset progress when video changes
  useEffect(() => {
    setCurrentTime(0);
    setProgress(0);
    setIsSeeking(false);
  }, [videoRef.current?.src]);

  return {
    currentTime,
    duration,
    progress,
    isSeeking,
    formatTime,
    handleProgressClick,
    handleProgressTouch,
  };
};




