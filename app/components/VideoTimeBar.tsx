'use client';

import React from 'react';

interface VideoTimeBarProps {
  currentTime: number;
  duration: number;
  progress: number;
  isSeeking: boolean;
  formatTime: (time: number) => string;
  onProgressClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onProgressTouch: (e: React.TouchEvent<HTMLDivElement>) => void;
  isVisible?: boolean;
}

const VideoTimeBar: React.FC<VideoTimeBarProps> = ({
  currentTime,
  duration,
  progress,
  isSeeking,
  formatTime,
  onProgressClick,
  onProgressTouch,
  isVisible = true,
}) => {
  if (!isVisible || duration === 0) return null;

  // Round progress to 1 decimal place for performance
  const roundedProgress = Math.round(progress * 10) / 10;

  return (
    <div className="absolute left-0 right-0 z-30" style={{ bottom: '-32px' }}>
      {/* Time Bar Container - Enhanced for mobile with larger touch target */}
      <div 
        className="relative w-full cursor-pointer group py-2"
        onClick={onProgressClick}
        onTouchEnd={onProgressTouch}
        style={{
          WebkitTapHighlightColor: 'transparent'
        }}
      >
        {/* The actual progress bar */}
        <div className="relative w-full h-1 bg-white/20 group-hover:h-2 transition-all duration-200">
          {/* Progress Fill */}
          <div 
            className="absolute top-0 left-0 h-full bg-red-600 transition-all duration-75 ease-out"
            style={{ 
              width: `${Math.min(100, Math.max(0, progress))}%`,
              transform: isSeeking ? 'scaleY(1.2)' : 'scaleY(1)',
            }}
          />
          
          {/* Hover Preview - Desktop only */}
          <div className="hidden md:block absolute top-0 left-0 h-full bg-red-600/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        </div>
      </div>
      
      {/* Time Display - Always visible on mobile, hover on desktop */}
      <div className="flex justify-between items-center mt-1 md:mt-1 text-[10px] md:text-xs text-white/90 font-medium md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
        <span className="select-none bg-black/60 px-1.5 py-0.5 rounded md:bg-transparent">
          {formatTime(currentTime)}
        </span>
        <span className="select-none bg-black/60 px-1.5 py-0.5 rounded md:bg-transparent">
          {formatTime(duration)}
        </span>
      </div>
      
      {/* Seeking Indicator - Enhanced for mobile */}
      {isSeeking && (
        <div className="absolute bottom-8 md:bottom-6 left-1/2 transform -translate-x-1/2 bg-black/90 text-white text-sm md:text-xs px-3 py-2 md:px-2 md:py-1 rounded-lg shadow-lg font-medium">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      )}
    </div>
  );
};

export default VideoTimeBar;


